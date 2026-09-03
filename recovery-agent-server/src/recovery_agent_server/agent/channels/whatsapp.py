"""
WhatsApp channel node — thin LangGraph adapter.

All Meta API logic lives in ``services/whatsapp_service.py``.
This file is only responsible for translating LangGraph state
into the service call and writing the result back to state.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ...services.whatsapp_service import send_whatsapp_template

if TYPE_CHECKING:
    from ..recoveryagent import RecoveryState


async def send_whatsapp_message(state: "RecoveryState") -> dict:
    """
    LangGraph node: send a WhatsApp template message.

    Reads from state:
        invoice         — dict with invoice_id, invoice_name, invoice_amount
        message_type    — one of PAYMENT_REMINDER / PROMISE_FOLLOWUP /
                          OVERDUE_REMINDER / GENERAL_FOLLOWUP
        companydetail   — Prisma Company object with company_phone / company_name

    Writes to state:
        whatsapp_sid    — Meta message ID on success, empty string on failure
    """
    invoice = state["invoice"]
    message_type = state.get("message_type", "GENERAL_FOLLOWUP")
    companydetail = state.get("companydetail")

    print(f"[whatsapp] company: {companydetail}")
    print(f"[whatsapp] message_type: {message_type}")

    # ── Resolve destination number ────────────────────────────────────────────
    customer_phone = (
        getattr(companydetail, "company_phone", None) if companydetail else None
    )
    if not customer_phone:
        print(f"[whatsapp] no company_phone for invoice {invoice.get('invoice_id')}")
        return {"whatsapp_sid": ""}

    # Strip any "whatsapp:" prefix; Meta expects a bare E.164 number without "+"
    to_number = customer_phone.removeprefix("whatsapp:").lstrip("+")

    # ── Build template parameters ─────────────────────────────────────────────
    # Template body: {{1}} company_name, {{2}} invoice_name, {{3}} amount
    company_name  = getattr(companydetail, "company_name", "Valued Customer")
    invoice_name  = invoice.get("invoice_name", "")
    invoice_amount = str(invoice.get("invoice_amount", ""))

    try:
        message_id = await send_whatsapp_template(
            to_number=to_number,
            message_type=message_type,
            template_params=[company_name, invoice_name, invoice_amount],
        )
    except (ValueError, RuntimeError) as exc:
        print(f"[whatsapp] send failed: {exc}")
        return {"whatsapp_sid": ""}

    print("================================")
    print("WHATSAPP MESSAGE SENT (Meta API)")
    print("================================")
    print("Message ID:", message_id)

    return {"whatsapp_sid": message_id}
