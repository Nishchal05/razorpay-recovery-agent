import { fetchClient } from './client';
import { CallLog } from '../types';

export interface VoiceCallResponse {
  success: boolean;
  call_id: number;
  signed_url?: string;
  dynamic_variables: Record<string, string>;
  elevenlabs_configured: boolean;
  elevenlabs_error?: string;
  invoice: {
    invoice_id: number;
    invoice_name: string;
    invoice_amount: number;
    customer_name: string;
    customer_phone: string;
    payment_link?: string;
  };
}

export const initiateVoiceCall = (invoiceId: number): Promise<VoiceCallResponse> => {
  return fetchClient('/api/recovery/voice/call', {
    method: 'POST',
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
};

export const getInvoiceCalls = (invoiceId: number): Promise<CallLog[]> => {
  return fetchClient(`/api/recovery/invoices/${invoiceId}/calls`, {
    method: 'GET',
  });
};

export const sendWhatsAppReminder = (invoiceId: number): Promise<{ success: boolean; message: string; message_id?: string }> => {
  return fetchClient('/api/recovery/send-whatsapp', {
    method: 'POST',
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
};

export const sendEmailReminder = (invoiceId: number): Promise<{ success: boolean; message: string; result?: unknown }> => {
  return fetchClient('/api/recovery/send-email', {
    method: 'POST',
    body: JSON.stringify({ invoice_id: invoiceId }),
  });
};
