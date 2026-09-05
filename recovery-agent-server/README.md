# ⚙️ Recovery Agent Server (Backend API)

The backend service for the **Razorpay Autonomous AI Debt Recovery Agent**. Built with **FastAPI**, **Prisma ORM**, **PostgreSQL (pgvector)**, **LangChain Google GenAI**, and **APScheduler**.

---

## 🎯 Key Responsibilities

1. **Autonomous Invoice Recovery Engine**: Orchestrates recovery workflows across WhatsApp, Voice, and Email.
2. **Razorpay Integration Hub**:
   - Creates and manages Razorpay dynamic payment links (`https://rzp.io/...`).
   - Verifies incoming Razorpay webhooks (`POST /api/recovery/webhooks/razorpay`) with HMAC-SHA256 signature checking.
   - Dispatches instant WhatsApp & Gmail confirmation receipts when payments are completed.
   - Runs a 60-second automated safety-net reconciliation job to ensure 100% payment capture.
3. **Omnichannel Messaging Gateways**:
   - **Meta WhatsApp Cloud API**: Interactive message templates with dynamic payment buttons and two-way conversational webhook support.
   - **ElevenLabs Conversational AI**: Outbound/inbound phone calls via AI Recovery Officer "JEA".
   - **Gmail API (OAuth2)**: Automated invoice delivery and background response parsing.
4. **Data Layer**: PostgreSQL with `pgvector` for debt history, vector embeddings, customer profiling, and dispute resolution memory.

---

## 📁 Project Structure

```
recovery-agent-server/
├── prisma/
│   └── schema.prisma              # Database schema (Invoices, Customers, Payments, Logs)
├── src/recovery_agent_server/
│   ├── main.py                    # FastAPI entrypoint, CORS, startup/shutdown & schedulers
│   ├── api/
│   │   ├── auth.py                # User authentication & JWT issuance
│   │   ├── company.py             # Company profile & recovery settings
│   │   ├── invoices.py            # Invoices CRUD, status updates, upload handling
│   │   ├── gmail.py               # Gmail OAuth2 handshake & status
│   │   └── recovery.py            # Recovery triggers, Razorpay webhooks, WhatsApp webhooks
│   ├── agent/
│   │   ├── due_invoices.py        # Overdue invoice scanning & channel routing
│   │   ├── orchestrator.py        # LangChain & Gemini LLM recovery logic
│   │   └── channels/              # WhatsApp, Email, and Voice channel dispatchers
│   ├── services/
│   │   ├── razorpay_service.py    # Razorpay SDK wrappers & payment link creation
│   │   ├── whatsapp_service.py    # Meta Graph API templates & interactive messages
│   │   ├── elevenlabs_service.py  # ElevenLabs Voice Agent calls & webhook parsing
│   │   ├── gmail_service.py       # Gmail OAuth2 client & email transmission
│   │   └── notification_service.py# Post-payment dual-channel thank-you notifications
│   └── database/
│       └── prisma.py              # Async Prisma client singleton
├── .env.example                   # Full template of required environment variables
├── pyproject.toml                 # Package dependencies & configuration
└── requirements.txt               # Direct Python dependencies
```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `GOOGLE_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `rzp_test_...` or `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | Secret string from dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Webhook Secret | Secret string set in webhooks tab |
| `META_ACCESS_TOKEN` | Meta System User Token | Permanent WhatsApp Cloud API token |
| `META_PHONE_NUMBER_ID` | WhatsApp Business Phone ID | Numeric ID from Meta portal |
| `META_API_VERSION` | Graph API Version | `v25.0` |
| `META_VERIFY_TOKEN` | Webhook verification token | String configured in Meta app |
| `WA_TEMPLATE_LANG` | Template language code | `en` or `en_US` |
| `WA_BUTTON_URL_PREFIX` | Payment link URL prefix | `https://rzp.io/` |
| `GMAIL_CLIENT_ID` | Google Cloud OAuth2 Client ID | `*.apps.googleusercontent.com` |
| `GMAIL_CLIENT_SECRET` | Google Cloud OAuth2 Secret | `GOCSPX-...` |
| `GMAIL_REDIRECT_URI` | OAuth2 Redirect Callback | `http://127.0.0.1:8000/auth/gmail/callback` |
| `ELEVENLABS_API_KEY` | ElevenLabs API Key | `sk_...` |
| `ELEVENLABS_AGENT_ID` | ElevenLabs Agent ID | `agent_...` |
| `ELEVENLABS_PHONE_NUMBER_ID`| ElevenLabs Phone Number ID | `phnum_...` |
| `ELEVENLABS_WEBHOOK_SECRET` | ElevenLabs Post-call Webhook Secret | `wsec_...` |
| `JWT_SECRET` | Key for JWT token signing | Random 32+ char secret |

---

## 📡 Core API Endpoints

### 1. Invoices & Recovery
- `GET /api/invoices` — List all invoices with customer details and recovery status.
- `POST /api/invoices` — Create a new invoice.
- `POST /api/recovery/invoices/{id}/trigger-workflow` — Manually trigger AI recovery for an invoice.
- `POST /api/recovery/invoices/{id}/verify-payment` — Reconcile Razorpay payment link directly against Razorpay API.
- `GET /test-workflow` — Run an immediate dry-run of the overdue invoice scanner.

### 2. Webhooks
- `POST /api/recovery/webhooks/razorpay` — Razorpay webhook endpoint (`payment_link.paid`, `payment.captured`).
- `GET /api/recovery/webhooks/whatsapp` — Meta WhatsApp webhook handshake.
- `POST /api/recovery/webhooks/whatsapp` — Meta WhatsApp two-way inbound message receiver.
- `POST /api/recovery/webhooks/elevenlabs` — ElevenLabs post-call transcript and sentiment receiver.

### 3. Integrations & Auth
- `GET /auth/gmail/authorize` — Initiates Google OAuth2 consent flow for Gmail.
- `GET /auth/gmail/callback` — Handles OAuth2 authorization code callback.
- `GET /api/gmail/status` — Checks if Gmail credentials are valid and authorized.
- `POST /auth/login` — User authentication and JWT generation.

---

## ⏱️ Background Schedulers (APScheduler)

The server runs three resilient asynchronous background workers:
1. **Overdue Invoices Scanner** (Interval: `1 hour`): Identifies invoices nearing or past due date and dispatches the recovery agent.
2. **Customer Email Replies Sync** (Interval: `2 minutes`): Reads inbox replies from customers, passes text through the Gemini reasoning engine, and triggers follow-up actions.
3. **Razorpay Payment Reconciler** (Interval: `1 minute`): Proactively queries the Razorpay API for all active payment links to guarantee invoice status updates even in the event of dropped webhooks.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Push database schema
prisma db push
prisma generate

# 3. Launch server
uvicorn src.recovery_agent_server.main:app --host 0.0.0.0 --port 8000 --reload
```
