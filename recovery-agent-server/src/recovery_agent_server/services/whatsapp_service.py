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
from typing import Literal

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


# ── Public API ─────────────────────────────────────────────────────────────────

async def send_whatsapp_template(
    to_number: str,
    message_type: MessageType,
    template_params: list[str],
) -> str:
    """
    Send a WhatsApp template message via the Meta Cloud API.

    Args:
        to_number:       Recipient phone number in E.164 format, without the
                         leading ``+`` (e.g. ``919781085012``).
        message_type:    One of the four recovery message types — used to look
                         up the approved template name.
        template_params: Ordered list of body parameter values that fill the
                         ``{{1}}``, ``{{2}}``, … placeholders in the template.

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

    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": lang_code},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": p} for p in template_params
                    ],
                }
            ],
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
