"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { createInvoice } from '../../lib/api/invoices';
import { getCompanies } from '../../lib/api/companies';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CompanyForm } from '../companies/CompanyForm';

const invoiceSchema = z.object({
  invoice_name:    z.string().min(2, 'Invoice name is required'),
  company_id:      z.number().min(1, 'Company is required'),
  invoice_amount:  z.number().positive('Amount must be positive'),
  invoice_due_date: z.string().min(1, 'Due date is required'),
  invoice_status:  z.enum(['PENDING', 'DISPUTE', 'PAID']),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
  onSuccess?: () => void;
}

// ── Inline Company Creator Modal ────────────────────────────────────────────
function CompanyCreatorModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const queryClient = useQueryClient();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      {/* Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1117] shadow-[0_0_60px_rgba(79,70,229,0.15)] overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-white">Add New Customer</h3>
              <p className="text-zinc-500 text-sm mt-0.5">Add a new customer to create this invoice for.</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
            >
              ✕
            </button>
          </div>
          <CompanyForm
            onSuccess={async () => {
              await queryClient.invalidateQueries({ queryKey: ['companies'] });
              const companies = queryClient.getQueryData<{ company_id: number }[]>(['companies']);
              const latest = companies?.[companies.length - 1];
              if (latest) onCreated(latest.company_id);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Company Combobox ─────────────────────────────────────────────────────────
function CompanyCombobox({
  companies,
  value,
  onChange,
  onAddNew,
}: {
  companies: { company_id: number; company_name: string }[];
  value: number | null;
  onChange: (id: number) => void;
  onAddNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = companies.find(c => c.company_id === value);
  const filtered = companies.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase())
  );

  const selectClass = "flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:border-indigo-500/40 transition-all cursor-pointer text-left";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className={selectClass}
        onClick={() => setOpen(o => !o)}
      >
        <span className={selected ? 'text-white' : 'text-zinc-600'}>
          {selected ? selected.company_name : 'Select a company…'}
        </span>
        <span className="ml-auto text-zinc-600">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-[#0f1117] shadow-[0_8px_30px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <input
              autoFocus
              type="text"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-indigo-500/50"
              placeholder="Search companies…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-2 text-sm text-zinc-500">No companies found</li>
            )}
            {filtered.map(c => (
              <li key={c.company_id}>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-indigo-500/10 ${value === c.company_id ? 'text-indigo-400 bg-indigo-500/5' : 'text-zinc-300'}`}
                  onClick={() => { onChange(c.company_id); setOpen(false); setSearch(''); }}
                >
                  {c.company_name}
                </button>
              </li>
            ))}
          </ul>
          {/* Add new company option */}
          <div className="border-t border-white/5 p-2">
            <button
              type="button"
              onClick={() => { setOpen(false); onAddNew(); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              <span>Add new company…</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main InvoiceForm ─────────────────────────────────────────────────────────
export function InvoiceForm({ onSuccess }: InvoiceFormProps) {
  const queryClient = useQueryClient();
  const [showCompanyModal, setShowCompanyModal] = useState(false);

  const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies,
  });

  const { register, handleSubmit, setValue, watch, formState: { errors }, reset } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { invoice_status: 'PENDING' },
  });

  const selectedCompanyId = watch('company_id');

  const mutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      reset();
      if (onSuccess) onSuccess();
    },
  });

  const onSubmit: SubmitHandler<InvoiceFormValues> = (data) => {
    mutation.mutate({ ...data, invoice_amount_status: false });
  };

  const inputClass = "flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:border-indigo-500/40 transition-all";
  const selectClass = "flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:border-indigo-500/40 transition-all";

  return (
    <>
      {showCompanyModal && (
        <CompanyCreatorModal
          onClose={() => setShowCompanyModal(false)}
          onCreated={(id) => {
            setValue('company_id', id);
          }}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Invoice Name */}
        <div className="space-y-1.5">
          <Label htmlFor="invoice_name" className="text-zinc-300 text-sm font-medium">Invoice Name / Number</Label>
          <Input id="invoice_name" placeholder="INV-2025-001" {...register('invoice_name')} className={inputClass} />
          {errors.invoice_name && <p className="text-xs text-red-400 mt-1">{errors.invoice_name.message}</p>}
        </div>

        {/* Company — smart combobox */}
        <div className="space-y-1.5">
          <Label className="text-zinc-300 text-sm font-medium">Customer</Label>
          {isLoadingCompanies ? (
            <div className="h-10 rounded-lg border border-zinc-800 bg-zinc-900/60 animate-pulse" />
          ) : (
            <CompanyCombobox
              companies={companies}
              value={selectedCompanyId ?? null}
              onChange={(id) => setValue('company_id', id)}
              onAddNew={() => setShowCompanyModal(true)}
            />
          )}
          {errors.company_id && <p className="text-xs text-red-400 mt-1">{errors.company_id.message}</p>}
        </div>

        {/* Amount + Due Date side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="invoice_amount" className="text-zinc-300 text-sm font-medium">Amount (₹)</Label>
            <Input
              id="invoice_amount"
              type="number"
              step="0.01"
              placeholder="80000"
              {...register('invoice_amount', { valueAsNumber: true })}
              className={inputClass}
            />
            {errors.invoice_amount && <p className="text-xs text-red-400 mt-1">{errors.invoice_amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invoice_due_date" className="text-zinc-300 text-sm font-medium">Due Date</Label>
            <Input id="invoice_due_date" type="date" {...register('invoice_due_date')} className={inputClass} />
            {errors.invoice_due_date && <p className="text-xs text-red-400 mt-1">{errors.invoice_due_date.message}</p>}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label htmlFor="invoice_status" className="text-zinc-300 text-sm font-medium">Status</Label>
          <select id="invoice_status" {...register('invoice_status')} className={selectClass}>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="DISPUTE">Dispute</option>
          </select>
          {errors.invoice_status && <p className="text-xs text-red-400 mt-1">{errors.invoice_status.message}</p>}
        </div>

        {/* Error */}
        {mutation.isError && (
          <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create invoice'}
          </div>
        )}

        <Button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.25)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)]"
        >
          {mutation.isPending ? 'Creating…' : 'Create Invoice'}
        </Button>
      </form>
    </>
  );
}
