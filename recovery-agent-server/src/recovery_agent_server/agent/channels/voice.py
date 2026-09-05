"""
Voice channel node — LangGraph adapter for ElevenLabs Voice Agent (JEA).

Mirrors the pattern of ``channels/whatsapp.py`` and ``channels/email.py``.
Translates LangGraph state into voice recovery context, logs call initiation
to the database, and dispatches via ElevenLabs Conversational AI.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from datetime import datetime

from ...services.elevenlabs_service import (
    build_invoice_dynamic_variables,
    initiate_outbound_phone_call,
    is_configured as is_elevenlabs_configured,
)
from ...database.prisma import client as db

if TYPE_CHECKING:
    from ..recoveryagent import RecoveryState


async def call_voice_agent(state: "RecoveryState") -> dict:
    """
    LangGraph node: initiate voice recovery interaction via ElevenLabs JEA.

    Reads from state:
        invoice         — dict with invoice_id, invoice_name, invoice_amount
        companydetail   — Prisma Company object with company_phone / company_name
        message_type    — string indicating context (PAYMENT_REMINDER / OVERDUE_REMINDER)

    Writes to state:
        voice_sid       — Call/session ID on success
        call_status     — Status string (e.g. CALL_INITIATED, CALL_SCHEDULED)
    """
    invoice = state["invoice"]
    companydetail = state.get("companydetail")
    message_type = state.get("message_type", "OVERDUE_REMINDER")

    print(f"[voice/JEA] Starting voice recovery for invoice {invoice.get('invoice_id')}")
    print(f"[voice/JEA] Customer: {getattr(companydetail, 'company_name', 'Customer')}")

    if state.get("payment_link") and not invoice.get("payment_link"):
        invoice["payment_link"] = state.get("payment_link")

    # Build dynamic variables for JEA
    dynamic_vars = build_invoice_dynamic_variables(
        invoice=invoice,
        company=companydetail,
    )

    inv_id = invoice.get("invoice_id")
    customer_phone = getattr(companydetail, "company_phone", "")

    # Create a CallLog record in database
    call_log = None
    try:
        if not db.is_connected():
            await db.connect()

        call_log = await db.calllog.create(
            data={
                "invoice_id": int(inv_id),
                "company_id": getattr(companydetail, "company_id", None),
                "channel": "VOICE",
                "provider": "ELEVENLABS",
                "status": "CALL_INITIATED",
                "summary": f"LangGraph automated voice recovery initiated for invoice {invoice.get('invoice_name')} ({message_type})",
            }
        )
    except Exception as db_err:
        print(f"[voice/JEA] Failed to create initial call log: {db_err}")

    call_sid = f"voice_call_{call_log.id}" if call_log else f"voice_{int(datetime.now().timestamp())}"

    # If phone calling is configured in ElevenLabs and customer has phone
    if customer_phone and is_elevenlabs_configured():
        try:
            call_res = await initiate_outbound_phone_call(
                to_phone=customer_phone,
                dynamic_variables=dynamic_vars,
            )
            print(f"[voice/JEA] ElevenLabs outbound call response: {call_res}")
            if "call_sid" in call_res:
                call_sid = call_res["call_sid"]
        except Exception as call_err:
            print(f"[voice/JEA] Outbound phone call dispatch: {call_err}")

    print("================================")
    print("VOICE RECOVERY SESSION INITIATED (JEA)")
    print("================================")
    print("Call SID:", call_sid)

    return {
        "voice_sid": str(call_sid),
        "call_status": "CALL_INITIATED",
    }
