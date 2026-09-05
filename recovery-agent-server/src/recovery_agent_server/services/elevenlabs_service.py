"""
ElevenLabs Conversational AI Voice Agent (JEA) Service.

Handles:
- Loading configuration from environment variables (ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_WEBHOOK_SECRET).
- Extracting dynamic variables from Invoice and Company records for JEA's context.
- Generating temporary signed conversation URLs for safe client-side voice streaming (never exposing API keys).
- Initiating outbound telephony calls via ElevenLabs phone API where configured.
- Webhook signature verification for ElevenLabs events.
"""

from __future__ import annotations

import os
import hmac
import hashlib
from datetime import datetime
from typing import Any, Dict, Optional
import httpx

ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"


def get_api_key() -> str:
    return os.environ.get("ELEVENLABS_API_KEY", "").strip()


def get_agent_id() -> str:
    return os.environ.get("ELEVENLABS_AGENT_ID", "").strip()


def get_webhook_secret() -> str:
    return os.environ.get("ELEVENLABS_WEBHOOK_SECRET", "").strip()


def is_configured() -> bool:
    """Check if ElevenLabs credentials are set."""
    return bool(get_api_key() and get_agent_id())


def format_due_date(due_date: Any) -> str:
    """Format due date string or datetime into YYYY-MM-DD."""
    if isinstance(due_date, datetime):
        return due_date.strftime("%Y-%m-%d")
    if isinstance(due_date, str):
        try:
            clean = due_date.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean)
            return dt.strftime("%Y-%m-%d")
        except Exception:
            return due_date[:10] if len(due_date) >= 10 else due_date
    return str(due_date)


def build_invoice_dynamic_variables(
    invoice: Dict[str, Any],
    company: Optional[Any] = None,
    business_name: Optional[str] = None,
) -> Dict[str, str]:
    """
    Build context variables for JEA.
    
    JEA must strictly receive:
    - customer_name
    - company_name (service provider)
    - invoice_number
    - invoice_amount
    - currency
    - due_date
    """
    if company is not None:
        if isinstance(company, dict):
            customer_name = company.get("company_name", "Valued Customer")
            customer_phone = company.get("company_phone", "")
        else:
            customer_name = getattr(company, "company_name", "Valued Customer")
            customer_phone = getattr(company, "company_phone", "")
    else:
        customer_name = "Valued Customer"
        customer_phone = ""

    provider_name = business_name or "Our Company"
    inv_name = invoice.get("invoice_name", "")
    inv_amount = str(invoice.get("invoice_amount", "0"))
    inv_due_date = format_due_date(invoice.get("invoice_due_date", ""))

    return {
        "customer_name": customer_name,
        "company_name": provider_name,
        "invoice_number": inv_name,
        "invoice_amount": inv_amount,
        "currency": "INR",
        "due_date": inv_due_date,
        "customer_phone": customer_phone,
    }


async def get_signed_conversation_url(
    agent_id: Optional[str] = None,
    dynamic_variables: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Generate a signed URL for client-side Conversational AI session.
    Protects ELEVENLABS_API_KEY from ever being exposed to the browser.
    """
    api_key = get_api_key()
    resolved_agent_id = agent_id or get_agent_id()

    if not api_key:
        raise ValueError("ELEVENLABS_API_KEY environment variable is not configured.")
    if not resolved_agent_id:
        raise ValueError("ELEVENLABS_AGENT_ID environment variable is not configured.")

    endpoint = f"{ELEVENLABS_BASE_URL}/convai/conversation/get-signed-url"
    headers = {
        "xi-api-key": api_key,
    }
    params = {
        "agent_id": resolved_agent_id,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(endpoint, headers=headers, params=params)

        if response.status_code != 200:
            err_msg = response.text
            raise RuntimeError(
                f"Failed to generate ElevenLabs signed URL ({response.status_code}): {err_msg}"
            )

        data = response.json()
        return {
            "signed_url": data.get("signed_url"),
            "agent_id": resolved_agent_id,
            "dynamic_variables": dynamic_variables or {},
        }


def get_phone_number_id() -> str:
    return os.environ.get("ELEVENLABS_PHONE_NUMBER_ID", "").strip()


async def get_or_fetch_phone_number_id(api_key: str) -> Optional[str]:
    """Return configured ELEVENLABS_PHONE_NUMBER_ID or fetch the first assigned number."""
    env_id = get_phone_number_id()
    if env_id:
        return env_id

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(
                f"{ELEVENLABS_BASE_URL}/convai/phone-numbers",
                headers={"xi-api-key": api_key},
            )
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list) and len(data) > 0:
                    return data[0].get("phone_number_id")
    except Exception as err:
        print(f"[elevenlabs] Warning: could not auto-fetch phone number ID: {err}")

    return None


async def initiate_outbound_phone_call(
    to_phone: str,
    dynamic_variables: Dict[str, str],
    agent_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Trigger an outbound phone call via ElevenLabs Conversational AI telephony integration (Twilio/SIP).
    Injects dynamic variables (customer_name, invoice details) into the call.
    """
    api_key = get_api_key()
    resolved_agent_id = agent_id or get_agent_id()

    if not api_key or not resolved_agent_id:
        raise ValueError("ElevenLabs credentials are not configured.")

    phone_number_id = await get_or_fetch_phone_number_id(api_key)

    if not phone_number_id:
        return {
            "call_sid": f"call_manual_{int(datetime.now().timestamp())}",
            "status": "TELEPHONY_NOT_CONFIGURED",
            "message": "Outbound cellular calls require an ELEVENLABS_PHONE_NUMBER_ID (configured under ElevenLabs Telephony/Twilio).",
            "code": 400,
        }

    # Ensure phone number is in E.164 format (+ prefixed with country code)
    clean_digits = "".join(c for c in to_phone if c.isdigit())
    if len(clean_digits) == 10:
        formatted_to_phone = f"+91{clean_digits}"
    elif to_phone.strip().startswith("+"):
        formatted_to_phone = f"+{clean_digits}"
    else:
        formatted_to_phone = f"+{clean_digits}"

    endpoint = f"{ELEVENLABS_BASE_URL}/convai/twilio/outbound-call"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "agent_id": resolved_agent_id,
        "agent_phone_number_id": phone_number_id,
        "to_number": formatted_to_phone,
        "conversation_initiation_client_data": {
            "type": "conversation_initiation_client_data",
            "dynamic_variables": dynamic_variables,
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(endpoint, headers=headers, json=payload)
        if response.status_code in (200, 201, 202):
            return response.json()

        return {
            "call_sid": f"call_manual_{int(datetime.now().timestamp())}",
            "status": "FAILED",
            "message": f"Telephony dispatch response: {response.text}",
            "code": response.status_code,
        }


def verify_webhook_signature(
    raw_body: bytes,
    signature_header: Optional[str],
) -> bool:
    """
    Verify HMAC signature of incoming ElevenLabs webhook if ELEVENLABS_WEBHOOK_SECRET is set.
    If secret is not set, allows development requests.
    """
    secret = get_webhook_secret()
    if not secret:
        return True

    if not signature_header:
        return False

    try:
        expected_sig = hmac.new(
            secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_sig, signature_header)
    except Exception:
        return False
