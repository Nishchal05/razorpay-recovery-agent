import os
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from decimal import Decimal
import razorpay
from dotenv import load_dotenv

load_dotenv()

RAZORPAY_API_BASE = "https://api.razorpay.com/v1"


def get_razorpay_keys():
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "").strip()
    return key_id, key_secret, webhook_secret


def get_razorpay_client() -> Optional[razorpay.Client]:
    """Return an initialized Razorpay client if credentials are configured."""
    key_id, key_secret, _ = get_razorpay_keys()
    if not key_id or not key_secret:
        return None
    return razorpay.Client(auth=(key_id, key_secret))


def is_razorpay_configured() -> bool:
    """Check if Razorpay API keys are present in the environment."""
    key_id, key_secret, _ = get_razorpay_keys()
    return bool(key_id and key_secret)


async def generate_payment_link(
    amount: float | Decimal | int,
    description: str,
    customer_name: Optional[str] = None,
    customer_email: Optional[str] = None,
    customer_phone: Optional[str] = None,
    invoice_id: Optional[int | str] = None,
    invoice_name: Optional[str] = None,
    expire_in_days: int = 7,
    notify_by_razorpay: bool = False,
) -> Dict[str, Any]:
    """
    Generate a Razorpay Payment Link for an invoice.

    Args:
        amount: Invoice amount in INR (e.g., 2500.50). Will be converted to paise (amount * 100).
        description: Description of the payment (e.g., 'Payment for Invoice INV-1024').
        customer_name: Name of the debtor company or contact person.
        customer_email: Email address of the customer.
        customer_phone: Contact phone number of the customer.
        invoice_id: ID of the invoice in the database (stored in notes).
        invoice_name: Name/number of the invoice.
        expire_in_days: Link expiration duration in days (default: 7 days).
        notify_by_razorpay: Whether Razorpay should send automated SMS/Email (default: False, 
                            as our AI agent manages communication).

    Returns:
        Dict containing:
            - 'short_url': The payment URL to send to customer (e.g. https://rzp.io/i/abc1234)
            - 'payment_link_id': The Razorpay plink_id
            - 'status': Status ('created', etc.)
            - 'amount': Amount in INR
    """
    if not is_razorpay_configured():
        print("[razorpay_service] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set. Returning placeholder link.")
        return {
            "short_url": f"https://rzp.io/demo-pay-{invoice_id or 'inv'}",
            "payment_link_id": f"plink_demo_{invoice_id or '0'}",
            "status": "mock",
            "amount": float(amount),
            "currency": "INR",
        }

    # Convert amount to paise (smallest INR unit)
    amount_in_paise = int(round(float(amount) * 100))

    # Calculate expiration timestamp (Unix epoch in UTC)
    expire_timestamp = int((datetime.now(timezone.utc) + timedelta(days=expire_in_days)).timestamp())

    # Build customer dict (only include non-empty values)
    customer_data: Dict[str, Any] = {}
    if customer_name:
        customer_data["name"] = customer_name
    if customer_email:
        customer_data["email"] = customer_email
    if customer_phone:
        # Normalize phone: keep digits and leading '+'
        clean_phone = customer_phone.strip()
        if clean_phone.startswith("+"):
            customer_data["contact"] = "+" + "".join(filter(str.isdigit, clean_phone[1:]))
        else:
            customer_data["contact"] = "".join(filter(str.isdigit, clean_phone))

    notes = {}
    if invoice_id is not None:
        notes["invoice_id"] = str(invoice_id)
    if invoice_name:
        notes["invoice_name"] = str(invoice_name)

    payload: Dict[str, Any] = {
        "amount": amount_in_paise,
        "currency": "INR",
        "accept_partial": False,
        "description": description[:2048],
        "customer": customer_data,
        "notify": {
            "sms": notify_by_razorpay,
            "email": notify_by_razorpay,
        },
        "reminder_enable": False,
        "expire_by": expire_timestamp,
        "notes": notes,
    }

    key_id, key_secret, _ = get_razorpay_keys()
    url = f"{RAZORPAY_API_BASE}/payment_links"
    auth = (key_id, key_secret)

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(url, json=payload, auth=auth)
        if response.status_code not in [200, 201]:
            try:
                error_data = response.json()
                error_desc = error_data.get("error", {}).get("description", response.text)
            except Exception:
                error_desc = response.text
            raise Exception(f"Razorpay Payment Link creation failed ({response.status_code}): {error_desc}")

        data = response.json()
        return {
            "short_url": data.get("short_url", ""),
            "payment_link_id": data.get("id", ""),
            "status": data.get("status", "created"),
            "amount": float(amount),
            "currency": data.get("currency", "INR"),
            "raw": data,
        }


async def fetch_payment_link(payment_link_id: str) -> Dict[str, Any]:
    """Fetch status and details of an existing Razorpay Payment Link."""
    if not is_razorpay_configured():
        return {"id": payment_link_id, "status": "mock"}

    key_id, key_secret, _ = get_razorpay_keys()
    url = f"{RAZORPAY_API_BASE}/payment_links/{payment_link_id}"
    auth = (key_id, key_secret)

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, auth=auth)
        if response.status_code != 200:
            raise Exception(f"Failed to fetch Razorpay payment link: {response.text}")
        return response.json()


def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verify Razorpay webhook signature for payment verification."""
    _, _, webhook_secret = get_razorpay_keys()
    if not webhook_secret:
        return False
    try:
        client = get_razorpay_client()
        if not client:
            return False
        client.utility.verify_webhook_signature(
            body.decode("utf-8") if isinstance(body, bytes) else body,
            signature,
            webhook_secret,
        )
        return True
    except Exception:
        return False
