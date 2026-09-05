"""
B2B Receivables Recovery Agent — LangGraph workflow.

Fixes applied vs. the original draft:
1. `build_message()` was dead code — it referenced `state["decision"]`, a key
   that never existed in RecoveryState, and was never called by any node.
   It's now wired in properly, driven by a `message_type` field the LLM
   returns as part of its structured decision.
2. `send_message()` hardcoded a single WhatsApp number. It now pulls the
   real customer number from the invoice/company record.
3. WhatsApp delivery is now handled directly via the Meta WhatsApp Cloud API
   (graph.facebook.com) — no Twilio dependency.
4. The "never send more than 3 reminders" rule was ONLY a prompt
   instruction — an LLM can ignore prompt instructions. It's now also
   enforced in code (a real guardrail, not a suggestion): the reminder
   count is computed from the DB and hard-overrides the LLM if it's
   already at the cap.
5. Added defensive handling for the case where `structured_response` is
   missing from the agent result (a known intermittent LangChain issue)
   — falls back to human_review instead of crashing.
6. Wrapped all external calls (LLM, Meta API, Razorpay, DB) in try/except
   so one failure doesn't take down the whole graph run.
7. Added a `promise_to_pay_date` field so a customer's "I'll pay Monday"
   response actually gets captured as structured data instead of living
   only inside free-text conversation history.
8. RecoveryState now declares every key nodes actually write, so the
   graph is internally consistent.

Assumptions you'll need to adjust to your real schema (marked with
`# ASSUMPTION` comments below):
- `invoice` dict has `invoice_id`, `invoice_name`, `invoice_amount`,
  `company_id`, and `customer_phone`.
- `message.message_type` uses the string "REMINDER" for automated
  outbound reminders (used to compute the 3-reminder cap).
- There's a Prisma model to persist escalations — replace the TODO in
  `human_review` with your actual model name.
"""

from typing import Any, Literal, Optional, TypedDict

from pydantic import BaseModel, Field
import httpx
import json
import os

from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END

from ..database.prisma import client as db


# ============================================================
# CONFIG
# ============================================================

MAX_AUTOMATED_REMINDERS = 3

from datetime import datetime, date

# Channel node imports
# TEMPLATE_MAP has been moved to agent/channels/whatsapp.py
from .channels.whatsapp import send_whatsapp_message  # noqa: E402
from .channels.email import send_email_message  # noqa: E402
from .channels.voice import call_voice_agent  # noqa: E402
from ..services.razorpay_service import generate_payment_link


# ============================================================
# 1. AI DECISION SCHEMA
# ============================================================

class RecoveryDecision(BaseModel):
    send_message: bool = Field(
        description="Whether an automated WhatsApp message should be sent."
    )

    create_payment_link: bool = Field(
        description="Whether a Razorpay payment link should be created."
    )

    human_intervention: bool = Field(
        description="Whether the case must be reviewed by a human."
    )

    message_type: Literal[
        "PAYMENT_REMINDER",
        "PROMISE_FOLLOWUP",
        "OVERDUE_REMINDER",
        "GENERAL_FOLLOWUP",
    ] = Field(
        description=(
            "Which kind of message this is, if send_message is true. "
            "PAYMENT_REMINDER: no prior contact, first nudge. "
            "PROMISE_FOLLOWUP: customer previously promised a payment date "
            "and it has now passed or is due. "
            "OVERDUE_REMINDER: invoice is overdue with no promise on file. "
            "GENERAL_FOLLOWUP: anything else (e.g. clarifying a question)."
        )
    )

    promise_to_pay_date: Optional[str] = Field(
        default=None,
        description=(
            "If the most recent customer message contains a promise to pay "
            "by a specific date, return that date in YYYY-MM-DD format. "
            "Otherwise null. Never invent a date that wasn't stated."
        ),
    )

    reason: str = Field(
        description="Short explanation for the decision."
    )


# ============================================================
# 2. LANGGRAPH STATE
# ============================================================

class RecoveryState(TypedDict):
    invoice_id: int
    invoice: dict
    preferred_channel: str          # "whatsapp" | "email"
    conversation: str
    history: dict[str, Any]
    reminder_count: int
    companydetail: dict[str, Any]
    send_message: bool
    create_payment_link: bool
    human_intervention: bool
    message_type: str
    promise_to_pay_date: Optional[str]
    reason: str
    payment_link: str
    whatsapp_sid: str               # set when preferred_channel == "whatsapp"
    email_sid: str                  # set when preferred_channel == "email"
    voice_sid: str                  # set when preferred_channel == "voice"
    call_status: str
    recovery_status: str


# ============================================================
# 3. LLM
# ============================================================

llm = ChatGoogleGenerativeAI(
    model="gemini-3.5-flash-lite"
)


# ============================================================
# 4. AI AGENT
# ============================================================

from langchain_core.prompts import ChatPromptTemplate

_system_prompt = """
You are an AI B2B receivables recovery assistant.

Your job is to analyze an overdue invoice using:

1. Current invoice information
2. Previous customer communication
3. Company payment history
4. Customer communication behavior

Never invent information.

Analyze:

1. Customer intent
2. Previous payment promises
3. Whether a previous promise appears to have failed
4. Whether the customer is disputing the invoice
5. Whether another reminder is appropriate
6. Whether a Razorpay payment link would be useful
7. Whether human intervention is required
8. Whether the customer stated a specific new payment date

RULES (these are guidance — the calling code enforces the hard caps):

- Prefer not exceeding 3 automated reminders for the same invoice.
- If the customer disputes the invoice, require human intervention.
- If the customer has already made a payment promise, treat a followup
  about that promise differently from a first reminder (message_type =
  PROMISE_FOLLOWUP, not PAYMENT_REMINDER).
- If a previous payment promise appears to have failed, carefully
  evaluate whether escalation is warranted.
- If the situation is unclear, require human intervention.
- Never invent payment dates, discounts, customer statements, payment
  information, or invoice information.

DECISION RULES:

- send_message = true only when an automated WhatsApp message is
  appropriate.
- create_payment_link = true only when a payment link should be
  provided to the customer.
- human_intervention = true when the situation requires human review.
- If human_intervention is true, do not recommend automation.
- message_type must reflect which of the four categories best fits,
  even if send_message is false.
- promise_to_pay_date must be null unless the customer explicitly
  stated a date.

Return the decision using the provided structured format.
"""

_prompt = ChatPromptTemplate.from_messages([
    ("system", _system_prompt),
    ("user", "{user_content}")
])

agent = _prompt | llm.with_structured_output(RecoveryDecision)


# ============================================================
# 5. NODE: GET CONVERSATION CONTEXT
# ============================================================

async def get_context(state: RecoveryState):
    invoice = state.get("invoice", {})

    # GUARDRAIL 1: If invoice is already paid, stop all recovery
    if invoice.get("invoice_amount_status") or invoice.get("invoice_status") == "PAID":
        print(f"[get_context] Invoice {state['invoice_id']} is already PAID. Stopping recovery.")
        return {
            "conversation": "",
            "reminder_count": 0,
            "send_message": False,
            "human_intervention": False,
            "reason": "Invoice is already paid — no recovery action required.",
        }

    # GUARDRAIL 2: If case is marked for human intervention, do not send automated reminders
    rec_status = invoice.get("recovery_status")
    if rec_status == "NEEDS_HUMAN_INTERVENTION":
        print(f"[get_context] Invoice {state['invoice_id']} requires human review. Halting automation.")
        return {
            "conversation": "",
            "reminder_count": 0,
            "send_message": False,
            "human_intervention": True,
            "reason": invoice.get("human_intervention_reason") or "Case requires human intervention.",
        }

    # GUARDRAIL 3: If customer made a promise and promised_date is in the future, WAIT
    promised_date = invoice.get("promised_date")
    if rec_status == "PROMISE_TO_PAY" and promised_date:
        try:
            if isinstance(promised_date, str):
                clean_pdate = promised_date.replace("Z", "+00:00")
                parsed_pdate = datetime.fromisoformat(clean_pdate).date()
            elif hasattr(promised_date, "date"):
                parsed_pdate = promised_date.date()
            else:
                parsed_pdate = promised_date

            today = date.today()
            if parsed_pdate > today:
                print(f"[get_context] Invoice {state['invoice_id']} has active promise for {parsed_pdate} (today is {today}). Waiting.")
                return {
                    "conversation": "",
                    "reminder_count": 0,
                    "send_message": False,
                    "human_intervention": False,
                    "reason": f"Waiting for promised payment date: {parsed_pdate}.",
                }
        except Exception as p_err:
            print(f"[get_context] Error parsing promised date: {p_err}")

    try:
        messages = await db.message.find_many(
            where={"invoice_id": state["invoice_id"]},
            order={"created_at": "asc"},
        )
    except Exception as exc:
        print(f"[get_context] failed to fetch messages: {exc}")
        return {"conversation": "", "reminder_count": 0}

    conversation = "\n".join(
        f"{message.message_type}: {message.content}" for message in messages
    )

    # ASSUMPTION: automated reminders are tagged with message_type
    # "REMINDER" when they're written to the DB in send_message(). This
    # count is the deterministic guardrail for the 3-reminder cap.
    reminder_count = sum(
        1 for message in messages if message.message_type == "REMINDER"
    )

    return {
        "conversation": conversation,
        "reminder_count": reminder_count,
    }


# ============================================================
# 6. NODE: GET COMPANY HISTORY
# ============================================================

async def get_company_history(state: RecoveryState):
    try:
        history = await db.companyhistory.find_first(
            where={"company_id": state["invoice"]["company_id"]}
        )
        companydetail=await db.company.find_first(
            where={"company_id": state["invoice"]["company_id"]}
        )
    except Exception as exc:
        print(f"[get_company_history] failed: {exc}")
        return {"history": {}}

    # Sync preferred_channel from the company record into state so the
    # router always uses the DB value rather than the invocation default.
    company_channel = getattr(companydetail, "preferred_channel", None) or "WHATSAPP"
    return {
        "history": history.history if history else {},
        "companydetail": companydetail,
        "preferred_channel": company_channel.lower(),   # normalise to lowercase
    }


# ============================================================
# 7. NODE: AI DECISION (with deterministic guardrail)
# ============================================================

async def decision_agent(state: RecoveryState):
    # Guardrail check from context: if already decided to wait or stop
    if state.get("send_message") is False and not state.get("human_intervention"):
        return {
            "send_message": False,
            "create_payment_link": False,
            "human_intervention": False,
            "message_type": "GENERAL_FOLLOWUP",
            "promise_to_pay_date": None,
            "reason": state.get("reason", "Waiting / No automated reminder needed."),
        }

    if state.get("human_intervention") and not state.get("send_message"):
        return {
            "send_message": False,
            "create_payment_link": False,
            "human_intervention": True,
            "message_type": "GENERAL_FOLLOWUP",
            "promise_to_pay_date": None,
            "reason": state.get("reason", "Case requires human intervention."),
        }
    try:
        decision = await agent.ainvoke(
            {
                "user_content": f"""
CURRENT INVOICE

Invoice ID:
{state["invoice_id"]}

Invoice Information:
{state["invoice"]}


COMPANY HISTORY

{state["history"]}


PREVIOUS CUSTOMER COMMUNICATION

{state["conversation"]}


AUTOMATED REMINDERS SENT SO FAR: {state.get("reminder_count", 0)}


TASK

Analyze the invoice, company history, and previous communication.
Determine the most appropriate recovery action.
"""
            }
        )

    except Exception as exc:
        print(f"[decision_agent] LLM call failed: {exc}")
        decision = None

    if decision is None:
 
        return {
            "send_message": False,
            "create_payment_link": False,
            "human_intervention": True,
            "message_type": "GENERAL_FOLLOWUP",
            "promise_to_pay_date": None,
            "reason": "Automated decision failed — routed to human review.",
        }

    send_message = decision.send_message
    human_intervention = decision.human_intervention

    if state.get("reminder_count", 0) >= MAX_AUTOMATED_REMINDERS and send_message:
        send_message = False
        human_intervention = True

    return {
        "send_message": send_message,
        "create_payment_link": decision.create_payment_link,
        "human_intervention": human_intervention,
        "message_type": decision.message_type,
        "promise_to_pay_date": decision.promise_to_pay_date,
        "reason": decision.reason,
    }


# ============================================================
# 8. NODE: CREATE RAZORPAY PAYMENT LINK
# ============================================================

async def create_payment_link(state: RecoveryState):
    invoice = state["invoice"]

    # If the invoice already has a saved payment link in the backend, reuse it!
    existing_link = invoice.get("payment_link")
    if existing_link:
        print(f"[create_payment_link] Reusing saved payment link for invoice {invoice.get('invoice_id')}: {existing_link}")
        return {"payment_link": existing_link}

    companydetail = state.get("companydetail")
    customer_name = getattr(companydetail, "company_name", None) if companydetail else None
    customer_email = getattr(companydetail, "company_email", None) if companydetail else None
    customer_phone = getattr(companydetail, "company_phone", None) if companydetail else invoice.get("customer_phone", "")

    try:
        result = await generate_payment_link(
            amount=invoice["invoice_amount"],
            description=f"Payment for invoice {invoice['invoice_name']}",
            customer_name=customer_name,
            customer_email=customer_email,
            customer_phone=customer_phone,
            invoice_id=invoice.get("invoice_id"),
            invoice_name=invoice.get("invoice_name"),
        )
        payment_link = result.get("short_url", "")
        print(f"[create_payment_link] Generated Razorpay link for invoice {invoice.get('invoice_id')}: {payment_link}")

        # Persist to database so we don't generate it repeatedly
        inv_id = invoice.get("invoice_id")
        if inv_id and payment_link:
            try:
                await db.invoice.update(
                    where={"invoice_id": int(inv_id)},
                    data={
                        "payment_link": payment_link,
                        "payment_link_id": result.get("payment_link_id", ""),
                    }
                )
            except Exception as update_err:
                print(f"[create_payment_link] Failed to persist link: {update_err}")

    except Exception as exc:
        print(f"[create_payment_link] failed: {exc}")
        payment_link = ""

    return {"payment_link": payment_link}


# ============================================================
# 9. CHANNEL NODES: imported from agent/channels/
# ============================================================
# send_whatsapp_message  — channels/whatsapp.py  (Meta Cloud API)
# send_email_message     — channels/email.py     (Gmail API)
# ============================================================
# 10. NODE: HUMAN REVIEW
# ============================================================

async def human_review(state: RecoveryState):
    print("HUMAN REVIEW REQUIRED")
    print("Invoice:", state["invoice_id"])
    print("Reason:", state["reason"])

    try:
        await db.invoice.update(
            where={"invoice_id": state["invoice_id"]},
            data={
                "recovery_status": "NEEDS_HUMAN_INTERVENTION",
                "human_intervention_reason": state.get("reason", "Escalated by AI recovery agent"),
            }
        )
    except Exception as exc:
        print(f"[human_review] failed to update invoice status: {exc}")

    return {}


# ============================================================
# 11. ROUTER
# ============================================================

def _resolve_channel(state: RecoveryState) -> str:
    """Return the normalised channel string ("email", "whatsapp", or "voice").

    Priority:
      1. state["preferred_channel"]  — written by get_company_history from the DB
      2. companydetail.preferred_channel — direct attribute fallback
      3. "whatsapp" — default
    """
    channel = state.get("preferred_channel") or ""
    if not channel:
        companydetail = state.get("companydetail")
        channel = getattr(companydetail, "preferred_channel", None) or "whatsapp"
    norm = str(channel).lower().replace("-", "_")
    if norm in ("voice", "voice_call", "voicecall"):
        return "voice"
    if norm in ("email", "gmail"):
        return "email"
    return "whatsapp"


def route_decision(state: RecoveryState):
    if state.get("human_intervention"):
        return "human_review"

    if state.get("create_payment_link") and state.get("send_message"):
        return "create_payment_link"

    if state.get("send_message"):
        channel = _resolve_channel(state)
        print(f"[router] preferred_channel resolved to '{channel}'")
        if channel == "email":
            return "send_email_message"
        if channel == "voice":
            return "call_voice_agent"
        return "send_whatsapp_message"

    return END


# ============================================================
# 12. BUILD GRAPH
# ============================================================

graph = StateGraph(RecoveryState)

graph.add_node("get_context", get_context)
graph.add_node("get_company_history", get_company_history)
graph.add_node("decision_agent", decision_agent)
graph.add_node("create_payment_link", create_payment_link)
graph.add_node("send_whatsapp_message", send_whatsapp_message)
graph.add_node("send_email_message", send_email_message)
graph.add_node("call_voice_agent", call_voice_agent)
graph.add_node("human_review", human_review)

graph.add_edge(START, "get_context")
graph.add_edge(START, "get_company_history")

graph.add_edge("get_context", "decision_agent")
graph.add_edge("get_company_history", "decision_agent")

graph.add_conditional_edges(
    "decision_agent",
    route_decision,
    {
        "human_review": "human_review",
        "create_payment_link": "create_payment_link",
        "send_whatsapp_message": "send_whatsapp_message",
        "send_email_message": "send_email_message",
        "call_voice_agent": "call_voice_agent",
        END: END,
    },
)

# After creating a payment link, send via whichever channel was requested.
def route_after_payment_link(state: RecoveryState):
    channel = _resolve_channel(state)
    print(f"[router/payment_link] preferred_channel resolved to '{channel}'")
    if channel == "email":
        return "send_email_message"
    if channel == "voice":
        return "call_voice_agent"
    return "send_whatsapp_message"

graph.add_conditional_edges(
    "create_payment_link",
    route_after_payment_link,
    {
        "send_whatsapp_message": "send_whatsapp_message",
        "send_email_message": "send_email_message",
        "call_voice_agent": "call_voice_agent",
    },
)

graph.add_edge("send_whatsapp_message", END)
graph.add_edge("send_email_message", END)
graph.add_edge("call_voice_agent", END)
graph.add_edge("human_review", END)

recovery_graph = graph.compile()