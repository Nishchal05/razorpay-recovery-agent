'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCompanies, createCompany } from '../../../../lib/api/companies';
import { createInvoice } from '../../../../lib/api/invoices';
import { Company } from '../../../../lib/types';
import { Modal } from '../../../../components/ui/Modal';
import { Spinner } from '../../../../components/ui/Spinner';
import { useToast } from '../../../../components/ui/Toast';
import {
  Search, PlusCircle, CheckCircle2, ArrowRight, Calendar,
  Building2, FileText, IndianRupee, MessageCircle, Mail, Phone
} from 'lucide-react';

// ── Inline customer creation form ─────────────────────────────────────────────

function CreateCustomerForm({ onSuccess }: { onSuccess: (c: Company) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    company_name: '', company_address: '', company_phone: '',
    company_email: '', preferred_channel: 'WHATSAPP' as 'WHATSAPP' | 'EMAIL' | 'VOICE_CALL',
  });
  const [error, setError] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const { mutate, isPending } = useMutation({
    mutationFn: createCompany,
    onSuccess: (company) => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      onSuccess(company);
    },
    onError: (err: Error) => setError(err.message),
  });

  const field = (k: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <div key={k}>
      <label className="block text-zinc-400 text-xs font-medium mb-1">{label}</label>
      <input
        type={type} value={form[k]} onChange={set(k)}
        placeholder={placeholder} required={k !== 'company_address'}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
      />
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); mutate(form); }} className="space-y-3">
      {field('company_name', 'Company Name', 'text', 'XYZ Pvt Ltd')}
      {field('company_email', 'Email', 'email', 'billing@xyz.com')}
      {field('company_phone', 'Phone', 'tel', '+91 98765 43210')}
      {field('company_address', 'Address', 'text', '123 MG Road, Bangalore')}
      <div>
        <label className="block text-zinc-400 text-xs font-medium mb-1.5">Preferred Recovery Channel</label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, preferred_channel: 'WHATSAPP' }))}
            className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              form.preferred_channel === 'WHATSAPP'
                ? 'bg-green-500/20 border-green-500/50 text-green-300 ring-2 ring-green-500/30'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <MessageCircle className="w-4 h-4 text-green-400" />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, preferred_channel: 'EMAIL' }))}
            className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              form.preferred_channel === 'EMAIL'
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 ring-2 ring-blue-500/30'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-400" />
            <span>Email</span>
          </button>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, preferred_channel: 'VOICE_CALL' }))}
            className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              form.preferred_channel === 'VOICE_CALL'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 ring-2 ring-amber-500/30'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Phone className="w-4 h-4 text-amber-400" />
            <span>Voice Call</span>
          </button>
        </div>
      </div>
      {error && <p className="text-rose-400 text-xs">{error}</p>}
      <button
        type="submit" disabled={isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all disabled:opacity-60"
      >
        {isPending ? <Spinner size="sm" /> : <>Create Customer <ArrowRight className="w-4 h-4" /></>}
      </button>
    </form>
  );
}

// ── Customer selector ─────────────────────────────────────────────────────────

function CustomerSelector({
  value, onChange, companies, onOpenCreate
}: {
  value: Company | null;
  onChange: (c: Company | null) => void;
  companies: Company[];
  onOpenCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = companies.filter(c =>
    c.company_name.toLowerCase().includes(query.toLowerCase()) ||
    c.company_email?.toLowerCase().includes(query.toLowerCase())
  );

  const channelIcon = (ch: string) => {
    if (ch === 'WHATSAPP') return <MessageCircle className="w-3 h-3 text-green-400" />;
    if (ch === 'EMAIL') return <Mail className="w-3 h-3 text-blue-400" />;
    return <Phone className="w-3 h-3 text-amber-400" />;
  };

  return (
    <div className="relative" ref={ref}>
      {value ? (
        <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
          <div>
            <div className="text-white text-sm font-semibold">{value.company_name}</div>
            <div className="text-indigo-400/70 text-xs">{value.company_email}</div>
          </div>
          <button type="button" onClick={() => { onChange(null); setQuery(''); }} className="text-zinc-500 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-all">Change</button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search existing customer..."
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
          />
        </div>
      )}

      {open && !value && (
        <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-xl border border-white/10 bg-[#0f1117] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={c.company_id}
              type="button"
              onClick={() => { onChange(c); setQuery(''); setOpen(false); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
            >
              <div>
                <div className="text-white text-sm font-medium">{c.company_name}</div>
                <div className="text-zinc-500 text-xs">{c.company_email}</div>
              </div>
              {channelIcon(c.preferred_channel)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); onOpenCreate(); }}
            className="w-full flex items-center gap-2 px-4 py-3 text-indigo-400 hover:bg-indigo-500/10 transition-colors text-sm font-semibold border-t border-white/5"
          >
            <PlusCircle className="w-4 h-4" /> Create New Customer
          </button>
        </div>
      )}
    </div>
  );
}

// ── Invoice Preview ───────────────────────────────────────────────────────────

function InvoicePreview({ form, customer }: {
  form: { invoice_name: string; invoice_amount: string; invoice_due_date: string; };
  customer: Company | null;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f1117] overflow-hidden sticky top-6">
      <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
      <div className="p-6">
        <div className="text-xs text-zinc-600 uppercase tracking-widest font-semibold mb-4">Invoice Preview</div>

        <div className="space-y-4">
          <div className="pb-4 border-b border-white/8">
            <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Invoice</div>
            <div className="text-white font-bold text-lg">{form.invoice_name || '—'}</div>
          </div>
          <div className="pb-4 border-b border-white/8">
            <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Customer</div>
            <div className="text-white font-semibold">{customer?.company_name ?? '—'}</div>
            {customer && <div className="text-zinc-500 text-xs mt-0.5">{customer.company_email}</div>}
          </div>
          <div className="pb-4 border-b border-white/8">
            <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Amount</div>
            <div className="text-white font-bold text-2xl">
              {form.invoice_amount ? `₹${Number(form.invoice_amount).toLocaleString('en-IN')}` : '—'}
            </div>
          </div>
          <div className="pb-4 border-b border-white/8">
            <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Due Date</div>
            <div className="text-white font-semibold">
              {form.invoice_due_date
                ? new Date(form.invoice_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Channel</div>
            <div className="flex items-center gap-2">
              {customer?.preferred_channel === 'WHATSAPP' && <><MessageCircle className="w-4 h-4 text-green-400" /><span className="text-green-400 text-sm font-semibold">WhatsApp</span></>}
              {customer?.preferred_channel === 'EMAIL' && <><Mail className="w-4 h-4 text-blue-400" /><span className="text-blue-400 text-sm font-semibold">Email</span></>}
              {customer?.preferred_channel === 'VOICE_CALL' && <><Phone className="w-4 h-4 text-amber-400" /><span className="text-amber-400 text-sm font-semibold">Voice</span></>}
              {!customer && <span className="text-zinc-600 text-sm">—</span>}
            </div>
          </div>
        </div>

        <div className="mt-6 px-4 py-3 rounded-xl bg-indigo-500/8 border border-indigo-500/15">
          <div className="text-indigo-400/70 text-xs font-medium">After creating this invoice, the AI recovery agent will automatically monitor it and send reminders via the customer's preferred channel when it becomes overdue.</div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CreateInvoicePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Company | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    invoice_name: '',
    invoice_amount: '',
    invoice_due_date: '',
    description: '',
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: getCompanies });

  const { mutate, isPending } = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast('Invoice created! The AI agent will monitor it for follow-ups.', 'success');
      setSuccess(true);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) { setError('Please select a customer.'); return; }
    setError('');
    mutate({
      invoice_name: form.invoice_name,
      invoice_amount: Number(form.invoice_amount),
      invoice_due_date: form.invoice_due_date,
      invoice_status: 'PENDING',
      invoice_amount_status: false,
      company_id: customer.company_id,
    });
  };

  if (success) {
    return (
      <div className="p-6 lg:p-8 max-w-2xl mx-auto pt-24 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Invoice Created!</h1>
        <p className="text-zinc-500 mb-8">The AI recovery agent will monitor this invoice and automatically follow up when needed.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => router.push('/invoices')} className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:text-white text-sm font-semibold transition-all">
            View All Invoices
          </button>
          <button onClick={() => { setSuccess(false); setForm({ invoice_name: '', invoice_amount: '', invoice_due_date: '', description: '' }); setCustomer(null); }} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all">
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Create Invoice</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Fill in the details below — the AI agent will handle follow-ups automatically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5">

          {/* Customer selector */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <label className="block text-zinc-300 text-sm font-semibold mb-3">
              <Building2 className="inline w-4 h-4 mr-1.5 -mt-0.5" />Customer
            </label>
            <CustomerSelector
              value={customer}
              onChange={setCustomer}
              companies={companies}
              onOpenCreate={() => setShowCreate(true)}
            />
          </div>

          {/* Invoice details */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 space-y-4">
            <div className="text-zinc-300 text-sm font-semibold mb-1">
              <FileText className="inline w-4 h-4 mr-1.5 -mt-0.5" />Invoice Details
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5">Invoice Number / Name</label>
              <input
                type="text"
                value={form.invoice_name}
                onChange={e => setForm(p => ({ ...p, invoice_name: e.target.value }))}
                placeholder="INV-1024"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-400 text-xs font-medium mb-1.5">Amount (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <input
                    type="number"
                    value={form.invoice_amount}
                    onChange={e => setForm(p => ({ ...p, invoice_amount: e.target.value }))}
                    placeholder="50000"
                    min="1"
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-medium mb-1.5">Due Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <input
                    type="date"
                    value={form.invoice_due_date}
                    onChange={e => setForm(p => ({ ...p, invoice_due_date: e.target.value }))}
                    required
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-indigo-500/60 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5">Description / Notes (optional)</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Web development services for Q3 2026..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/60 transition-all resize-none"
              />
            </div>
          </div>

          {error && <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
          >
            {isPending ? <Spinner size="sm" /> : <>Create Invoice <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>

        {/* Right: Preview */}
        <div className="lg:col-span-2">
          <InvoicePreview form={form} customer={customer} />
        </div>
      </div>

      {/* Modal for creating a customer placed outside any form tag */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Customer" description="Add a new customer to your account.">
        <CreateCustomerForm onSuccess={(c) => { setCustomer(c); setShowCreate(false); }} />
      </Modal>
    </div>
  );
}
