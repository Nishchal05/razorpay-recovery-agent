'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '../../../lib/api/invoices';
import { getCompanies } from '../../../lib/api/companies';
import { Invoice, Company } from '../../../lib/types';
import { SkeletonRow } from '../../../components/ui/Skeleton';
import { useState } from 'react';
import { PlusCircle, FileText, Search, ChevronDown } from 'lucide-react';

function StatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.invoice_amount_status)
    return <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold">Paid</span>;
  if (invoice.invoice_status === 'DISPUTE')
    return <span className="text-xs px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20 font-semibold">Disputed</span>;
  if (new Date(invoice.invoice_due_date) < new Date())
    return <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20 font-semibold">Overdue</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 font-semibold">Pending</span>;
}

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue' | 'paid' | 'pending'>('all');

  const { data: invoices = [], isLoading: invLoading } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: getCompanies });

  const companyMap = new Map(companies.map((c: Company) => [c.company_id, c]));

  const filtered = invoices.filter((inv: Invoice) => {
    const q = search.toLowerCase();
    const company = companyMap.get(inv.company_id);
    const matchSearch = !q || inv.invoice_name.toLowerCase().includes(q) || company?.company_name.toLowerCase().includes(q);
    const overdue = !inv.invoice_amount_status && new Date(inv.invoice_due_date) < new Date();
    const matchFilter =
      filter === 'all' ||
      (filter === 'overdue' && overdue) ||
      (filter === 'paid' && inv.invoice_amount_status) ||
      (filter === 'pending' && !inv.invoice_amount_status && !overdue);
    return matchSearch && matchFilter;
  });

  const tabs: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'pending', label: 'Pending' },
    { key: 'paid', label: 'Paid' },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{invoices.length} total invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/invoices/create"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.25)]"
        >
          <PlusCircle className="w-4 h-4" /> Create Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search invoices or customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
          />
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === t.key ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
        {filtered.length === 0 && !invLoading ? (
          <div className="py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-white font-semibold mb-1">No invoices found</p>
            <p className="text-zinc-500 text-sm mb-6">
              {search || filter !== 'all' ? 'Try adjusting your search or filter.' : "Create your first invoice to get started."}
            </p>
            {filter === 'all' && !search && (
              <Link
                href="/invoices/create"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all"
              >
                <PlusCircle className="w-4 h-4" /> Create Invoice
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Invoice', 'Customer', 'Amount', 'Due Date', 'Status', 'Channel'].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs text-zinc-600 font-semibold uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)
                : filtered.map((inv: Invoice) => {
                    const co = companyMap.get(inv.company_id);
                    return (
                      <tr key={inv.invoice_id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5">
                          <Link href={`/invoices/${inv.invoice_id}`} className="text-white font-medium hover:text-indigo-300 transition-colors">
                            {inv.invoice_name}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-zinc-400">{co?.company_name ?? `#${inv.company_id}`}</td>
                        <td className="px-5 py-3.5 text-white font-semibold">₹{Number(inv.invoice_amount).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-zinc-500">
                          {new Date(inv.invoice_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3.5"><StatusBadge invoice={inv} /></td>
                        <td className="px-5 py-3.5 text-zinc-500 text-xs capitalize">{co?.preferred_channel?.toLowerCase().replace('_', ' ') ?? '—'}</td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
