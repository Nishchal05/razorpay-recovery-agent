"""
WhatsApp channel — sends messages via the Meta WhatsApp Cloud API.

Required env vars:
    META_ACCESS_TOKEN      — System User or page access token
    META_PHONE_NUMBER_ID   — Sender's Phone Number ID from Meta App Dashboard
    META_API_VERSION       — Graph API version, e.g. v25.0 (default: v25.0)

Optional env vars (override per-type template names):
    WA_TEMPLATE_PAYMENT_REMINDER
    WA_TEMPLATE_PROMISE_FOLLOWUP
    WA_TEMPLATE_OVERDUE_REMINDER
    WA_TEMPLATE_GENERAL_FOLLOWUP
    WA_TEMPLATE_LANG       — BCP-47 language code (default: en_US)
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from ..recoveryagent import RecoveryState

# Map decision message_type -> Meta-approved WhatsApp template name.
# WhatsApp requires pre-approved templates for business-initiated messages
# outside the 24-hour customer-service window.
# Templates are created at: business.facebook.com -> WhatsApp Manager -> Message Templates
TEMPLATE_MAP: dict[str, str] = {
    "PAYMENT_REMINDER": os.environ.get(
        "WA_TEMPLATE_PAYMENT_REMINDER", "jaspers_market_order_confirmation_v1"
    ),
    "PROMISE_FOLLOWUP": os.environ.get(
        "WA_TEMPLATE_PROMISE_FOLLOWUP", "jaspers_market_order_confirmation_v1"
    ),
    "OVERDUE_REMINDER": os.environ.get(
        "WA_TEMPLATE_OVERDUE_REMINDER", "jaspers_market_order_confirmation_v1"
    ),
    "GENERAL_FOLLOWUP": os.environ.get(
        "WA_TEMPLATE_GENERAL_FOLLOWUP", "jaspers_market_order_confirmation_v1"
    ),
}


async def send_whatsapp_message(state: "RecoveryState") -> dict:
    """
    LangGraph node: send a WhatsApp message via the Meta WhatsApp Cloud API.

    Reads from state:
        invoice         — dict with invoice_id, invoice_name, invoice_amount
        payment_link    — Razorpay payment link (may be empty string)
        message_type    — one of PAYMENT_REMINDER / PROMISE_FOLLOWUP /
                          OVERDUE_REMINDER / GENERAL_FOLLOWUP
        companydetail   — Prisma Company object; must have company_phone and
                          company_name attributes

    Writes to state:
        whatsapp_sid    — Meta message ID on success, empty string on failure
    """
    invoice = state["invoice"]
    message_type = state.get("message_type", "GENERAL_FOLLOWUP")
    companydetail = state.get("companydetail")

    print(f"[whatsapp] company details: {companydetail}")
    print(f"[whatsapp] sending message_type: {message_type}")

    # ── Resolve destination phone number ──────────────────────────────────────
    customer_phone = (
        getattr(companydetail, "company_phone", None) if companydetail else None
    )

    if not customer_phone:
        print(
            f"[whatsapp] no company_phone for invoice {invoice.get('invoice_id')}"
        )
        return {"whatsapp_sid": ""}

    # Strip any "whatsapp:" prefix — Meta API expects a bare E.164 number
    to_number = customer_phone.removeprefix("whatsapp:").lstrip("+")

    # ── Load Meta credentials ─────────────────────────────────────────────────
    try:
        access_token = os.environ["META_ACCESS_TOKEN"]
        phone_number_id = os.environ["META_PHONE_NUMBER_ID"]
    except KeyError as exc:
        print(f"[whatsapp] missing env variable: {exc}")
        return {"whatsapp_sid": ""}

    api_version = os.environ.get("META_API_VERSION", "v25.0")
    template_name = TEMPLATE_MAP.get(message_type, "")

    if not template_name:
        print(
            f"[whatsapp] No template name for '{message_type}'. "
            f"Set WA_TEMPLATE_{message_type} in your .env file."
        )
        return {"whatsapp_sid": ""}

    # ── Build the template payload ────────────────────────────────────────────
    # Template body parameters: {{1}} company_name, {{2}} invoice_name, {{3}} amount
    # Adjust the components list if your approved template has different variables.
    company_name = getattr(companydetail, "company_name", "Valued Customer")
    invoice_name = invoice.get("invoice_name", "")
    invoice_amount = str(invoice.get("invoice_amount", ""))

    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": os.environ.get("WA_TEMPLATE_LANG", "en_US")},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": company_name},
                        {"type": "text", "text": invoice_name},
                        {"type": "text", "text": invoice_amount},
                    ],
                }
            ],
        },
    }

    # ── POST to Meta Cloud API ────────────────────────────────────────────────
    url = (
        f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    )
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http:
            response = await http.post(url, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        print(
            f"[whatsapp] Meta API HTTP error {exc.response.status_code}: "
            f"{exc.response.text}"
        )
        return {"whatsapp_sid": ""}
    except Exception as exc:
        print(f"[whatsapp] Meta API call failed: {exc}")
        return {"whatsapp_sid": ""}

    message_id = data.get("messages", [{}])[0].get("id", "")

    print("================================")
    print("WHATSAPP MESSAGE SENT (Meta API)")
    print("================================")
    print("Message ID:", message_id)

    return {"whatsapp_sid": message_id}
