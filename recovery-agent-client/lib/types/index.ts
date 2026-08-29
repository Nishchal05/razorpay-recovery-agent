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
  company_id: number;
  company?: Company;
  created_at?: string;
  updated_at?: string;
}
