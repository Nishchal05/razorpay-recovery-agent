import { fetchClient } from './client';
import { Company } from '../types';

export const getCompanies = (): Promise<Company[]> =>
  fetchClient('/company', { method: 'GET' });

export const getCompany = (id: number): Promise<Company> =>
  fetchClient(`/company/${id}`, { method: 'GET' });

export const createCompany = (
  data: Omit<Company, 'company_id' | 'created_at' | 'updated_at'>
): Promise<Company> =>
  fetchClient('/company', { method: 'POST', body: JSON.stringify(data) });

