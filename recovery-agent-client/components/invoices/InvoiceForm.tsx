"use client";

import React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { createInvoice } from '../../lib/api/invoices';
import { getCompanies } from '../../lib/api/companies';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

const invoiceSchema = z.object({
  invoice_name: z.string().min(2, 'Invoice name is required'),
  company_id: z.number().min(1, 'Company is required'),
  invoice_amount: z.number().positive('Amount must be positive'),
  invoice_due_date: z.string().min(1, 'Due date is required'),
  invoice_status: z.enum(['PENDING', 'DISPUTE', 'PAID']),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  onSuccess?: () => void;
}

export function InvoiceForm({ onSuccess }: InvoiceFormProps) {
  const queryClient = useQueryClient();
  
  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_status: 'PENDING'
    }
  });

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      reset();
      if (onSuccess) onSuccess();
    },
  });

  const onSubmit: SubmitHandler<InvoiceFormValues> = (data) => {
    mutation.mutate({
      ...data,
      invoice_amount_status: false // default false as per original logic
    });
  };

  if (isLoadingCompanies) {
    return <div className="text-sm text-zinc-500">Loading companies...</div>;
  }

  if (companies.length === 0) {
    return (
      <div className="p-6 text-center border border-dashed rounded-lg border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <h3 className="font-medium mb-2 text-zinc-900 dark:text-zinc-100">No companies registered</h3>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          A company must be registered before you can create an invoice.
        </p>
        <Button asChild>
          <Link href="/companies">Add Company</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invoice_name">Invoice Name / Number</Label>
        <Input id="invoice_name" placeholder="INV-2023-001" {...register('invoice_name')} />
        {errors.invoice_name && <p className="text-sm text-red-500">{errors.invoice_name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company_id">Company</Label>
        <select
          id="company_id"
          {...register('company_id', { valueAsNumber: true })}
          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950"
        >
          <option value="">Select a company</option>
          {companies.map(c => (
            <option key={c.company_id} value={c.company_id}>{c.company_name}</option>
          ))}
        </select>
        {errors.company_id && <p className="text-sm text-red-500">{errors.company_id.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invoice_amount">Amount ($)</Label>
        <Input id="invoice_amount" type="number" step="0.01" placeholder="1000.00" {...register('invoice_amount', { valueAsNumber: true })} />
        {errors.invoice_amount && <p className="text-sm text-red-500">{errors.invoice_amount.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invoice_due_date">Due Date</Label>
        <Input id="invoice_due_date" type="date" {...register('invoice_due_date')} />
        {errors.invoice_due_date && <p className="text-sm text-red-500">{errors.invoice_due_date.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invoice_status">Status</Label>
        <select
          id="invoice_status"
          {...register('invoice_status')}
          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950"
        >
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="DISPUTE">Dispute</option>
        </select>
        {errors.invoice_status && <p className="text-sm text-red-500">{errors.invoice_status.message}</p>}
      </div>

      {mutation.isError && (
        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to create invoice'}
        </div>
      )}

      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? 'Creating...' : 'Add Invoice'}
      </Button>
    </form>
  );
}
