import os
from datetime import datetime
from typing import Optional, Dict, Any
from .gmail_service import send_email, is_authenticated as is_gmail_authenticated
from .whatsapp_service import (
    send_invoice_whatsapp,
    send_whatsapp_text,
    is_configured as is_whatsapp_configured,
)


def format_due_date(due_date: Any) -> str:
    """Helper to format a due date string or datetime into DD-MMM-YYYY."""
    if isinstance(due_date, datetime):
        return due_date.strftime("%d %b %Y")
    if isinstance(due_date, str):
        try:
            clean = due_date.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean)
            return dt.strftime("%d %b %Y")
        except Exception:
            return due_date
    return str(due_date)


async def send_invoice_created_notifications(
    customer_name: str,
    customer_email: Optional[str],
    customer_phone: Optional[str],
    invoice_name: str,
    invoice_amount: float | int | str,
    invoice_due_date: Any,
    payment_link: str,
    business_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dispatch both WhatsApp and Gmail notifications to the customer upon invoice generation.
    """
    due_date_str = format_due_date(invoice_due_date)
    sender_name = business_name or "Recovery Agent"
    formatted_amount = f"₹{float(invoice_amount):,.2f}"

    results = {
        "email_sent": False,
        "whatsapp_sent": False,
        "email_error": None,
        "whatsapp_error": None,
    }

    # ── 1. Send via Gmail ──────────────────────────────────────────────────────
    if customer_email and is_gmail_authenticated():
        subject = f"Invoice #{invoice_name} from {sender_name} (Due: {due_date_str})"

        body_text = (
            f"Dear {customer_name},\n\n"
            f"A new invoice has been generated for your account by {sender_name}.\n\n"
            f"INVOICE DETAILS:\n"
            f"----------------------------------------\n"
            f"Invoice Number : {invoice_name}\n"
            f"Amount Due     : {formatted_amount}\n"
            f"Due Date       : {due_date_str}\n\n"
            f"You can pay your invoice securely online using the Razorpay link below:\n"
            f"{payment_link}\n\n"
            f"If you have already made this payment or have any queries, please let us know.\n\n"
            f"Best regards,\n"
            f"{sender_name}"
        )

        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 24px; margin: 0; }}
            .card {{ max-width: 520px; margin: 0 auto; background: #0f1117; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
            .header-bar {{ height: 4px; background: linear-gradient(90deg, #6366f1, #a855f7, #6366f1); }}
            .content {{ padding: 32px; }}
            .badge {{ display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(99,102,241,0.15); color: #818cf8; font-size: 12px; font-weight: 600; margin-bottom: 16px; }}
            h2 {{ margin: 0 0 8px 0; color: #ffffff; font-size: 22px; font-weight: 700; }}
            p {{ color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }}
            .details-box {{ background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px; }}
            .row {{ display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }}
            .row:last-child {{ margin-bottom: 0; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }}
            .label {{ color: #71717a; }}
            .val {{ color: #ffffff; font-weight: 600; text-align: right; }}
            .amount {{ font-size: 20px; color: #34d399; font-weight: 700; }}
            .btn-container {{ text-align: center; margin-top: 24px; }}
            .btn {{ display: inline-block; padding: 14px 32px; background: #4f46e5; color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(79,70,229,0.4); }}
            .footer {{ text-align: center; margin-top: 24px; font-size: 12px; color: #52525b; }}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-bar"></div>
            <div class="content">
              <span class="badge">Invoice Issued</span>
              <h2>New Invoice from {sender_name}</h2>
              <p>Hello {customer_name}, an invoice has been issued and is ready for payment.</p>
              
              <div class="details-box">
                <div class="row">
                  <span class="label">Invoice Name:</span>
                  <span class="val">{invoice_name}</span>
                </div>
                <div class="row">
                  <span class="label">Due Date:</span>
                  <span class="val">{due_date_str}</span>
                </div>
                <div class="row">
                  <span class="label">Amount Due:</span>
                  <span class="val amount">{formatted_amount}</span>
                </div>
              </div>

              <div class="btn-container">
                <a href="{payment_link}" class="btn" target="_blank">Pay {formatted_amount} Online</a>
              </div>
              <p style="margin-top: 16px; font-size: 12px; color: #71717a; text-align: center;">Secure payment processed by Razorpay</p>
            </div>
          </div>
          <div class="footer">Sent automatically via Recovery Agent</div>
        </body>
        </html>
        """

        try:
            send_email(to=customer_email, subject=subject, body_text=body_text, body_html=body_html)
            results["email_sent"] = True
            print(f"[notifications] Email sent to {customer_email} for invoice {invoice_name}")
        except Exception as exc:
            results["email_error"] = str(exc)
            print(f"[notifications] Email send failed: {exc}")
    else:
        if not customer_email:
            results["email_error"] = "No customer email provided"
        elif not is_gmail_authenticated():
            results["email_error"] = "Gmail is not authorized (visit /auth/gmail to connect)"

    # ── 2. Send via WhatsApp ───────────────────────────────────────────────────
    if customer_phone and is_whatsapp_configured():
        try:
            msg_id = await send_invoice_whatsapp(
                to_number=customer_phone,
                company_name=customer_name,
                invoice_name=invoice_name,
                invoice_amount=invoice_amount,
                due_date_str=due_date_str,
                payment_link=payment_link,
            )
            results["whatsapp_sent"] = True
            print(f"[notifications] WhatsApp message sent (ID: {msg_id}) to {customer_phone}")
        except Exception as exc:
            results["whatsapp_error"] = str(exc)
            print(f"[notifications] WhatsApp send failed: {exc}")
    else:
        if not customer_phone:
            results["whatsapp_error"] = "No customer phone provided"
        elif not is_whatsapp_configured():
            results["whatsapp_error"] = "Meta WhatsApp credentials not configured"

    return results


async def send_payment_received_notifications(
    customer_name: str,
    customer_email: Optional[str],
    customer_phone: Optional[str],
    invoice_name: str,
    invoice_amount: float | int | str,
    payment_reference: Optional[str] = None,
    business_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dispatch thank-you confirmation with invoice details via both WhatsApp and Gmail upon payment completion.
    """
    sender_name = business_name or "Recovery Agent"
    formatted_amount = f"₹{float(invoice_amount):,.2f}"
    ref_str = payment_reference or "Razorpay Payment"
    date_str = datetime.now().strftime("%d %b %Y, %I:%M %p")

    results = {
        "email_sent": False,
        "whatsapp_sent": False,
        "email_error": None,
        "whatsapp_error": None,
    }

    # ── 1. Send via Gmail ──────────────────────────────────────────────────────
    if customer_email and is_gmail_authenticated():
        subject = f"Payment Receipt — Invoice #{invoice_name} Paid Successfully"

        body_text = (
            f"Dear {customer_name},\n\n"
            f"Thank you for your payment! We have successfully received payment for invoice #{invoice_name}.\n\n"
            f"PAYMENT RECEIPT:\n"
            f"----------------------------------------\n"
            f"Invoice Number : {invoice_name}\n"
            f"Amount Paid    : {formatted_amount}\n"
            f"Status         : PAID (Completed)\n"
            f"Date           : {date_str}\n"
            f"Reference      : {ref_str}\n\n"
            f"All automated recovery notifications and reminders for this invoice have been closed.\n"
            f"Thank you for your valued business!\n\n"
            f"Best regards,\n"
            f"{sender_name}"
        )

        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0a; color: #ffffff; padding: 24px; margin: 0; }}
            .card {{ max-width: 520px; margin: 0 auto; background: #0f1117; border: 1px solid rgba(16,185,129,0.3); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
            .header-bar {{ height: 4px; background: linear-gradient(90deg, #10b981, #059669, #34d399); }}
            .content {{ padding: 32px; }}
            .badge {{ display: inline-block; padding: 6px 14px; border-radius: 999px; background: rgba(16,185,129,0.15); color: #34d399; font-size: 13px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }}
            h2 {{ margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 700; }}
            p {{ color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }}
            .details-box {{ background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin-bottom: 24px; }}
            .row {{ display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }}
            .row:last-child {{ margin-bottom: 0; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); }}
            .label {{ color: #71717a; }}
            .val {{ color: #ffffff; font-weight: 600; text-align: right; }}
            .amount {{ font-size: 22px; color: #34d399; font-weight: 700; }}
            .status-tag {{ color: #34d399; font-weight: 700; }}
            .footer {{ text-align: center; margin-top: 24px; font-size: 12px; color: #52525b; }}
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-bar"></div>
            <div class="content">
              <span class="badge">Payment Received ✓</span>
              <h2>Thank You for Your Payment!</h2>
              <p>Hello <strong>{customer_name}</strong>, your payment for invoice <strong>#{invoice_name}</strong> has been confirmed.</p>
              
              <div class="details-box">
                <div class="row">
                  <span class="label">Invoice:</span>
                  <span class="val">#{invoice_name}</span>
                </div>
                <div class="row">
                  <span class="label">Payment Date:</span>
                  <span class="val">{date_str}</span>
                </div>
                <div class="row">
                  <span class="label">Reference:</span>
                  <span class="val">{ref_str}</span>
                </div>
                <div class="row">
                  <span class="label">Status:</span>
                  <span class="val status-tag">PAID</span>
                </div>
                <div class="row">
                  <span class="label">Total Amount Paid:</span>
                  <span class="val amount">{formatted_amount}</span>
                </div>
              </div>

              <p style="margin-top: 16px; font-size: 13px; color: #71717a; text-align: center;">All pending reminders for this invoice have been resolved.</p>
            </div>
          </div>
          <div class="footer">Automated Payment Receipt • Recovery Agent</div>
        </body>
        </html>
        """

        try:
            send_email(to=customer_email, subject=subject, body_text=body_text, body_html=body_html)
            results["email_sent"] = True
            print(f"[notifications] Thank-you payment email sent to {customer_email} for invoice {invoice_name}")
        except Exception as exc:
            results["email_error"] = str(exc)
            print(f"[notifications] Thank-you payment email failed: {exc}")

    # ── 2. Send via WhatsApp ───────────────────────────────────────────────────
    if customer_phone and is_whatsapp_configured():
        whatsapp_body = (
            f"✅ *Payment Received — Thank You!*\n\n"
            f"Dear *{customer_name}*,\n\n"
            f"We have successfully received your payment for invoice *{invoice_name}*.\n\n"
            f"📋 *Payment Summary:*\n"
            f"• Invoice: *{invoice_name}*\n"
            f"• Amount Paid: *{formatted_amount}*\n"
            f"• Status: *PAID (Completed)*\n"
            f"• Date: *{date_str}*\n"
            f"• Reference: *{ref_str}*\n\n"
            f"All reminders for this invoice are now closed. Thank you for your business! 🙏"
        )
        try:
            msg_id = await send_whatsapp_text(to_number=customer_phone, message_text=whatsapp_body)
            results["whatsapp_sent"] = True
            print(f"[notifications] Thank-you payment WhatsApp sent (ID: {msg_id}) to {customer_phone}")
        except Exception as exc:
            results["whatsapp_error"] = str(exc)
            print(f"[notifications] Thank-you payment WhatsApp failed: {exc}")

    return results
