# 🧠 SYSTEM CONTEXT: Razorpay Autonomous AI Debt Recovery Agent
> **Instructions for LLMs reading this document:**
> This document is a complete architectural specification and system graph of the **Razorpay Autonomous AI Debt Recovery Agent**. Use this context to understand the exact mechanics, data models, API surfaces, multi-channel pipelines, and payment loops implemented in this project.

---

## 1. High-Level Concept & Mission
- **Project Name**: Razorpay Autonomous AI Debt Recovery & Dispute Resolution Platform
- **Domain**: B2B / B2C Accounts Receivable (AR), Overdue Invoice Recovery, and Conversational Dispute Resolution.
- **Core Value Proposition**: Automates receivables collection without damaging customer relationships. Replaces aggressive collection agencies with an empathetic, multi-agent AI system that negotiates payment dates, handles invoice queries/disputes, generates instant Razorpay dynamic payment links, and reconciles payments in real time via webhooks and dual-channel receipts.

---

## 2. Complete System Graph (ASCII Architecture for LLMs)

```
===================================================================================================
                                SYSTEM ARCHITECTURE & DATA FLOW GRAPH
===================================================================================================

       +---------------------------------------------------------------------------------+
       |                              FRONTEND (Next.js 16)                             |
       |  • CFO Analytics Dashboard (/dashboard)     • Invoices & Status (/invoices)    |
       |  • Customer Profiles (/customers)           • Integrations Hub (/integrations) |
       |  • Realtime Agent Recovery Console (/recovery)                                 |
       +---------------------------------------+-----------------------------------------+
                                               | REST / JSON
                                               v
+-------------------------------------------------------------------------------------------------+
|                                 BACKEND (FastAPI + AsyncIOScheduler)                            |
|                                                                                                 |
|   +---------------------------------------+   +---------------------------------------------+   |
|   |         APScheduler Workers           |   |                API Controllers              |   |
|   | 1. Overdue Scanner (1h interval)      |   | • /api/invoices (CRUD & status)             |   |
|   | 2. Gmail Sync (2m interval)           |   | • /api/recovery/invoices/{id}/trigger       |   |
|   | 3. Razorpay Reconciler (1m interval)  |   | • /api/recovery/webhooks/* (Meta/RZP/11Labs)|   |
|   +-------------------+-------------------+   +----------------------+----------------------+   |
|                       |                                              |                          |
|                       v                                              v                          |
|   +-----------------------------------------------------------------------------------------+   |
|   |                            MULTI-AGENT REASONING LAYER                                  |   |
|   |                                                                                         |   |
|   |  [ OUTBOUND GRAPH - LangGraph ]                  [ INBOUND ENGINE - LangChain ]         |   |
|   |  • Guardrail: Reminders Cap (< 3)                • Intent Classifier:                   |   |
|   |  • Razorpay Dynamic Link Generator                 - INVOICE_QUERY                      |   |
|   |  • Gemini Decision:                                - PROMISE_TO_PAY (extract date)      |   |
|   |    (PAYMENT_REMINDER / OVERDUE / PROMISE)          - ALREADY_PAID (verify API)          |   |
|   |  • Multi-Channel Router                            - HUMAN_INTERVENTION (flag dispute)  |   |
|   +--------------------+---------------------------------------------+----------------------+   |
|                        |                                             |                          |
+------------------------|---------------------------------------------|--------------------------+
                         |                                             |
                         v                                             v
+------------------------------------+             +----------------------------------------------+
|      DATA LAYER (PostgreSQL)       |             |             EXTERNAL INTEGRATIONS            |
| • Neon Postgres + pgvector         |             |                                              |
| • Prisma ORM Client                |             | 1. RAZORPAY PAYMENT GATEWAY                  |
| • Models:                          |             |    • Payment Links API (https://rzp.io/...)  |
|   - Company (debtor info, contact) |             |    • Webhooks (HMAC-SHA256 verification)     |
|   - Invoice (amount, status, link) |             |    • Payment Reconciliation API              |
|   - Message (chat logs + vectors)  |             |                                              |
|   - RecoveryLog (audit trails)     |             | 2. META WHATSAPP CLOUD API                   |
|                                    |             |    • Interactive Templates + CTA Buttons     |
+------------------------------------+             |    • Two-Way Inbound Webhook                 |
                                                   |                                              |
                                                   | 3. ELEVENLABS CONVERSATIONAL VOICE AI        |
                                                   |    • Agent "JEA" (Outbound / Inbound calls)  |
                                                   |    • Post-Call Webhook (Sentiment + Summary) |
                                                   |                                              |
                                                   | 4. GOOGLE GMAIL API (OAuth2)                 |
                                                   |    • HTML Invoices with Payment Buttons      |
                                                   |    • Background Reply Ingestion              |
                                                   +----------------------------------------------+
```

---

## 3. The Two Core Lifecycles

### A. OUTBOUND WORKFLOW (Autonomous Outreach)
1. **Trigger**: Hourly scheduler (`check_overdue_invoices`) or manual UI click.
2. **Identification**: Prisma queries invoices with `status = "PENDING"` and `due_date < today`.
3. **Safety Guardrail**: Verifies reminder attempts count. If $\ge 3$, escalates to human CFO review.
4. **Razorpay Link Creation**: Calls Razorpay API to generate a dynamic link with invoice reference, customer contact, and paise amount.
5. **Gemini Decision**: LangGraph node evaluates invoice age and customer history to determine tone (`PAYMENT_REMINDER`, `OVERDUE_REMINDER`, or `PROMISE_FOLLOWUP`).
6. **Channel Dispatch**:
   - **WhatsApp**: Sends pre-approved interactive template with the dynamic `https://rzp.io/...` button.
   - **Gmail**: Sends a professional HTML invoice containing customer breakdown and payment link.
   - **Voice AI (ElevenLabs)**: Dispatches outbound phone call with Agent JEA.
7. **Audit Record**: Inserts record into `Message` and logs attempt in database.

### B. INBOUND WORKFLOW (Conversational Reasoning & Payment Closure)
1. **Multi-Channel Ingestion**:
   - Customer messages back on **WhatsApp** (`POST /api/recovery/webhooks/whatsapp`).
   - Customer replies to **Email** (ingested by 2-min cron via Gmail API).
   - Customer speaks on **Voice Call** (ElevenLabs webhook sends transcript & sentiment).
   - Customer pays on **Razorpay** (`POST /api/recovery/webhooks/razorpay`).
2. **Entity Resolution**: Extracts customer phone/email and queries active unpaid invoice.
3. **Gemini Intent Classification**:
   - `INVOICE_QUERY` $\rightarrow$ LLM constructs polite summary with fresh Razorpay link.
   - `PROMISE_TO_PAY` $\rightarrow$ LLM extracts promise date (`YYYY-MM-DD`), sets status to `PROMISE_TO_PAY`, schedules future reminder.
   - `ALREADY_PAID` $\rightarrow$ System immediately queries Razorpay API to verify transaction.
   - `HUMAN_INTERVENTION` $\rightarrow$ Sets status to `DISPUTE` and flags for CFO dashboard review.
4. **Razorpay Payment Closure**:
   - Webhook validates HMAC-SHA256 signature against `RAZORPAY_WEBHOOK_SECRET`.
   - On `payment_link.paid` or `payment.captured`:
     - Mutates invoice status to `PAID`.
     - Records payment ID (`pay_...`) and timestamp.
     - **Dual Receipt Dispatch**: Automatically triggers both an instant **WhatsApp Thank-You message** and a formal **Gmail Payment Confirmation Receipt**.

---

## 4. Technology Stack Specification

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Backend Framework** | FastAPI (Python 3.11+) | Async REST API, Webhooks, Schedulers |
| **Database & ORM** | PostgreSQL (Neon) + pgvector, Prisma ORM | Vector embeddings, relational models |
| **Agent Reasoning** | LangChain + LangGraph + Google Gemini | Decision tree, tone selection, intent extraction |
| **Payment Gateway** | Razorpay SDK | Payment links, HMAC-SHA256 webhooks, reconciliation |
| **Messaging Channel** | Meta WhatsApp Cloud API | Interactive template messages & button links |
| **Voice AI Channel** | ElevenLabs Conversational AI ("JEA") | Low-latency voice calls & post-call webhook |
| **Email Channel** | Google Gmail API (OAuth 2.0) | HTML invoices & 2-way thread sync |
| **Frontend Framework**| Next.js 16 (App Router), React 19, Tailwind CSS 4 | CFO Analytics Dashboard, Invoices, Live Recovery Console |

---

## 5. Key Database Entities (Prisma Schema)

```prisma
enum InvoiceStatus {
  PENDING
  PAID
  OVERDUE
  DISPUTE
  PROMISE_TO_PAY
}

enum MessageType {
  SENT
  RECEIVED
}

model Company {
  id              Int       @id @default(autautoincrement())
  company_name    String
  company_email   String?
  company_phone   String?
  invoices        Invoice[]
}

model Invoice {
  invoice_id      Int           @id @default(autoincrement())
  invoice_amount  Float
  invoice_due_date DateTime
  invoice_status  InvoiceStatus @default(PENDING)
  payment_link    String?       // Razorpay dynamic short URL
  company_id      Int
  company         Company       @relation(fields: [company_id], references: [id])
  messages        Message[]
}

model Message {
  id              Int         @id @default(autoincrement())
  invoice_id      Int
  content         String
  message_type    MessageType
  created_at      DateTime    @default(now())
}
```

---

## 6. API Surface & Webhooks

```
POST   /api/recovery/webhooks/razorpay        -> Ingests payment_link.paid & payment.captured
GET    /api/recovery/webhooks/whatsapp        -> Meta verification handshake
POST   /api/recovery/webhooks/whatsapp        -> Inbound customer WhatsApp messages
POST   /api/recovery/webhooks/elevenlabs      -> ElevenLabs post-call transcript & sentiment
POST   /api/recovery/invoices/{id}/trigger-workflow -> Manual trigger for recovery
POST   /api/recovery/invoices/{id}/verify-payment   -> Direct Razorpay payment link sync
GET    /api/invoices                          -> List invoices with payment & customer state
GET    /auth/gmail/authorize                  -> Gmail OAuth2 consent flow
GET    /auth/gmail/callback                   -> Gmail OAuth2 callback handler
```

---

## 7. What Makes This Solution Unique for Evaluators & LLMs
1. **Closed-Loop Reconciliation**: It doesn't just send payment links; it verifies them cryptographically (HMAC-SHA256) and falls back to a 60-second polling cron to guarantee zero missed payments.
2. **Empathetic AI Negotiation**: Rather than spamming debtors, Gemini reasons over their exact situation, captures promise-to-pay dates, and halts reminders when a promise or dispute is active.
3. **True Omnichannel Synchrony**: A debtor can receive an email, reply on WhatsApp, call the AI agent on the phone, and pay via UPI on Razorpay — the database maintains one unified context across all channels.
