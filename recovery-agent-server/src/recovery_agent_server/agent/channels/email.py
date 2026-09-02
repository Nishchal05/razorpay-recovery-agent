"""
Email channel — sends recovery messages via Gmail (OAuth2).

Delegates to the existing GmailService in
``recovery_agent_server.services.gmail_service``.

Required env vars (handled by gmail_service):
    GMAIL_CLIENT_ID
    GMAIL_CLIENT_SECRET
    GMAIL_REDIRECT_URI
    GMAIL_TOKEN_FILE      (optional)

Optional env vars:
    GMAIL_FROM_ADDRESS    — "From" address shown in the email header.
                            Defaults to the authenticated Gmail account.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING

from ...services.gmail_service import send_email

if TYPE_CHECKING:
    from ..recoveryagent import RecoveryState


# ── Subject lines per message type ───────────────────────────────────────────

_SUBJECTS: dict[str, str] = {
    "PAYMENT_REMINDER": "Payment Reminder — Invoice {invoice_name}",
    "PROMISE_FOLLOWUP": "Following Up on Your Payment — Invoice {invoice_name}",
    "OVERDUE_REMINDER": "Overdue Invoice Notice — {invoice_name}",
    "GENERAL_FOLLOWUP": "Invoice Follow-Up — {invoice_name}",
}


# ── Message builders ──────────────────────────────────────────────────────────

def _build_plain_body(state: "RecoveryState") -> str:
    """Return a plain-text body for the recovery email."""
    invoice = state["invoice"]
    payment_link = state.get("payment_link", "")
    message_type = state.get("message_type", "GENERAL_FOLLOWUP")
    companydetail = state.get("companydetail")

    invoice_name = invoice.get("invoice_name", "")
    amount = invoice.get("invoice_amount", "")
    company_name = getattr(companydetail, "company_name", "Valued Customer")

    if message_type == "PAYMENT_REMINDER":
        body = (
            f"Dear {company_name},\n\n"
            f"This is a friendly reminder regarding invoice {invoice_name}.\n\n"
            f"The outstanding amount is ₹{amount}.\n\n"
        )
        if payment_link:
            body += f"You can complete the payment using the link below:\n{payment_link}\n\n"
        body += "Please let us know if you have any questions.\n\nThank you."
        return body

    if message_type == "PROMISE_FOLLOWUP":
        return (
            f"Dear {company_name},\n\n"
            f"You previously mentioned that the payment for invoice {invoice_name} "
            f"would be completed soon.\n\n"
            f"The outstanding amount of ₹{amount} is still pending.\n\n"
            f"Could you please provide us with an updated payment date?\n\n"
            f"Thank you."
        )

    if message_type == "OVERDUE_REMINDER":
        return (
            f"Dear {company_name},\n\n"
            f"This is a reminder that invoice {invoice_name} for ₹{amount} "
            f"is currently overdue.\n\n"
            f"Please let us know when we can expect the payment.\n\n"
            f"Thank you."
        )

    # GENERAL_FOLLOWUP (fallback)
    return (
        f"Dear {company_name},\n\n"
        f"We are following up regarding invoice {invoice_name} with an "
        f"outstanding amount of ₹{amount}.\n\n"
        f"Please let us know if there is any issue with the payment.\n\n"
        f"Thank you."
    )


def _build_html_body(state: "RecoveryState") -> str:
    """Return an HTML body for the recovery email."""
    invoice = state["invoice"]
    payment_link = state.get("payment_link", "")
    message_type = state.get("message_type", "GENERAL_FOLLOWUP")
    companydetail = state.get("companydetail")

    invoice_name = invoice.get("invoice_name", "")
    amount = invoice.get("invoice_amount", "")
    company_name = getattr(companydetail, "company_name", "Valued Customer")

    payment_link_html = (
        f'<p><a href="{payment_link}" style="background:#4F46E5;color:#fff;'
        f'padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">'
        f'Pay Now</a></p>'
        if payment_link
        else ""
    )

    if message_type == "PAYMENT_REMINDER":
        body_inner = (
            f"<p>Dear <strong>{company_name}</strong>,</p>"
            f"<p>This is a friendly reminder regarding invoice "
            f"<strong>{invoice_name}</strong>.</p>"
            f"<p>The outstanding amount is <strong>₹{amount}</strong>.</p>"
            f"{payment_link_html}"
            f"<p>Please let us know if you have any questions.</p>"
            f"<p>Thank you.</p>"
        )

    elif message_type == "PROMISE_FOLLOWUP":
        body_inner = (
            f"<p>Dear <strong>{company_name}</strong>,</p>"
            f"<p>You previously mentioned that the payment for invoice "
            f"<strong>{invoice_name}</strong> would be completed soon.</p>"
            f"<p>The outstanding amount of <strong>₹{amount}</strong> is still pending.</p>"
            f"<p>Could you please provide us with an updated payment date?</p>"
            f"<p>Thank you.</p>"
        )

    elif message_type == "OVERDUE_REMINDER":
        body_inner = (
            f"<p>Dear <strong>{company_name}</strong>,</p>"
            f"<p>This is a reminder that invoice <strong>{invoice_name}</strong> "
            f"for <strong>₹{amount}</strong> is currently overdue.</p>"
            f"<p>Please let us know when we can expect the payment.</p>"
            f"<p>Thank you.</p>"
        )

    else:  # GENERAL_FOLLOWUP
        body_inner = (
            f"<p>Dear <strong>{company_name}</strong>,</p>"
            f"<p>We are following up regarding invoice <strong>{invoice_name}</strong> "
            f"with an outstanding amount of <strong>₹{amount}</strong>.</p>"
            f"<p>Please let us know if there is any issue with the payment.</p>"
            f"<p>Thank you.</p>"
        )

    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body {{ font-family: Arial, sans-serif; color: #333; line-height: 1.6; }}
    .container {{ max-width: 600px; margin: 40px auto; padding: 30px;
                  border: 1px solid #e5e7eb; border-radius: 8px; }}
    .header {{ background: #4F46E5; color: #fff; padding: 16px 24px;
               border-radius: 6px 6px 0 0; margin: -30px -30px 24px; }}
    .footer {{ margin-top: 32px; font-size: 12px; color: #9ca3af;
               border-top: 1px solid #e5e7eb; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h2 style="margin:0">Recovery Notice</h2></div>
    {body_inner}
    <div class="footer">This is an automated message. Please do not reply directly.</div>
  </div>
</body>
</html>
"""


# ── LangGraph node ────────────────────────────────────────────────────────────

async def send_email_message(state: "RecoveryState") -> dict:
    """
    LangGraph node: send a recovery email via Gmail.

    Reads from state:
        invoice         — dict with invoice_id, invoice_name, invoice_amount
        payment_link    — Razorpay payment link (may be empty string)
        message_type    — one of PAYMENT_REMINDER / PROMISE_FOLLOWUP /
                          OVERDUE_REMINDER / GENERAL_FOLLOWUP
        companydetail   — Prisma Company object; must have company_email and
                          company_name attributes

    Writes to state:
        email_sid       — Gmail message ID on success, empty string on failure
    """
    invoice = state["invoice"]
    message_type = state.get("message_type", "GENERAL_FOLLOWUP")
    companydetail = state.get("companydetail")

    print(f"[email] company details: {companydetail}")
    print(f"[email] sending message_type: {message_type}")

    # ── Resolve recipient email ───────────────────────────────────────────────
    customer_email = (
        getattr(companydetail, "company_email", None) if companydetail else None
    )

    if not customer_email:
        print(
            f"[email] no company_email for invoice {invoice.get('invoice_id')}"
        )
        return {"email_sid": ""}

    # ── Build subject ─────────────────────────────────────────────────────────
    invoice_name = invoice.get("invoice_name", "")
    subject_template = _SUBJECTS.get(
        message_type, "Invoice Follow-Up — {invoice_name}"
    )
    subject = subject_template.format(invoice_name=invoice_name)

    # ── Build bodies ──────────────────────────────────────────────────────────
    body_text = _build_plain_body(state)
    body_html = _build_html_body(state)

    from_email = os.environ.get("GMAIL_FROM_ADDRESS")

    # ── Send via Gmail service ────────────────────────────────────────────────
    try:
        result = send_email(
            to=customer_email,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            from_email=from_email,
        )
        message_id = result.get("id", "")
    except RuntimeError as exc:
        print(f"[email] Gmail send failed: {exc}")
        return {"email_sid": ""}
    except Exception as exc:
        print(f"[email] Unexpected error: {exc}")
        return {"email_sid": ""}

    print("================================")
    print("EMAIL SENT (Gmail API)")
    print("================================")
    print("Message ID:", message_id)
    print("To:", customer_email)

    return {"email_sid": message_id}
