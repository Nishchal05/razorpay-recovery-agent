import { fetchClient } from './client';
import { Invoice } from '../types';

export const getInvoices = (): Promise<Invoice[]> => {
  return fetchClient('/invoices', {
    method: 'GET',
  });
};

export const createInvoice = (data: Omit<Invoice, 'invoice_id' | 'created_at' | 'updated_at' | 'company'>): Promise<Invoice> => {
  return fetchClient('/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
