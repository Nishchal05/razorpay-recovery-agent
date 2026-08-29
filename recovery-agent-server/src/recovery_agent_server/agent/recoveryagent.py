"""
B2B Receivables Recovery Agent — LangGraph workflow.

Fixes applied vs. the original draft:
1. `build_message()` was dead code — it referenced `state["decision"]`, a key
   that never existed in RecoveryState, and was never called by any node.
   It's now wired in properly, driven by a `message_type` field the LLM
   returns as part of its structured decision.
2. `send_message()` hardcoded a single WhatsApp number. It now pulls the
   real customer number from the invoice/company record.
3. The Twilio `Client` instance was assigned to a local variable named
   `client`, shadowing the Prisma `client` imported at module scope.
   Renamed to `twilio_client` to remove the foot-gun.
4. The "never send more than 3 reminders" rule was ONLY a prompt
   instruction — an LLM can ignore prompt instructions. It's now also
   enforced in code (a real guardrail, not a suggestion): the reminder
   count is computed from the DB and hard-overrides the LLM if it's
   already at the cap.
5. Added defensive handling for the case where `structured_response` is
   missing from the agent result (a known intermittent LangChain issue)
   — falls back to human_review instead of crashing.
6. Wrapped all external calls (LLM, Twilio, Razorpay, DB) in try/except
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
import json
import os

from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END
from twilio.rest import Client as TwilioClient

from ..database.prisma import client as db


# ============================================================
# CONFIG
# ============================================================

MAX_AUTOMATED_REMINDERS = 3

# Map decision message_type -> approved WhatsApp template content SID.
# WhatsApp requires pre-approved templates for business-initiated
# messages outside the 24h customer-service window, so free-text is
# not used here even though build_message() produces free text — the
# generated text is passed as template variables instead.
TEMPLATE_MAP = {
    "PAYMENT_REMINDER": os.environ.get("WA_TEMPLATE_PAYMENT_REMINDER", ""),
    "PROMISE_FOLLOWUP": os.environ.get("WA_TEMPLATE_PROMISE_FOLLOWUP", ""),
    "OVERDUE_REMINDER": os.environ.get("WA_TEMPLATE_OVERDUE_REMINDER", ""),
    "GENERAL_FOLLOWUP": os.environ.get("WA_TEMPLATE_GENERAL_FOLLOWUP", ""),
}


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

    conversation: str
    history: dict[str, Any]
    reminder_count: int

    send_message: bool
    create_payment_link: bool
    human_intervention: bool
    message_type: str
    promise_to_pay_date: Optional[str]

    reason: str
    payment_link: str
    whatsapp_sid: str


# ============================================================
# 3. LLM
# ============================================================

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite"
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
    except Exception as exc:
        print(f"[get_company_history] failed: {exc}")
        return {"history": {}}

    return {"history": history.history if history else {}}


# ============================================================
# 7. NODE: AI DECISION (with deterministic guardrail)
# ============================================================

async def decision_agent(state: RecoveryState):
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
        # Structured output missing/failed — fail safe to human review
        # rather than silently doing nothing or crashing the graph.
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

    # --- Deterministic guardrail: hard cap on automated reminders. ---
    # This is enforced in code, not just requested in the prompt, so an
    # LLM that ignores instructions can't blow past the limit.
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

    try:
        # TODO: replace with a real Razorpay Payment Links API call, e.g.
        # razorpay_client.payment_link.create({
        #     "amount": int(invoice["invoice_amount"] * 100),  # paise
        #     "currency": "INR",
        #     "description": f"Payment for invoice {invoice['invoice_name']}",
        #     "customer": {"contact": invoice.get("customer_phone", "")},
        #     "notify": {"sms": False, "email": False},
        # })
        payment_link = "https://rzp.io/demo-payment-link"
        print(f"Creating payment link for invoice {invoice['invoice_id']}")
    except Exception as exc:
        print(f"[create_payment_link] failed: {exc}")
        payment_link = ""

    return {"payment_link": payment_link}


# ============================================================
# 9. NODE: SEND WHATSAPP MESSAGE
# ============================================================

def build_message(state: RecoveryState) -> str:
    """Builds the human-readable message text used as a template
    variable. Kept even though we send via an approved WhatsApp
    template, so the exact wording is visible/testable outside Twilio.
    """
    invoice = state["invoice"]
    payment_link = state.get("payment_link", "")
    message_type = state.get("message_type", "GENERAL_FOLLOWUP")

    invoice_name = invoice["invoice_name"]
    amount = invoice["invoice_amount"]

    if message_type == "PAYMENT_REMINDER" and payment_link:
        return (
            f"Hello,\n\nThis is a friendly reminder regarding invoice "
            f"{invoice_name}.\n\nThe outstanding amount is ₹{amount}.\n\n"
            f"You can complete the payment using the link below:\n\n"
            f"{payment_link}\n\nPlease let us know if you have any "
            f"questions.\n\nThank you."
        )

    if message_type == "PROMISE_FOLLOWUP":
        return (
            f"Hello,\n\nYou previously mentioned that the payment for "
            f"invoice {invoice_name} would be completed soon.\n\nThe "
            f"outstanding amount of ₹{amount} is still pending.\n\nCould "
            f"you please provide us with an updated payment date?\n\n"
            f"Thank you."
        )

    if message_type == "OVERDUE_REMINDER":
        return (
            f"Hello,\n\nThis is a reminder that invoice {invoice_name} "
            f"for ₹{amount} is currently overdue.\n\nPlease let us know "
            f"when we can expect the payment.\n\nThank you."
        )

    return (
        f"Hello,\n\nWe are following up regarding invoice {invoice_name} "
        f"with an outstanding amount of ₹{amount}.\n\nPlease let us know "
        f"if there is any issue with the payment.\n\nThank you."
    )


async def send_message(state: RecoveryState):
    invoice = state["invoice"]
    payment_link = state.get("payment_link", "")
    message_type = state.get("message_type", "GENERAL_FOLLOWUP")

    customer_phone = invoice.get("customer_phone")
    if not customer_phone:
        print(f"[send_message] no customer_phone on invoice {invoice.get('invoice_id')}, skipping")
        return {"whatsapp_sid": ""}

    body_text = build_message(state)
    content_sid = TEMPLATE_MAP.get(message_type, "")

    try:
        account_sid = os.environ["TWILIO_ACCOUNT_SID"]
        auth_token = os.environ["TWILIO_AUTH_TOKEN"]
        wa_from = os.environ["TWILIO_WHATSAPP_FROM"]
    except KeyError as exc:
        print(f"[send_message] missing Twilio env var: {exc}")
        return {"whatsapp_sid": ""}

    twilio_client = TwilioClient(account_sid, auth_token)

    try:
        if content_sid:
            message = twilio_client.messages.create(
                to=f"whatsapp:{customer_phone}",
                from_=f"whatsapp:{wa_from}",
                content_sid=content_sid,
                content_variables=json.dumps(
                    {
                        "1": invoice.get("customer_name", "Customer"),
                        "2": invoice["invoice_name"],
                        "3": str(invoice["invoice_amount"]),
                        "4": payment_link,
                    }
                ),
            )
        else:
            # No approved template configured for this message_type —
            # fall back to a plain body send (only valid within the
            # 24h WhatsApp customer-service window).
            message = twilio_client.messages.create(
                to=f"whatsapp:{customer_phone}",
                from_=f"whatsapp:{wa_from}",
                body=body_text,
            )
    except Exception as exc:
        print(f"[send_message] Twilio send failed: {exc}")
        return {"whatsapp_sid": ""}

    # Persist the outbound message so future runs can compute
    # reminder_count correctly.
    try:
        await db.message.create(
            data={
                "invoice_id": state["invoice_id"],
                "message_type": "REMINDER",
                "content": body_text,
            }
        )
    except Exception as exc:
        print(f"[send_message] failed to log outbound message: {exc}")

    print(f"WHATSAPP MESSAGE SID: {message.sid}")
    return {"whatsapp_sid": message.sid}


# ============================================================
# 10. NODE: HUMAN REVIEW
# ============================================================

async def human_review(state: RecoveryState):
    print("HUMAN REVIEW REQUIRED")
    print("Invoice:", state["invoice_id"])
    print("Reason:", state["reason"])

    try:
        # TODO: replace `escalation` with your actual Prisma model name.
        await db.escalation.create(
            data={
                "invoice_id": state["invoice_id"],
                "reason": state["reason"],
                "promise_to_pay_date": state.get("promise_to_pay_date"),
            }
        )
    except Exception as exc:
        print(f"[human_review] failed to persist escalation: {exc}")

    # TODO: notify finance team (Slack/email webhook) here.
    return {}


# ============================================================
# 11. ROUTER
# ============================================================

def route_decision(state: RecoveryState):
    if state["human_intervention"]:
        return "human_review"

    if state["create_payment_link"] and state["send_message"]:
        return "create_payment_link"

    if state["send_message"]:
        return "send_message"

    return END


# ============================================================
# 12. BUILD GRAPH
# ============================================================

graph = StateGraph(RecoveryState)

graph.add_node("get_context", get_context)
graph.add_node("get_company_history", get_company_history)
graph.add_node("decision_agent", decision_agent)
graph.add_node("create_payment_link", create_payment_link)
graph.add_node("send_message", send_message)
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
        "send_message": "send_message",
        END: END,
    },
)

graph.add_edge("create_payment_link", "send_message")
graph.add_edge("send_message", END)
graph.add_edge("human_review", END)

recovery_graph = graph.compile()