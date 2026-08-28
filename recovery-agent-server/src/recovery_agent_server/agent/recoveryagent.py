from typing import TypedDict

from pydantic import BaseModel, Field

from langchain.agents import create_agent
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, START, END

from ..database.prisma import client


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

    send_message: bool
    create_payment_link: bool
    human_intervention: bool

    reason: str

    payment_link: str


# ============================================================
# 3. LLM
# ============================================================

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite"
)


# ============================================================
# 4. AGENT
# ============================================================

agent = create_agent(
    model=llm,
    response_format=RecoveryDecision,

    prompt="""
You are an AI B2B receivables recovery assistant.

Your job is to analyze an overdue invoice and the customer's
previous communication.

Never invent information.

Analyze:

1. Customer intent
2. Previous payment promises
3. Whether a payment promise has failed
4. Whether the customer is disputing the invoice
5. Whether another reminder is appropriate
6. Whether a payment link would be useful
7. Whether human intervention is required

IMPORTANT STOPPING RULES:

- Never send more than 3 automated reminders.
- If the customer disputes the invoice, stop automation
  and require human intervention.
- If the customer has already made a payment promise,
  consider that before sending another reminder.
- If a payment promise has failed, carefully evaluate the
  situation.
- If the situation is unclear, require human intervention.
- Never invent payment dates, discounts, customer statements,
  or invoice information.

Decision rules:

- send_message = true only when an automated WhatsApp message
  is appropriate.
- create_payment_link = true only when a payment link should
  be provided to the customer.
- human_intervention = true when the case requires a human.

Return your decision using the provided structured format.
"""
)


# ============================================================
# 5. NODE: GET CONTEXT
# ============================================================

async def get_context(state: RecoveryState):

    messages = await client.message.find_many(
        where={
            "invoice_id": state["invoice_id"]
        },
        order={
            "created_at": "asc"
        }
    )

    conversation = "\n".join(
        f"{message.message_type}: {message.message}"
        for message in messages
    )

    return {
        "conversation": conversation
    }


# ============================================================
# 6. NODE: AI DECISION
# ============================================================

async def decision_agent(state: RecoveryState):

    result = await agent.ainvoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": f"""
Invoice information:

Invoice ID:
{state["invoice_id"]}

Invoice:

{state["invoice"]}

Previous customer communication:

{state["conversation"]}

Analyze this invoice and determine the appropriate recovery action.
"""
                }
            ]
        }
    )

    decision: RecoveryDecision = result["structured_response"]

    return {
        "send_message": decision.send_message,
        "create_payment_link": decision.create_payment_link,
        "human_intervention": decision.human_intervention,
        "reason": decision.reason
    }


# ============================================================
# 7. NODE: CREATE RAZORPAY PAYMENT LINK
# ============================================================

async def create_payment_link(state: RecoveryState):

    invoice = state["invoice"]

    # TODO:
    # Call Razorpay API here.

    # Example for now:
    payment_link = "https://rzp.io/demo-payment-link"

    return {
        "payment_link": payment_link
    }


# ============================================================
# 8. NODE: SEND WHATSAPP MESSAGE
# ============================================================

async def send_message(state: RecoveryState):

    invoice = state["invoice"]

    payment_link = state.get("payment_link", "")

    if payment_link:

        message = f"""
Hello,

This is a reminder regarding invoice
{invoice["invoice_name"]}.

Amount due: ₹{invoice["invoice_amount"]}

You can complete the payment here:

{payment_link}

Thank you.
"""

    else:

        message = f"""
Hello,

This is a reminder regarding invoice
{invoice["invoice_name"]}.

Amount due: ₹{invoice["invoice_amount"]}.

Please let us know if you need any assistance.

Thank you.
"""

    # TODO:
    # Call WhatsApp API here.

    print("WHATSAPP MESSAGE:")
    print(message)

    return {}


# ============================================================
# 9. NODE: HUMAN REVIEW
# ============================================================

async def human_review(state: RecoveryState):

    print("HUMAN REVIEW REQUIRED")
    print("Invoice:", state["invoice_id"])
    print("Reason:", state["reason"])

    # Later:
    # Save escalation to database
    # Notify finance team
    # Show on dashboard

    return {}


# ============================================================
# 10. ROUTER
# ============================================================

def route_decision(state: RecoveryState):

    # Human intervention always has highest priority.
    if state["human_intervention"]:
        return "human_review"

    # If payment link is required, create it first.
    if state["create_payment_link"]:
        return "create_payment_link"

    # Otherwise send message if required.
    if state["send_message"]:
        return "send_message"

    return END


# ============================================================
# 11. BUILD GRAPH
# ============================================================

graph = StateGraph(RecoveryState)

graph.add_node(
    "get_context",
    get_context
)

graph.add_node(
    "decision_agent",
    decision_agent
)

graph.add_node(
    "create_payment_link",
    create_payment_link
)

graph.add_node(
    "send_message",
    send_message
)

graph.add_node(
    "human_review",
    human_review
)


# START
graph.add_edge(
    START,
    "get_context"
)

# Context → AI
graph.add_edge(
    "get_context",
    "decision_agent"
)


# AI → conditional routing
graph.add_conditional_edges(
    "decision_agent",
    route_decision,
    {
        "human_review": "human_review",
        "create_payment_link": "create_payment_link",
        "send_message": "send_message",
        END: END,
    }
)


# Payment link must be created BEFORE WhatsApp
graph.add_edge(
    "create_payment_link",
    "send_message"
)


# Finish
graph.add_edge(
    "send_message",
    END
)

graph.add_edge(
    "human_review",
    END
)


# Compile
recovery_graph = graph.compile()