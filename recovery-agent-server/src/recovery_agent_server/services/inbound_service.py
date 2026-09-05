"""
Inbound customer message processing service.

Handles incoming messages across channels (WhatsApp, Gmail):
1. Resolves customer Company and active Invoice by phone number, email, or invoice reference.
2. Uses Gemini LLM with structured output to classify customer intent:
   - INVOICE_QUERY: asking about amount, details, or payment link
   - PROMISE_TO_PAY: committed to paying on a future date
   - ALREADY_PAID: claims to have already completed the transaction
   - HUMAN_INTERVENTION: dispute, refusal, or request for a human
3. Verifies "already paid" claims automatically against Razorpay API.
4. Updates database state (PROMISE_TO_PAY, PAID, NEEDS_HUMAN_INTERVENTION, DISPUTE).
5. Persists conversation messages to the database.
6. Returns contextual AI replies for multi-channel dispatch.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, date, timedelta
from typing import Any, Dict, Optional, Literal

from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from ..database.prisma import client as db
from .razorpay_service import fetch_payment_link


# ============================================================
# 1. SCHEMAS
# ============================================================

class InboundAnalysis(BaseModel):
    intent: Literal["INVOICE_QUERY", "PROMISE_TO_PAY", "ALREADY_PAID", "HUMAN_INTERVENTION"] = Field(
        description=(
            "The primary intent of the customer message:\n"
            "- INVOICE_QUERY: customer asks how much is due, when it's due, asks for the payment link or breakdown.\n"
            "- PROMISE_TO_PAY: customer clearly commits to paying on a future date (e.g. 'I will pay on Monday', 'tomorrow').\n"
            "- ALREADY_PAID: customer claims they already paid, sent money, or completed payment.\n"
            "- HUMAN_INTERVENTION: customer refuses to pay, disputes the invoice/bill, or asks to speak with a human/support."
        )
    )
    promised_date: Optional[str] = Field(
        default=None,
        description="If intent is PROMISE_TO_PAY, the promised payment date in YYYY-MM-DD format based on today. Null if not specified."
    )
    reason: Optional[str] = Field(
        default=None,
        description="Reason for escalation if HUMAN_INTERVENTION (e.g. INVOICE_DISPUTE, PAYMENT_REFUSAL, CUSTOMER_REQUEST)."
    )
    customer_statement: str = Field(
        description="A concise 1-sentence summary of the customer's message or exact key quote."
    )


# ============================================================
# 2. DATABASE HELPERS
# ============================================================

async def save_message_to_db(invoice_id: int, content: str, message_type: Literal["RECEIVED", "SENT"]):
    """Save an incoming or outgoing message to the Postgres database."""
    try:
        if not db.is_connected():
            await db.connect()

        zero_vec = "[" + ",".join(["0.0"] * 1536) + "]"
        sql = (
            'INSERT INTO "Message" ("invoice_id", "content", "message_type", "embedding", "created_at") '
            'VALUES ($1, $2, $3::"MessageType", $4::vector, NOW())'
        )
        await db.execute_raw(sql, invoice_id, content, message_type, zero_vec)
    except Exception as exc:
        print(f"[inbound_service] Error saving message to db: {exc}")


async def resolve_invoice_by_phone(phone: str) -> Optional[Any]:
    """Find the active non-paid invoice for a given customer phone number."""
    if not db.is_connected():
        await db.connect()

    clean_digits = "".join(c for c in phone if c.isdigit())
    last_10 = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits

    # Find company matching phone
    companies = await db.company.find_many(include={"invoices": True})
    matched_company = None
    for c in companies:
        c_digits = "".join(ch for ch in (c.company_phone or "") if ch.isdigit())
        if last_10 and last_10 in c_digits:
            matched_company = c
            break

    if not matched_company:
        return None

    # Find the most recent active/overdue invoice for this company
    invoice = await db.invoice.find_first(
        where={
            "company_id": matched_company.company_id,
            "invoice_status": {"not": "PAID"},
            "invoice_amount_status": False,
        },
        order={"created_at": "desc"},
        include={"company": True},
    )

    # If all paid, return the most recent invoice anyway
    if not invoice:
        invoice = await db.invoice.find_first(
            where={"company_id": matched_company.company_id},
            order={"created_at": "desc"},
            include={"company": True},
        )

    return invoice


async def resolve_invoice_by_email(email: str, text_context: str = "") -> Optional[Any]:
    """Find active invoice by customer email or invoice number mentioned in text."""
    if not db.is_connected():
        await db.connect()

    # First check if an invoice name is explicitly mentioned in text (e.g. Invoice #invkg, inv-2020, inv499)
    named_match = re.search(r"invoice\s*#?\s*([a-zA-Z0-9_-]+)", text_context, re.IGNORECASE)
    if named_match and named_match.group(1).lower() not in ["reminder", "notice", "details", "update"]:
        inv_candidate = named_match.group(1).strip()
        invoice = await db.invoice.find_first(
            where={"invoice_name": {"equals": inv_candidate, "mode": "insensitive"}},
            include={"company": True},
        )
        if invoice:
            return invoice

    for word in re.findall(r"\b(inv[-_]?[0-9a-zA-Z]+)\b", text_context, re.IGNORECASE):
        if word.lower() not in ["invoice", "invoices", "invoiced"]:
            invoice = await db.invoice.find_first(
                where={"invoice_name": {"equals": word, "mode": "insensitive"}},
                include={"company": True},
            )
            if invoice:
                return invoice

    # Otherwise match by company email
    company = await db.company.find_first(
        where={"company_email": {"equals": email.strip(), "mode": "insensitive"}},
        include={"invoices": True},
    )

    if not company:
        return None

    invoice = await db.invoice.find_first(
        where={
            "company_id": company.company_id,
            "invoice_status": {"not": "PAID"},
            "invoice_amount_status": False,
        },
        order={"created_at": "desc"},
        include={"company": True},
    )

    if not invoice:
        invoice = await db.invoice.find_first(
            where={"company_id": company.company_id},
            order={"created_at": "desc"},
            include={"company": True},
        )

    return invoice


# ============================================================
# 3. LLM CLASSIFIER
# ============================================================

def _get_llm():
    """Instantiate Gemini model for structured intent extraction."""
    api_key = os.environ.get("GOOGLE_API_KEY", "")
    return ChatGoogleGenerativeAI(
        model="gemini-3.5-flash-lite",
        google_api_key=api_key,
        temperature=0.0,
    )


async def analyze_message_intent(message_text: str, invoice_info: Dict[str, Any]) -> InboundAnalysis:
    """Analyze customer message and return structured intent."""
    today_str = date.today().strftime("%Y-%m-%d")
    weekday_str = date.today().strftime("%A")

    prompt = (
        f"You are an AI assistant processing customer replies to receivables payment reminders.\n"
        f"Today's date is: {today_str} ({weekday_str}).\n"
        f"Invoice details:\n"
        f"- Invoice Name: {invoice_info.get('invoice_name', '')}\n"
        f"- Invoice Amount: ₹{invoice_info.get('invoice_amount', '')}\n"
        f"- Due Date: {invoice_info.get('invoice_due_date', '')}\n"
        f"- Customer Name: {invoice_info.get('customer_name', '')}\n\n"
        f"Customer message: \"{message_text}\"\n\n"
        f"Instructions:\n"
        f"1. Classify the customer's intent into exactly one of: INVOICE_QUERY, PROMISE_TO_PAY, ALREADY_PAID, HUMAN_INTERVENTION.\n"
        f"2. If customer says they already paid, sent money, or cleared the bill, classify as ALREADY_PAID.\n"
        f"3. If customer gives a specific future date they will pay ('I will pay on Monday', 'tomorrow', 'by 15th'), "
        f"classify as PROMISE_TO_PAY and calculate the exact YYYY-MM-DD date based on today ({today_str}).\n"
        f"4. If customer is asking for invoice amount, payment link, due date, or bill details, classify as INVOICE_QUERY.\n"
        f"5. If customer refuses, disputes, or asks for a human, classify as HUMAN_INTERVENTION with a reason.\n"
    )

    try:
        llm = _get_llm()
        structured_llm = llm.with_structured_output(InboundAnalysis)
        analysis: InboundAnalysis = await structured_llm.ainvoke(prompt)
        return analysis
    except Exception as exc:
        print(f"[inbound_service] LLM classification error: {exc}. Using heuristic fallback.")
        return _fallback_classification(message_text)


def _fallback_classification(text: str) -> InboundAnalysis:
    """Heuristic fallback if LLM call is unavailable."""
    lower = text.lower()

    if any(p in lower for p in ["already paid", "payment done", "paid today", "money sent", "transferred", "paid"]):
        return InboundAnalysis(
            intent="ALREADY_PAID",
            customer_statement=text.strip(),
        )

    if any(p in lower for p in ["will pay", "pay on", "pay tomorrow", "pay monday", "pay next", "by friday"]):
        # Default next 3 days
        next_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
        return InboundAnalysis(
            intent="PROMISE_TO_PAY",
            promised_date=next_date,
            customer_statement=text.strip(),
        )

    if any(p in lower for p in ["wrong", "dispute", "won't pay", "will not pay", "cancel", "speak to", "manager", "human"]):
        return InboundAnalysis(
            intent="HUMAN_INTERVENTION",
            reason="INVOICE_DISPUTE" if "dispute" in lower or "wrong" in lower else "HUMAN_ASSISTANCE_REQUESTED",
            customer_statement=text.strip(),
        )

    return InboundAnalysis(
        intent="INVOICE_QUERY",
        customer_statement=text.strip(),
    )


# ============================================================
# 4. CORE PIPELINE: PROCESS INBOUND MESSAGE
# ============================================================

async def process_inbound_message(
    incoming_text: str,
    invoice: Any,
    channel: Literal["WHATSAPP", "EMAIL"],
) -> Dict[str, Any]:
    """
    Process an incoming customer reply for an invoice.
    Updates DB status, logs messages, and generates reply text.
    """
    if not invoice:
        return {
            "success": False,
            "reply_text": "We received your message, but could not identify the associated invoice. Our support team will assist you.",
            "intent": "UNKNOWN",
        }

    invoice_id = invoice.invoice_id
    invoice_name = invoice.invoice_name
    invoice_amount = str(invoice.invoice_amount)
    due_date = invoice.invoice_due_date.strftime("%Y-%m-%d") if hasattr(invoice.invoice_due_date, "strftime") else str(invoice.invoice_due_date)[:10]
    payment_link = invoice.payment_link or ""
    customer_name = invoice.company.company_name if invoice.company else "Valued Customer"

    # 1. Log incoming message in database
    await save_message_to_db(invoice_id=invoice_id, content=incoming_text, message_type="RECEIVED")

    # 2. Analyze intent using LLM
    invoice_context = {
        "invoice_id": invoice_id,
        "invoice_name": invoice_name,
        "invoice_amount": invoice_amount,
        "invoice_due_date": due_date,
        "customer_name": customer_name,
    }
    analysis = await analyze_message_intent(incoming_text, invoice_context)
    intent = analysis.intent

    reply_text = ""
    updated_status = invoice.recovery_status

    # ------------------------------------------------------------
    # A. INTENT: ALREADY_PAID
    # ------------------------------------------------------------
    if intent == "ALREADY_PAID":
        print(f"[inbound_service] Customer claims ALREADY_PAID for invoice {invoice_name}. Verifying with Razorpay...")
        
        is_paid = False
        if invoice.payment_link_id:
            try:
                rzp_data = await fetch_payment_link(invoice.payment_link_id)
                status_from_rzp = rzp_data.get("status", "").lower()
                print(f"[inbound_service] Razorpay link status: {status_from_rzp}")
                if status_from_rzp == "paid":
                    is_paid = True
            except Exception as rzp_err:
                print(f"[inbound_service] Error verifying payment link on Razorpay: {rzp_err}")

        # Check if already marked paid in DB
        if invoice.invoice_amount_status or invoice.invoice_status == "PAID":
            is_paid = True

        if is_paid:
            # Verified! Mark Paid
            await db.invoice.update(
                where={"invoice_id": invoice_id},
                data={
                    "invoice_amount_status": True,
                    "invoice_status": "PAID",
                    "recovery_status": "PAID",
                    "customer_statement": incoming_text,
                },
            )
            updated_status = "PAID"
            reply_text = (
                f"Thank you, {customer_name}! We have verified your payment for invoice {invoice_name}. "
                f"Your payment of ₹{invoice_amount} has been successfully received. Have a wonderful day!"
            )
        else:
            # Unverified claim -> Escalate to human review
            await db.invoice.update(
                where={"invoice_id": invoice_id},
                data={
                    "recovery_status": "NEEDS_HUMAN_INTERVENTION",
                    "human_intervention_reason": "CUSTOMER_CLAIMS_PAID",
                    "customer_statement": incoming_text,
                },
            )
            updated_status = "NEEDS_HUMAN_INTERVENTION"
            reply_text = (
                f"Thank you for informing us. We checked our automated records for invoice {invoice_name} "
                f"but could not yet confirm receipt of the payment. We have forwarded this to our finance team "
                f"for manual bank verification. If you have a payment screenshot or transaction/UTR reference, "
                f"please reply with it here so we can reconcile it right away."
            )

    # ------------------------------------------------------------
    # B. INTENT: PROMISE_TO_PAY
    # ------------------------------------------------------------
    elif intent == "PROMISE_TO_PAY":
        promised_date_str = analysis.promised_date
        if not promised_date_str:
            # Ambiguous date
            reply_text = (
                f"Thank you, {customer_name}. Could you please specify the exact date by which you expect "
                f"to complete the payment for invoice {invoice_name}?"
            )
        else:
            try:
                dt = datetime.strptime(promised_date_str.strip(), "%Y-%m-%d")
                promised_datetime = datetime(dt.year, dt.month, dt.day, 23, 59, 59)

                await db.invoice.update(
                    where={"invoice_id": invoice_id},
                    data={
                        "recovery_status": "PROMISE_TO_PAY",
                        "promised_date": promised_datetime,
                        "customer_statement": incoming_text,
                    },
                )
                updated_status = "PROMISE_TO_PAY"
                reply_text = (
                    f"Thank you for confirming, {customer_name}. We have recorded your payment commitment "
                    f"for invoice {invoice_name} by {promised_date_str}. Automated reminder notifications have "
                    f"been paused until then. You can complete the payment anytime using: {payment_link}"
                )
            except Exception as dt_err:
                print(f"[inbound_service] Date parse error: {dt_err}")
                reply_text = f"Thank you. Could you please confirm the exact date (YYYY-MM-DD) you plan to clear invoice {invoice_name}?"

    # ------------------------------------------------------------
    # C. INTENT: HUMAN_INTERVENTION / DISPUTE
    # ------------------------------------------------------------
    elif intent == "HUMAN_INTERVENTION":
        reason = analysis.reason or "CUSTOMER_DISPUTE"
        update_data = {
            "recovery_status": "NEEDS_HUMAN_INTERVENTION",
            "human_intervention_reason": reason,
            "customer_statement": incoming_text,
        }
        if "DISPUTE" in reason.upper() or "WRONG" in reason.upper():
            update_data["invoice_status"] = "DISPUTE"

        await db.invoice.update(
            where={"invoice_id": invoice_id},
            data=update_data,
        )
        updated_status = "NEEDS_HUMAN_INTERVENTION"
        reply_text = (
            f"Understood, {customer_name}. We have paused automated reminders for invoice {invoice_name} "
            f"and escalated your case to our management and support team. A representative will review your message "
            f"and contact you shortly to assist."
        )

    # ------------------------------------------------------------
    # D. INTENT: INVOICE_QUERY
    # ------------------------------------------------------------
    else:
        # Generate informative response
        link_msg = f"\nPayment Link: {payment_link}" if payment_link else ""
        reply_text = (
            f"Hello {customer_name},\n"
            f"Here are the details for invoice {invoice_name}:\n"
            f"• Outstanding Amount: ₹{invoice_amount}\n"
            f"• Due Date: {due_date}\n"
            f"• Current Status: {invoice.invoice_status}\n"
            f"{link_msg}\n\n"
            f"Please let us know if you have any questions or need further assistance."
        )

    # 3. Log outgoing reply in database
    await save_message_to_db(invoice_id=invoice_id, content=reply_text, message_type="SENT")

    return {
        "success": True,
        "intent": intent,
        "invoice_id": invoice_id,
        "invoice_name": invoice_name,
        "recovery_status": updated_status,
        "reply_text": reply_text,
    }
