export type PreferredChannel = 'WHATSAPP' | 'EMAIL' | 'VOICE_CALL';

export interface Company {
  company_id: number;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  preferred_channel: PreferredChannel;
  created_at?: string;
  updated_at?: string;
}

export type InvoiceStatus = 'PENDING' | 'DISPUTE' | 'PAID';

export interface Invoice {
  invoice_id: number;
  invoice_name: string;
  invoice_due_date: string;
  invoice_amount: number | string; // Prisma Decimal serialises as string over JSON
  invoice_amount_status: boolean;
  invoice_status: InvoiceStatus;
  payment_link?: string;
  payment_link_id?: string;
  company_id: number;
  company?: Company;
  created_at?: string;
  updated_at?: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface Business {
  id: number;
  business_name: string;
  owner_name: string;
  email: string;
  created_at?: string;
}

export type AuthUser = Business;

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface SignupPayload {
  business_name: string;
  owner_name: string;
  email: string;
  password: string;
}

export interface SigninPayload {
  email: string;
  password: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface KpiStats {
  total_outstanding: number;
  overdue_amount: number;
  recovered_amount: number;
  recovery_rate: number;
  active_invoices: number;
  total_customers: number;
}

export type ActivityType =
  | 'WHATSAPP_SENT'
  | 'EMAIL_SENT'
  | 'PAYMENT_LINK_CREATED'
  | 'PROMISE_RECEIVED'
  | 'ESCALATED'
  | 'PAID'
  | 'OVERDUE_DETECTED'
  | 'REMINDER_CAPPED';

export interface ActivityEvent {
  id: number;
  type: ActivityType;
  invoice_name: string;
  company_name: string;
  amount?: number;
  timestamp: string;
  channel?: string;
  message?: string;
}

export interface CustomerSummary {
  company_id: number;
  company_name: string;
  company_email: string;
  company_phone: string;
  preferred_channel: PreferredChannel;
  outstanding_amount: number;
  active_invoices: number;
  last_invoice_date?: string;
}
