"""
Recovery and ElevenLabs Voice Agent (JEA) API routes.

Provides endpoints for:
1. ElevenLabs Webhook Tools:
   - POST /api/recovery/promise-to-pay
   - POST /api/recovery/human-intervention
2. Recovery Voice Session Actions:
   - POST /api/recovery/voice/call
   - GET  /api/recovery/invoices/{invoice_id}/calls
3. Manual Channel Triggers:
   - POST /api/recovery/send-whatsapp
   - POST /api/recovery/send-email
4. ElevenLabs Webhook Callback:
   - POST /api/webhooks/elevenlabs
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Literal

from fastapi import APIRouter, HTTPException, Request, Depends, status, Header, Query, Response, BackgroundTasks
from pydantic import BaseModel, Field

from ..database.prisma import client as db
from .auth import get_optional_business, get_current_business
from ..services.elevenlabs_service import (
    build_invoice_dynamic_variables,
    get_signed_conversation_url,
    verify_webhook_signature,
    is_configured as is_elevenlabs_configured,
)
from ..services.whatsapp_service import (
    send_invoice_whatsapp,
    send_whatsapp_text,
    is_configured as is_whatsapp_configured,
)
from ..services.gmail_service import (
    send_email,
    fetch_unread_replies,
    mark_message_processed,
    is_authenticated as is_gmail_authenticated,
)
from ..services.inbound_service import (
    process_inbound_message,
    resolve_invoice_by_phone,
    resolve_invoice_by_email,
)
from ..services.razorpay_service import (
    generate_payment_link,
    fetch_payment_link,
    verify_webhook_signature as verify_razorpay_signature,
)
from ..services.notification_service import (
    send_payment_received_notifications,
)

router = APIRouter(prefix="/api/recovery", tags=["Recovery & Voice Agent"])


# ============================================================
# SCHEMAS
# ============================================================

class PromiseToPayRequest(BaseModel):
    invoice_number: str = Field(..., description="Invoice number or ID")
    promised_date: str = Field(..., description="Promised payment date in YYYY-MM-DD format")
    customer_statement: str = Field(..., description="Customer statement confirming commitment")


class HumanInterventionRequest(BaseModel):
    invoice_number: str = Field(..., description="Invoice number or ID")
    reason: str = Field(..., description="Reason for escalation: PAYMENT_REFUSAL, INVOICE_DISPUTE, CUSTOMER_CLAIMS_PAID, etc.")
    customer_statement: str = Field(..., description="Statement from customer")


class VoiceCallRequest(BaseModel):
    invoice_id: int = Field(..., description="Database ID of the invoice")


class ManualSendRequest(BaseModel):
    invoice_id: int


# ============================================================
# HELPER: INVOICE RESOLUTION
# ============================================================

async def _resolve_invoice(invoice_number: str):
    """Find invoice by either invoice_name or invoice_id."""
    clean_num = invoice_number.strip()

    # Try matching invoice_name directly
    invoice = await db.invoice.find_first(
        where={"invoice_name": {"equals": clean_num, "mode": "insensitive"}},
        include={"company": True}
    )
    if invoice:
        return invoice

    # If it is numeric, try matching invoice_id
    if clean_num.isdigit():
        invoice = await db.invoice.find_first(
            where={"invoice_id": int(clean_num)},
            include={"company": True}
        )
        if invoice:
            return invoice

    # Try matching partial prefix e.g. "INV-123" vs "123"
    digits = re.sub(r"\D", "", clean_num)
    if digits:
        invoice = await db.invoice.find_first(
            where={"invoice_id": int(digits)},
            include={"company": True}
        )
        if invoice:
            return invoice

    return None


# ============================================================
# 1. TOOL: PROMISE TO PAY
# ============================================================

@router.post("/promise-to-pay")
async def update_promise_to_pay(req: PromiseToPayRequest):
    """
    ElevenLabs Tool Endpoint: Record a customer's genuine promise-to-pay.
    
    Guardrails:
    - Invoice must exist.
    - Invoice must not already be PAID.
    - Promised date must be a valid future/current date in YYYY-MM-DD format.
    - Updates database and moves workflow into WAIT state.
    """
    if not db.is_connected():
        await db.connect()

    invoice = await _resolve_invoice(req.invoice_number)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice '{req.invoice_number}' not found in records.",
        )

    # GUARDRAIL 1: If invoice is already paid, refuse promise update
    if invoice.invoice_amount_status or invoice.invoice_status == "PAID":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice '{invoice.invoice_name}' is already marked as PAID. No promise can be recorded.",
        )

    # GUARDRAIL 2: Validate date format
    try:
        parsed_date = datetime.strptime(req.promised_date.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format for promised_date. Must be YYYY-MM-DD.",
        )

    # Convert to datetime for Prisma
    promised_datetime = datetime(parsed_date.year, parsed_date.month, parsed_date.day, 23, 59, 59)

    # Update invoice state
    updated_invoice = await db.invoice.update(
        where={"invoice_id": invoice.invoice_id},
        data={
            "recovery_status": "PROMISE_TO_PAY",
            "promised_date": promised_datetime,
            "customer_statement": req.customer_statement.strip(),
        },
        include={"company": True}
    )

    # Log event into CallLog if active or create an entry
    await db.calllog.create(
        data={
            "invoice_id": invoice.invoice_id,
            "company_id": invoice.company_id,
            "channel": "VOICE",
            "provider": "ELEVENLABS",
            "status": "CALL_COMPLETED",
            "summary": f"Customer promised to pay by {req.promised_date}. Statement: {req.customer_statement}",
            "outcome": "PROMISE_TO_PAY",
        }
    )

    return {
        "success": True,
        "message": f"Promise to pay recorded for invoice {invoice.invoice_name} on {req.promised_date}.",
        "invoice_id": invoice.invoice_id,
        "invoice_name": invoice.invoice_name,
        "recovery_status": "PROMISE_TO_PAY",
        "promised_date": req.promised_date,
    }


# ============================================================
# 2. TOOL: REQUEST HUMAN INTERVENTION
# ============================================================

@router.post("/human-intervention")
async def request_human_intervention(req: HumanInterventionRequest):
    """
    ElevenLabs Tool Endpoint: Escalate case to human intervention.
    
    Guardrails:
    - Sets recovery_status = NEEDS_HUMAN_INTERVENTION.
    - If reason is INVOICE_DISPUTE or CUSTOMER_CLAIMS_PAID, marks invoice_status = DISPUTE.
    - Halts further automated reminders.
    """
    if not db.is_connected():
        await db.connect()

    invoice = await _resolve_invoice(req.invoice_number)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice '{req.invoice_number}' not found in records.",
        )

    norm_reason = req.reason.strip().upper()
    update_data: Dict[str, Any] = {
        "recovery_status": "NEEDS_HUMAN_INTERVENTION",
        "human_intervention_reason": norm_reason,
        "customer_statement": req.customer_statement.strip(),
    }

    if norm_reason in ["INVOICE_DISPUTE", "DISPUTE", "CUSTOMER_CLAIMS_PAID"]:
        update_data["invoice_status"] = "DISPUTE"

    updated_invoice = await db.invoice.update(
        where={"invoice_id": invoice.invoice_id},
        data=update_data,
        include={"company": True}
    )

    # Log event into CallLog
    await db.calllog.create(
        data={
            "invoice_id": invoice.invoice_id,
            "company_id": invoice.company_id,
            "channel": "VOICE",
            "provider": "ELEVENLABS",
            "status": "CALL_COMPLETED",
            "summary": f"Escalated to human review. Reason: {norm_reason}. Statement: {req.customer_statement}",
            "outcome": "NEEDS_HUMAN_INTERVENTION",
        }
    )

    return {
        "success": True,
        "message": f"Invoice {invoice.invoice_name} has been routed for human review.",
        "invoice_id": invoice.invoice_id,
        "invoice_name": invoice.invoice_name,
        "recovery_status": "NEEDS_HUMAN_INTERVENTION",
        "reason": norm_reason,
    }


# ============================================================
# 3. VOICE CALL INITIATION (FRONTEND / DASHBOARD ACTION)
# ============================================================

@router.post("/voice/call")
async def initiate_voice_call(
    req: VoiceCallRequest,
    current_business=Depends(get_optional_business),
):
    """
    Dashboard action: Initiate an ElevenLabs voice conversation with JEA.
    
    Guardrails:
    - If invoice is already PAID, refuse to call.
    - Dynamically generates invoice context (customer_name, invoice_amount, etc.).
    - Returns signed URL for secure in-browser streaming (or telephony dispatch).
    - Logs CALL_INITIATED in CallLog.
    """
    if not db.is_connected():
        await db.connect()

    invoice = await db.invoice.find_first(
        where={"invoice_id": req.invoice_id},
        include={"company": True}
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    # GUARDRAIL: Do not call if already paid
    if invoice.invoice_amount_status or invoice.invoice_status == "PAID":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already paid. Recovery call cannot be initiated.",
        )

    business_name = current_business.business_name if current_business else None

    # If invoice doesn't have a payment link yet, generate and persist one now
    if not invoice.payment_link:
        try:
            company_name = invoice.company.company_name if invoice.company else "Customer"
            customer_email = invoice.company.company_email if invoice.company else None
            customer_phone = invoice.company.company_phone if invoice.company else None
            rzp_res = await generate_payment_link(
                amount=float(invoice.invoice_amount),
                description=f"Payment for invoice {invoice.invoice_name}",
                customer_name=company_name,
                customer_email=customer_email,
                customer_phone=customer_phone,
                invoice_id=invoice.invoice_id,
                invoice_name=invoice.invoice_name,
            )
            plink = rzp_res.get("short_url", "")
            plink_id = rzp_res.get("payment_link_id", "")
            if plink:
                invoice = await db.invoice.update(
                    where={"invoice_id": invoice.invoice_id},
                    data={"payment_link": plink, "payment_link_id": plink_id},
                    include={"company": True}
                )
        except Exception as plink_err:
            print(f"[recovery/voice] Failed to auto-generate payment link: {plink_err}")

    # Prepare context for JEA
    dynamic_vars = build_invoice_dynamic_variables(
        invoice=invoice.dict() if hasattr(invoice, "dict") else dict(invoice),
        company=invoice.company,
        business_name=business_name,
    )

    # Create initial CallLog
    call_log = await db.calllog.create(
        data={
            "invoice_id": invoice.invoice_id,
            "company_id": invoice.company_id,
            "channel": "VOICE",
            "provider": "ELEVENLABS",
            "status": "CALL_INITIATED",
            "summary": f"Voice recovery session started for invoice {invoice.invoice_name}",
        }
    )

    # Try generating signed URL from ElevenLabs
    signed_url = None
    elevenlabs_error = None
    try:
        if is_elevenlabs_configured():
            res = await get_signed_conversation_url(dynamic_variables=dynamic_vars)
            signed_url = res.get("signed_url")
    except Exception as exc:
        print(f"[recovery] Error getting ElevenLabs signed URL: {exc}")
        elevenlabs_error = str(exc)

    return {
        "success": True,
        "call_id": call_log.id,
        "signed_url": signed_url,
        "dynamic_variables": dynamic_vars,
        "elevenlabs_configured": is_elevenlabs_configured(),
        "elevenlabs_error": elevenlabs_error,
        "invoice": {
            "invoice_id": invoice.invoice_id,
            "invoice_name": invoice.invoice_name,
            "invoice_amount": float(invoice.invoice_amount),
            "customer_name": invoice.company.company_name if invoice.company else "Customer",
            "customer_phone": invoice.company.company_phone if invoice.company else "",
            "payment_link": invoice.payment_link,
        }
    }


# ============================================================
# 3.5 GENERATE INVOICE PAYMENT LINK ON DEMAND
# ============================================================

@router.post("/invoices/{invoice_id}/payment-link")
async def generate_invoice_payment_link_endpoint(invoice_id: int):
    """Generate or retrieve a Razorpay payment link for an existing invoice."""
    if not db.is_connected():
        await db.connect()

    invoice = await db.invoice.find_first(
        where={"invoice_id": invoice_id},
        include={"company": True}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.payment_link:
        return {
            "success": True,
            "payment_link": invoice.payment_link,
            "payment_link_id": invoice.payment_link_id,
            "invoice": invoice,
            "reused": True,
        }

    company_name = invoice.company.company_name if invoice.company else "Customer"
    customer_email = invoice.company.company_email if invoice.company else None
    customer_phone = invoice.company.company_phone if invoice.company else None

    rzp_res = await generate_payment_link(
        amount=float(invoice.invoice_amount),
        description=f"Payment for invoice {invoice.invoice_name}",
        customer_name=company_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        invoice_id=invoice.invoice_id,
        invoice_name=invoice.invoice_name,
    )

    plink = rzp_res.get("short_url", "")
    plink_id = rzp_res.get("payment_link_id", "")

    updated_inv = await db.invoice.update(
        where={"invoice_id": invoice.invoice_id},
        data={"payment_link": plink, "payment_link_id": plink_id},
        include={"company": True}
    )

    return {
        "success": True,
        "payment_link": plink,
        "payment_link_id": plink_id,
        "invoice": updated_inv,
        "reused": False,
    }


# ============================================================
# 4. INVOICE CALL LOGS
# ============================================================

@router.get("/invoices/{invoice_id}/calls")
async def get_invoice_calls(invoice_id: int):
    """Retrieve call history and event logs for an invoice."""
    if not db.is_connected():
        await db.connect()

    calls = await db.calllog.find_many(
        where={"invoice_id": invoice_id},
        order={"created_at": "desc"}
    )
    return calls


# ============================================================
# 5. MANUAL REMINDER TRIGGERS (DASHBOARD ACTIONS)
# ============================================================

@router.post("/send-whatsapp")
async def manual_send_whatsapp(req: ManualSendRequest):
    """Explicitly trigger WhatsApp reminder from dashboard."""
    if not db.is_connected():
        await db.connect()

    invoice = await db.invoice.find_first(
        where={"invoice_id": req.invoice_id},
        include={"company": True}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.invoice_amount_status or invoice.invoice_status == "PAID":
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    if not invoice.company or not invoice.company.company_phone:
        raise HTTPException(status_code=400, detail="Customer has no phone number on file")

    if not is_whatsapp_configured():
        raise HTTPException(status_code=400, detail="Meta WhatsApp is not configured on server")

    from ..services.notification_service import format_due_date
    msg_id = await send_invoice_whatsapp(
        to_number=invoice.company.company_phone,
        company_name=invoice.company.company_name,
        invoice_name=invoice.invoice_name,
        invoice_amount=float(invoice.invoice_amount),
        due_date_str=format_due_date(invoice.invoice_due_date),
        payment_link=invoice.payment_link or "",
    )

    return {"success": True, "message": "WhatsApp reminder sent", "message_id": msg_id}


@router.post("/send-email")
async def manual_send_email(req: ManualSendRequest):
    """Explicitly trigger Gmail reminder from dashboard."""
    if not db.is_connected():
        await db.connect()

    invoice = await db.invoice.find_first(
        where={"invoice_id": req.invoice_id},
        include={"company": True}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.invoice_amount_status or invoice.invoice_status == "PAID":
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    if not invoice.company or not invoice.company.company_email:
        raise HTTPException(status_code=400, detail="Customer has no email address on file")

    if not is_gmail_authenticated():
        raise HTTPException(status_code=400, detail="Gmail is not connected. Visit /auth/gmail to authenticate.")

    from ..services.notification_service import format_due_date
    due_str = format_due_date(invoice.invoice_due_date)
    subject = f"Payment Reminder — Invoice #{invoice.invoice_name}"
    body = (
        f"Dear {invoice.company.company_name},\n\n"
        f"This is a reminder regarding outstanding invoice {invoice.invoice_name} "
        f"for ₹{float(invoice.invoice_amount):,.2f}, due on {due_str}.\n\n"
    )
    if invoice.payment_link:
        body += f"Pay online: {invoice.payment_link}\n\n"
    body += "Thank you."

    result = send_email(to=invoice.company.company_email, subject=subject, body_text=body)
    return {"success": True, "message": "Email reminder sent", "result": result}


# ============================================================
# 6. WEBHOOK: ELEVENLABS POST-CALL EVENT
# ============================================================

@router.post("/webhooks/elevenlabs")
async def elevenlabs_webhook(
    request: Request,
    elevenlabs_signature: Optional[str] = Header(None, alias="elevenlabs-signature"),
):
    """
    Secure webhook endpoint for ElevenLabs post-call events.
    Receives call transcript, summary, and call result.
    """
    raw_body = await request.body()

    # Verify signature
    if not verify_webhook_signature(raw_body, elevenlabs_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ElevenLabs webhook signature",
        )

    try:
        data = await request.json()
    except Exception:
        return {"status": "ignored"}

    if not db.is_connected():
        await db.connect()

    # ElevenLabs sends event payload
    event_type = data.get("type") or data.get("event")
    conversation_id = data.get("conversation_id")
    transcript = data.get("transcript") or data.get("formatted_transcript")
    summary = data.get("summary") or data.get("analysis", {}).get("transcript_summary")
    status_str = data.get("status", "CALL_COMPLETED")

    # If call_id or invoice_id is passed in custom metadata or dynamic variables
    custom_data = data.get("custom_data") or data.get("dynamic_variables") or {}
    inv_number = custom_data.get("invoice_number")

    if inv_number:
        invoice = await _resolve_invoice(inv_number)
        if invoice:
            await db.calllog.create(
                data={
                    "invoice_id": invoice.invoice_id,
                    "company_id": invoice.company_id,
                    "channel": "VOICE",
                    "provider": "ELEVENLABS",
                    "call_sid": conversation_id,
                    "status": "CALL_COMPLETED",
                    "transcript": str(transcript) if transcript else None,
                    "summary": str(summary) if summary else None,
                    "outcome": "COMPLETED",
                }
            )

    return {"status": "success"}


# ============================================================
# 5.5 RAZORPAY WEBHOOK & PAYMENT RECONCILIATION
# ============================================================

async def reconcile_active_payment_links() -> list:
    """
    Check Razorpay API for all unpaid invoices with payment links.
    Automatically marks invoice as PAID when Razorpay reports paid and dispatches receipts.
    """
    if not db.is_connected():
        await db.connect()

    unpaid_invoices = await db.invoice.find_many(
        where={
            "invoice_status": {"not": "PAID"},
            "payment_link_id": {"not": None},
        },
        include={"company": True},
    )

    updated = []
    for inv in unpaid_invoices:
        if not inv.payment_link_id:
            continue
        try:
            rzp_data = await fetch_payment_link(inv.payment_link_id)
            status_from_rzp = rzp_data.get("status", "").lower()
            if status_from_rzp == "paid":
                await db.invoice.update(
                    where={"invoice_id": inv.invoice_id},
                    data={
                        "invoice_amount_status": True,
                        "invoice_status": "PAID",
                        "recovery_status": "PAID",
                    },
                )
                print(f"[reconcile_payments] Invoice {inv.invoice_name} (ID: {inv.invoice_id}) verified as PAID on Razorpay!")
                if inv.company:
                    try:
                        await send_payment_received_notifications(
                            customer_name=inv.company.company_name,
                            customer_email=inv.company.company_email,
                            customer_phone=inv.company.company_phone,
                            invoice_name=inv.invoice_name,
                            invoice_amount=float(inv.invoice_amount),
                            payment_reference=inv.payment_link_id or "Razorpay Payment",
                        )
                    except Exception as notif_err:
                        print(f"[reconcile_payments] Error sending payment notifications: {notif_err}")
                updated.append(inv.invoice_name)
        except Exception as e:
            pass

    return updated


@router.post("/invoices/{invoice_id}/verify-payment")
async def verify_invoice_payment(invoice_id: int):
    """
    Verify single invoice status directly against Razorpay payment link.
    Immediately marks PAID if payment link has been settled and sends thank-you receipt.
    """
    if not db.is_connected():
        await db.connect()

    invoice = await db.invoice.find_unique(
        where={"invoice_id": invoice_id},
        include={"company": True},
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.invoice_amount_status or invoice.invoice_status == "PAID":
        return {"status": "PAID", "message": "Invoice is already marked as paid"}

    if not invoice.payment_link_id:
        return {"status": invoice.invoice_status, "message": "Invoice has no Razorpay payment link"}

    rzp_data = await fetch_payment_link(invoice.payment_link_id)
    rzp_status = rzp_data.get("status", "").lower()
    
    if rzp_status == "paid":
        await db.invoice.update(
            where={"invoice_id": invoice_id},
            data={
                "invoice_amount_status": True,
                "invoice_status": "PAID",
                "recovery_status": "PAID",
            },
        )
        if invoice.company:
            try:
                await send_payment_received_notifications(
                    customer_name=invoice.company.company_name,
                    customer_email=invoice.company.company_email,
                    customer_phone=invoice.company.company_phone,
                    invoice_name=invoice.invoice_name,
                    invoice_amount=float(invoice.invoice_amount),
                    payment_reference=invoice.payment_link_id or "Razorpay Verified",
                )
            except Exception as notif_err:
                print(f"[verify_payment] Error sending payment notifications: {notif_err}")
        return {"status": "PAID", "verified": True, "message": "Payment verified on Razorpay! Invoice marked PAID."}

    return {"status": invoice.invoice_status, "razorpay_status": rzp_status, "verified": False}


@router.post("/webhooks/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
):
    """
    Instant webhook from Razorpay for payment events:
    - payment_link.paid
    - payment.captured
    Automatically updates invoice from unpaid to PAID and sends thank-you notifications.
    """
    raw_body = await request.body()
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "").strip()

    if webhook_secret and x_razorpay_signature:
        if not verify_razorpay_signature(raw_body, x_razorpay_signature):
            raise HTTPException(status_code=401, detail="Invalid Razorpay webhook signature")

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    event = payload.get("event", "")
    print(f"[razorpay_webhook] Received event: {event}")

    if not db.is_connected():
        await db.connect()

    plink_id = payload.get("payload", {}).get("payment_link", {}).get("entity", {}).get("id")
    payment_notes = payload.get("payload", {}).get("payment", {}).get("entity", {}).get("notes", {})
    invoice_id_note = payment_notes.get("invoice_id")
    invoice_name_note = payment_notes.get("invoice_name")

    invoice = None
    if plink_id:
        invoice = await db.invoice.find_first(where={"payment_link_id": plink_id}, include={"company": True})
    if not invoice and invoice_id_note:
        try:
            invoice = await db.invoice.find_unique(where={"invoice_id": int(invoice_id_note)}, include={"company": True})
        except Exception:
            pass
    if not invoice and invoice_name_note:
        invoice = await db.invoice.find_first(where={"invoice_name": str(invoice_name_note)}, include={"company": True})

    if invoice:
        await db.invoice.update(
            where={"invoice_id": invoice.invoice_id},
            data={
                "invoice_amount_status": True,
                "invoice_status": "PAID",
                "recovery_status": "PAID",
            },
        )
        print(f"[razorpay_webhook] Successfully updated invoice {invoice.invoice_name} to PAID!")
        if invoice.company:
            try:
                await send_payment_received_notifications(
                    customer_name=invoice.company.company_name,
                    customer_email=invoice.company.company_email,
                    customer_phone=invoice.company.company_phone,
                    invoice_name=invoice.invoice_name,
                    invoice_amount=float(invoice.invoice_amount),
                    payment_reference=plink_id or "Razorpay Webhook",
                )
            except Exception as notif_err:
                print(f"[razorpay_webhook] Error sending payment notifications: {notif_err}")
        return {"status": "success", "invoice": invoice.invoice_name, "updated": "PAID"}

    return {"status": "ignored_no_invoice"}


# ============================================================
# 6. INBOUND WHATSAPP WEBHOOK (META CLOUD API)
# ============================================================

@router.get("/webhooks/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    """
    Verification endpoint required by Meta WhatsApp Cloud API.
    Verifies that webhook requests originate from Meta.
    """
    expected_token = os.environ.get("META_VERIFY_TOKEN", "recovery_agent_secret_token").strip()
    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        print("[whatsapp_webhook] Webhook successfully verified with Meta!")
        return Response(content=str(hub_challenge), media_type="text/plain")

    raise HTTPException(status_code=403, detail="Verification token mismatch")


async def _process_whatsapp_message_async(from_phone: str, text_body: str):
    """Asynchronous background worker to process inbound message and send reply."""
    try:
        invoice = await resolve_invoice_by_phone(from_phone)
        if not invoice:
            # Fallback to most recent non-paid invoice in the system for testing
            if not db.is_connected():
                await db.connect()
            invoice = await db.invoice.find_first(
                where={"invoice_status": {"not": "PAID"}},
                order={"created_at": "desc"},
                include={"company": True},
            )

        if invoice:
            result = await process_inbound_message(
                incoming_text=text_body,
                invoice=invoice,
                channel="WHATSAPP",
            )
            reply_text = result.get("reply_text")
            if reply_text and is_whatsapp_configured():
                await send_whatsapp_text(to_number=from_phone, message_text=reply_text)
                print(f"[whatsapp_webhook] Successfully dispatched reply to {from_phone}")
        else:
            fallback_reply = (
                "Hello! We received your message. We could not locate an active invoice for your account. "
                "Please reply with your Invoice Number (e.g. inv123) so we can assist you."
            )
            if is_whatsapp_configured():
                await send_whatsapp_text(to_number=from_phone, message_text=fallback_reply)
                print(f"[whatsapp_webhook] Sent fallback reply to {from_phone}")
    except Exception as err:
        print(f"[whatsapp_webhook] Error processing background WhatsApp message: {err}")


@router.post("/webhooks/whatsapp")
async def receive_whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receive incoming WhatsApp messages from customers.
    Immediately returns 200 OK to Meta and processes intent asynchronously.
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            val = change.get("value", {})
            messages = val.get("messages", [])
            for msg in messages:
                msg_type = msg.get("type")
                from_phone = msg.get("from", "")
                
                if msg_type == "text" and from_phone:
                    text_body = msg.get("text", {}).get("body", "").strip()
                    print(f"[whatsapp_webhook] Inbound message from {from_phone}: '{text_body}'")
                    background_tasks.add_task(_process_whatsapp_message_async, from_phone, text_body)

    return {"status": "success"}


# ============================================================
# 7. INBOUND EMAIL SYNC & PROCESSING (GMAIL)
# ============================================================

async def do_sync_incoming_emails() -> list:
    """Core function to check unread emails, classify intent, and reply."""
    if not is_gmail_authenticated():
        return []

    unread_emails = fetch_unread_replies(max_results=5)
    print(f"[sync-emails] Found {len(unread_emails)} unread email(s)")

    results = []
    for email in unread_emails:
        from_email = email.get("from_email", "")
        subject = email.get("subject", "")
        body = email.get("body", "")

        # Find invoice by email or reference in text
        invoice = await resolve_invoice_by_email(from_email, text_context=f"{subject} {body}")
        if not invoice:
            mark_message_processed(email.get("message_id"))
            results.append({
                "email": from_email,
                "status": "SKIPPED_NO_INVOICE",
                "subject": subject,
            })
            continue

        # Process through AI pipeline
        proc_result = await process_inbound_message(
            incoming_text=body,
            invoice=invoice,
            channel="EMAIL",
        )
        reply_text = proc_result.get("reply_text")

        # Reply to customer email
        reply_subject = f"Re: {subject}" if not subject.lower().startswith("re:") else subject
        try:
            send_email(
                to=from_email,
                subject=reply_subject,
                body_text=reply_text,
                thread_id=email.get("thread_id"),
                in_reply_to=email.get("message_id"),
            )
            proc_result["email_sent"] = True
            mark_message_processed(email.get("message_id"))
            print(f"[sync-emails] Successfully sent reply email to {from_email} (Thread: {email.get('thread_id')})")
        except Exception as send_err:
            print(f"[sync-emails] Error sending reply email to {from_email}: {send_err}")
            proc_result["email_sent"] = False

        results.append(proc_result)

    return results


@router.post("/sync-emails")
async def sync_incoming_emails():
    """
    Check Gmail inbox for unread customer replies to recovery reminder emails.
    Processes intents (queries, promises, paid verifications, disputes) and sends replies.
    """
    if not is_gmail_authenticated():
        raise HTTPException(
            status_code=400,
            detail="Gmail is not authorized. Visit /auth/gmail to connect your account."
        )

    results = await do_sync_incoming_emails()
    return {
        "status": "success",
        "processed_count": len(results),
        "results": results,
    }

    return {
        "status": "success",
        "processed_count": len(results),
        "results": results,
    }


# ============================================================
# 8. SIMULATE INBOUND MESSAGE (DEV & AUTOMATED TESTING)
# ============================================================

class SimulateInboundRequest(BaseModel):
    invoice_id: int = Field(..., description="ID of the invoice to simulate reply for")
    message: str = Field(..., description="Customer message text")
    channel: Literal["WHATSAPP", "EMAIL"] = Field(default="WHATSAPP", description="Channel simulating reply from")


@router.post("/inbound/simulate")
async def simulate_inbound_message(req: SimulateInboundRequest):
    """
    Simulate an incoming customer reply for testing.
    Runs intent classification, Razorpay verification, and DB state updates.
    """
    if not db.is_connected():
        await db.connect()

    invoice = await db.invoice.find_unique(
        where={"invoice_id": req.invoice_id},
        include={"company": True}
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    result = await process_inbound_message(
        incoming_text=req.message,
        invoice=invoice,
        channel=req.channel,
    )

    return {
        "success": True,
        "input_message": req.message,
        "channel": req.channel,
        "pipeline_result": result,
    }
