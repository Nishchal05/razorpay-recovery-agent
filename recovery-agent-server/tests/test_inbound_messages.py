"""
Automated Test Suite for Inbound Customer Message Handling (WhatsApp & Gmail).

Tests all key scenarios:
1. INVOICE QUERY: Customer asks for amount, due date, or link -> returns informative answer.
2. PROMISE TO PAY: Customer promises future date -> extracts date, sets PROMISE_TO_PAY in DB.
3. ALREADY PAID (VERIFIED): Paid link on Razorpay -> marks PAID in DB, returns thank-you.
4. ALREADY PAID (UNVERIFIED): Unpaid on Razorpay -> marks NEEDS_HUMAN_INTERVENTION with CUSTOMER_CLAIMS_PAID.
5. DISPUTE / REFUSAL: Customer disputes or refuses -> marks DISPUTE and NEEDS_HUMAN_INTERVENTION.
6. WHATSAPP WEBHOOK HANDSHAKE: Meta verification GET request with hub.challenge.
"""

import asyncio
import os
import sys
from datetime import datetime, date, timedelta
from dotenv import load_dotenv

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

from httpx import AsyncClient, ASGITransport
from recovery_agent_server.main import app
from recovery_agent_server.database.prisma import client as db
from recovery_agent_server.services.inbound_service import process_inbound_message


async def run_inbound_tests():
    print("=" * 65)
    print("STARTING INBOUND MESSAGE PROCESSING TEST SUITE (WHATSAPP & GMAIL)")
    print("=" * 65)

    if not db.is_connected():
        await db.connect()

    # Setup test company and invoice
    company = await db.company.find_first(where={"company_name": "Inbound Test Corp"})
    if not company:
        company = await db.company.create(
            data={
                "company_name": "Inbound Test Corp",
                "company_email": "inbound@testcorp.com",
                "company_phone": "+919111222333",
                "company_address": "404 Tech Park",
                "preferred_channel": "WHATSAPP",
            }
        )

    test_inv_name = f"INV-INB-{int(datetime.now().timestamp())}"
    invoice = await db.invoice.create(
        data={
            "company_id": company.company_id,
            "invoice_name": test_inv_name,
            "invoice_amount": 15000.00,
            "invoice_due_date": datetime.now() - timedelta(days=2),
            "invoice_amount_status": False,
            "invoice_status": "PENDING",
            "payment_link": "https://rzp.io/i/test_inbound_link",
            "payment_link_id": "plink_test_unpaid_123",
            "recovery_status": "PENDING",
        },
        include={"company": True}
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:

        # ------------------------------------------------------------
        # TEST 1: WHATSAPP WEBHOOK VERIFICATION (GET HANDSHAKE)
        # ------------------------------------------------------------
        print("\n--- TEST 1: Meta WhatsApp Webhook Handshake ---")
        challenge_token = "987654321"
        res_verify = await client.get(
            "/api/recovery/webhooks/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.challenge": challenge_token,
                "hub.verify_token": "recovery_agent_secret_token",
            },
        )
        assert res_verify.status_code == 200, f"Expected 200, got {res_verify.status_code}"
        assert res_verify.text == challenge_token
        print(f"[OK] WhatsApp Webhook handshake verified successfully (Challenge: {res_verify.text}).")

        # ------------------------------------------------------------
        # TEST 2: INVOICE QUERY INTENT
        # ------------------------------------------------------------
        print("\n--- TEST 2: Customer Query About Invoice ---")
        res2 = await process_inbound_message(
            incoming_text="Hi, can you tell me what is my pending amount and send the payment link?",
            invoice=invoice,
            channel="WHATSAPP",
        )
        assert res2["success"] is True
        assert res2["intent"] == "INVOICE_QUERY"
        assert "15000" in res2["reply_text"]
        print(f"[OK] Handled query accurately:\nReply: {res2['reply_text']}")

        # ------------------------------------------------------------
        # TEST 3: PROMISE TO PAY INTENT
        # ------------------------------------------------------------
        print("\n--- TEST 3: Customer Promise to Pay ---")
        res3 = await process_inbound_message(
            incoming_text="I will make the payment by next Monday.",
            invoice=invoice,
            channel="WHATSAPP",
        )
        assert res3["success"] is True
        assert res3["intent"] == "PROMISE_TO_PAY"
        assert res3["recovery_status"] == "PROMISE_TO_PAY"

        # Verify DB update
        db_inv3 = await db.invoice.find_unique(where={"invoice_id": invoice.invoice_id})
        assert db_inv3.recovery_status == "PROMISE_TO_PAY"
        assert db_inv3.promised_date is not None
        print(f"[OK] Promise to Pay recorded in DB: Promised Date = {db_inv3.promised_date}")

        # ------------------------------------------------------------
        # TEST 4: CUSTOMER CLAIMS ALREADY PAID (UNVERIFIED)
        # ------------------------------------------------------------
        print("\n--- TEST 4: Customer Claims Already Paid (Unverified on Razorpay) ---")
        res4 = await process_inbound_message(
            incoming_text="I already paid this invoice yesterday via net banking.",
            invoice=invoice,
            channel="WHATSAPP",
        )
        assert res4["success"] is True
        assert res4["intent"] == "ALREADY_PAID"
        assert res4["recovery_status"] == "NEEDS_HUMAN_INTERVENTION"

        # Verify DB update
        db_inv4 = await db.invoice.find_unique(where={"invoice_id": invoice.invoice_id})
        assert db_inv4.recovery_status == "NEEDS_HUMAN_INTERVENTION"
        assert db_inv4.human_intervention_reason == "CUSTOMER_CLAIMS_PAID"
        print(f"[OK] Unverified payment escalated to human review: {db_inv4.human_intervention_reason}")
        print(f"[OK] Customer advised to provide UTR: {res4['reply_text'][:100]}...")

        # ------------------------------------------------------------
        # TEST 5: CUSTOMER CLAIMS ALREADY PAID (VERIFIED IN DB / GATEWAY)
        # ------------------------------------------------------------
        print("\n--- TEST 5: Customer Claims Already Paid (Verified) ---")
        # Temporarily mark invoice_status = PAID to simulate confirmed payment
        await db.invoice.update(
            where={"invoice_id": invoice.invoice_id},
            data={"invoice_amount_status": True, "invoice_status": "PAID"},
        )
        fresh_inv = await db.invoice.find_unique(where={"invoice_id": invoice.invoice_id}, include={"company": True})

        res5 = await process_inbound_message(
            incoming_text="I have completed the payment.",
            invoice=fresh_inv,
            channel="EMAIL",
        )
        assert res5["success"] is True
        assert res5["intent"] == "ALREADY_PAID"
        assert res5["recovery_status"] == "PAID"
        assert "verified your payment" in res5["reply_text"].lower()
        print(f"[OK] Verified payment acknowledged with receipt confirmation:\n{res5['reply_text']}")

        # ------------------------------------------------------------
        # TEST 6: CUSTOMER DISPUTE / HUMAN INTERVENTION
        # ------------------------------------------------------------
        print("\n--- TEST 6: Customer Dispute / Refusal ---")
        # Reset to PENDING
        await db.invoice.update(
            where={"invoice_id": invoice.invoice_id},
            data={"invoice_amount_status": False, "invoice_status": "PENDING"},
        )
        fresh_inv2 = await db.invoice.find_unique(where={"invoice_id": invoice.invoice_id}, include={"company": True})

        res6 = await process_inbound_message(
            incoming_text="This bill is wrong, we never ordered these services. Stop sending reminders and get a manager.",
            invoice=fresh_inv2,
            channel="WHATSAPP",
        )
        assert res6["success"] is True
        assert res6["intent"] == "HUMAN_INTERVENTION"
        assert res6["recovery_status"] == "NEEDS_HUMAN_INTERVENTION"

        db_inv6 = await db.invoice.find_unique(where={"invoice_id": invoice.invoice_id})
        assert db_inv6.invoice_status == "DISPUTE"
        assert db_inv6.recovery_status == "NEEDS_HUMAN_INTERVENTION"
        print(f"[OK] Case marked DISPUTE in DB and routed to human support: {db_inv6.human_intervention_reason}")

        # ------------------------------------------------------------
        # TEST 7: ENDPOINT SIMULATION API (POST /inbound/simulate)
        # ------------------------------------------------------------
        print("\n--- TEST 7: Inbound Simulation API Endpoint ---")
        res7 = await client.post(
            "/api/recovery/inbound/simulate",
            json={
                "invoice_id": invoice.invoice_id,
                "message": "I will pay next Wednesday for sure.",
                "channel": "WHATSAPP",
            },
        )
        assert res7.status_code == 200
        sim_data = res7.json()
        assert sim_data["success"] is True
        assert sim_data["pipeline_result"]["intent"] == "PROMISE_TO_PAY"
        print(f"[OK] Inbound simulation endpoint executed pipeline successfully.")

        # Clean up test records
        await db.message.delete_many(where={"invoice_id": invoice.invoice_id})
        await db.invoice.delete(where={"invoice_id": invoice.invoice_id})
        await db.company.delete(where={"company_id": company.company_id})

    print("\n" + "=" * 65)
    print("ALL 7 INBOUND MESSAGE PROCESSING SCENARIOS PASSED SUCCESSFULLY!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(run_inbound_tests())
