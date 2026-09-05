# 🖥️ Recovery Agent Client (Next.js Dashboard)

The frontend application for the **Razorpay Autonomous AI Debt Recovery Agent**. Built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS 4**, **Framer Motion**, and **TanStack React Query**.

---

## 🎨 Features & Capabilities

- **CFO Analytics Dashboard**: Live metrics on total receivables, recovery rates, overdue amounts, and cash collections.
- **Invoices & Dispute Manager**: Detailed list of invoices with status chips (`PENDING`, `OVERDUE`, `PAID`, `DISPUTED`), direct Razorpay payment link inspection, and manual recovery triggers.
- **AI Recovery Orchestrator Console**: Real-time view of customer interactions across WhatsApp, ElevenLabs Voice AI, and Gmail.
- **Integrations Hub**: Live status indicators and credentials management for:
  - Razorpay Payment Gateway & Webhooks
  - Meta WhatsApp Cloud API
  - ElevenLabs Conversational Voice Agent
  - Google Cloud / Gmail API OAuth2
- **Responsive & Dark-Themed UI**: Built with modern typography, smooth animations, and clean financial data tables.

---

## 📁 Application Routes

| Route | Purpose |
| :--- | :--- |
| `/` | Marketing & Platform Showcase Landing Page |
| `/dashboard` | High-level financial analytics and recovery metrics |
| `/invoices` | Accounts receivable ledger, search, filter, and payment verification |
| `/customers` | Customer debt profiles, contact details, and sentiment history |
| `/recovery` | Live multi-agent execution logs and omnichannel transcript viewer |
| `/integrations`| Integration status badges and webhook configuration guidance |
| `/settings` | Organization profile and operational configuration |
| `/signin`, `/signup` | Secure authentication flows |

---

## 🔑 Environment Variables

Copy `.env.example` to `.env.local`:

```env
# Backend API Base URL
NEXT_PUBLIC_API_URL="http://localhost:8000"

# Set to true for quick development / evaluation bypass
NEXT_PUBLIC_AUTH_BYPASS="false"

# Integration status flags
NEXT_PUBLIC_META_CONFIGURED="true"
NEXT_PUBLIC_RAZORPAY_CONFIGURED="true"
NEXT_PUBLIC_ELEVENLABS_CONFIGURED="true"
```

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start Next.js development server
npm run dev
```

The application will be accessible at [http://localhost:3000](http://localhost:3000).
