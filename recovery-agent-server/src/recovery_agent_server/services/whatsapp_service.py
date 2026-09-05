"""
WhatsApp Cloud API service.

Mirrors the structure of ``gmail_service.py``:
  - All Meta credentials and template configuration live here.
  - ``send_whatsapp_template()`` is the single public function callers use.

Environment variables required:
    META_ACCESS_TOKEN      — System User or page access token
    META_PHONE_NUMBER_ID   — Sender's Phone Number ID from Meta App Dashboard

Environment variables optional:
    META_API_VERSION       — Graph API version (default: v25.0)
    WA_TEMPLATE_LANG       — BCP-47 language code (default: en_US)

    Per-message-type template overrides:
    WA_TEMPLATE_PAYMENT_REMINDER
    WA_TEMPLATE_PROMISE_FOLLOWUP
    WA_TEMPLATE_OVERDUE_REMINDER
    WA_TEMPLATE_GENERAL_FOLLOWUP
"""

from __future__ import annotations

import os
from typing import Literal, Optional, Any

import httpx

# ── Template map ───────────────────────────────────────────────────────────────
# WhatsApp requires pre-approved templates for business-initiated messages
# outside the 24-hour customer-service window.
# Create templates at: business.facebook.com → WhatsApp Manager → Message Templates

MessageType = Literal[
    "PAYMENT_REMINDER",
    "PROMISE_FOLLOWUP",
    "OVERDUE_REMINDER",
    "GENERAL_FOLLOWUP",
    "INVOICE_PAYMENT",
]

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
    "INVOICE_PAYMENT": os.environ.get(
        "WA_TEMPLATE_INVOICE_PAYMENT", "invoice_payment"
    ),
}


# ── Credentials ────────────────────────────────────────────────────────────────

def _load_credentials() -> tuple[str, str]:
    """
    Return (access_token, phone_number_id) from environment variables.

    Raises:
        RuntimeError: If either required env var is missing.
    """
    try:
        access_token = os.environ["META_ACCESS_TOKEN"]
        phone_number_id = os.environ["META_PHONE_NUMBER_ID"]
    except KeyError as exc:
        raise RuntimeError(
            f"Missing WhatsApp env variable: {exc}. "
            "Set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID."
        ) from exc
    return access_token, phone_number_id


def is_configured() -> bool:
    """True if both required env vars are present."""
    return bool(
        os.environ.get("META_ACCESS_TOKEN")
        and os.environ.get("META_PHONE_NUMBER_ID")
    )


def normalize_phone_for_meta(phone: str, default_country_code: str = "91") -> str:
    """
    Normalize phone number to Meta's expected E.164 format without '+'.
    If a 10-digit Indian number is provided without country code, automatically prepends '91'.
    """
    digits = "".join(filter(str.isdigit, str(phone).strip()))
    if len(digits) == 10:
        return f"{default_country_code}{digits}"
    return digits


# ── Public API ─────────────────────────────────────────────────────────────────

async def send_whatsapp_template(
    to_number: str,
    message_type: MessageType,
    template_params: list[str],
    button_param: Optional[str] = None,
) -> str:
    """
    Send a WhatsApp template message via the Meta Cloud API.

    Args:
        to_number:       Recipient phone number in E.164 format, without the
                         leading ``+`` (e.g. ``919781085012``).
        message_type:    One of the recovery message types or INVOICE_PAYMENT.
        template_params: Ordered list of body parameter values that fill the
                         ``{{1}}``, ``{{2}}``, … placeholders in the template.
        button_param:    Optional dynamic URL slug for the template button.

    Returns:
        The Meta message ID string on success.

    Raises:
        RuntimeError: If credentials are missing or the API call fails.
        ValueError:   If no template is configured for ``message_type``.
    """
    access_token, phone_number_id = _load_credentials()

    template_name = TEMPLATE_MAP.get(message_type, "")
    if not template_name:
        raise ValueError(
            f"No WhatsApp template configured for message type '{message_type}'. "
            f"Set WA_TEMPLATE_{message_type} in your .env file."
        )

    api_version = os.environ.get("META_API_VERSION", "v25.0")
    lang_code = os.environ.get("WA_TEMPLATE_LANG", "en_US")

    components: list[dict[str, Any]] = [
        {
            "type": "body",
            "parameters": [
                {"type": "text", "text": str(p)} for p in template_params
            ],
        }
    ]

    if button_param:
        components.append({
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [
                {"type": "text", "text": str(button_param)}
            ],
        })

    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang_code},
            "components": components,
        },
    }

    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
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
        raise RuntimeError(
            f"Meta API HTTP {exc.response.status_code}: {exc.response.text}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Meta API call failed: {exc}") from exc

    message_id: str = data.get("messages", [{}])[0].get("id", "")
    return message_id


async def send_whatsapp_text(
    to_number: str,
    message_text: str,
) -> str:
    """
    Send a freeform WhatsApp text message via Meta Cloud API.

    Args:
        to_number: Recipient phone number with or without '+' / country code.
        message_text: The text body to send.

    Returns:
        The Meta message ID string on success.
    """
    access_token, phone_number_id = _load_credentials()
    api_version = os.environ.get("META_API_VERSION", "v25.0")
    recipient = normalize_phone_for_meta(to_number)

    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {
            "preview_url": True,
            "body": message_text,
        },
    }

    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
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
        raise RuntimeError(
            f"Meta API HTTP {exc.response.status_code}: {exc.response.text}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Meta API call failed: {exc}") from exc

    message_id: str = data.get("messages", [{}])[0].get("id", "")
    return message_id


async def send_invoice_whatsapp(
    to_number: str,
    company_name: str,
    invoice_name: str,
    invoice_amount: str | float,
    due_date_str: str,
    payment_link: str,
) -> str:
    """
    Send an invoice creation notification via WhatsApp.
    Tries template first (with payment_link/details), falls back to direct text if template doesn't match.
    """
    recipient = normalize_phone_for_meta(to_number)

    # Format amount with rupee symbol e.g. ₹15,000 or ₹15,000.00
    try:
        amt_num = float(str(invoice_amount).replace(",", "").replace("₹", ""))
        amt_str = f"₹{amt_num:,.2f}"
    except Exception:
        amt_str = f"₹{invoice_amount}"

    # Extract dynamic slug for the button from payment_link
    # e.g., if link is https://rzp.io/rzp/EyQvTbU and button is https://rzp.io/rzp/{{1}}, slug is EyQvTbU
    # if button is https://rzp.io/{{1}}, slug is rzp/EyQvTbU
    button_slug = payment_link.strip()
    prefix = os.environ.get("WA_BUTTON_URL_PREFIX", "https://rzp.io/rzp/").strip()
    if prefix and button_slug.startswith(prefix):
        button_slug = button_slug[len(prefix):]
    elif button_slug.startswith("https://rzp.io/"):
        button_slug = button_slug[len("https://rzp.io/"):]

    # Try approved template first
    try:
        return await send_whatsapp_template(
            to_number=recipient,
            message_type="INVOICE_PAYMENT",
            template_params=[company_name, invoice_name, amt_str, due_date_str],
            button_param=button_slug if button_slug else None,
        )
    except Exception as template_err:
        print(f"[whatsapp] Template 'invoice_payment' failed or in review: {template_err}")
        print("[whatsapp] Falling back to direct text message...")
        text_message = (
            f"Hello {company_name},\n\n"
            f"A new invoice *{invoice_name}* for *{amt_str}* has been generated.\n"
            f"📅 *Due Date:* {due_date_str}\n\n"
            f"💳 *You can pay securely online here:*\n{payment_link}\n\n"
            f"Thank you!"
        )
        return await send_whatsapp_text(recipient, text_message)
