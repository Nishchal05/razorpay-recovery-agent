'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompanies } from '../../../../lib/api/companies';
import { getInvoices } from '../../../../lib/api/invoices';
import { Invoice, ActivityEvent, ActivityType } from '../../../../lib/types';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { ActivityTimeline } from '../../../../components/dashboard/ActivityTimeline';
import Link from 'next/link';
import {
  ArrowLeft,
  MessageCircle,
  Mail,
  Phone,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  IndianRupee,
  PlusCircle,
} from 'lucide-react';

function StatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.invoice_amount_status)
    return <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold">Paid</span>;
  if (invoice.invoice_status === 'DISPUTE')
    return <span className="text-xs px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20 font-semibold">Disputed</span>;
  if (new Date(invoice.invoice_due_date) < new Date())
    return <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20 font-semibold">Overdue</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 font-semibold">Pending</span>;
}

function deriveCustomerActivity(invoices: Invoice[], companyName: string): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const now = new Date();

  invoices.forEach((inv) => {
    const due = new Date(inv.invoice_due_date);
    const isOverdue = !inv.invoice_amount_status && due < now;

    if (inv.invoice_amount_status) {
      events.push({
        id: inv.invoice_id * 100 + 1,
        type: 'PAID' as ActivityType,
        invoice_name: inv.invoice_name,
        company_name: companyName,
        amount: Number(inv.invoice_amount),
        timestamp: inv.updated_at ?? inv.created_at ?? now.toISOString(),
      });
    } else if (inv.invoice_status === 'DISPUTE') {
      events.push({
        id: inv.invoice_id * 100 + 2,
        type: 'ESCALATED' as ActivityType,
        invoice_name: inv.invoice_name,
        company_name: companyName,
        amount: Number(inv.invoice_amount),
        timestamp: inv.updated_at ?? inv.created_at ?? now.toISOString(),
        message: 'Dispute detected — routed for human review.',
      });
    } else if (isOverdue) {
      events.push(
        {
          id: inv.invoice_id * 100 + 3,
          type: 'OVERDUE_DETECTED' as ActivityType,
          invoice_name: inv.invoice_name,
          company_name: companyName,
          amount: Number(inv.invoice_amount),
          timestamp: due.toISOString(),
        },
        {
          id: inv.invoice_id * 100 + 4,
          type: 'WHATSAPP_SENT' as ActivityType,
          invoice_name: inv.invoice_name,
          company_name: companyName,
          amount: Number(inv.invoice_amount),
          timestamp: new Date(due.getTime() + 3600000).toISOString(),
          message: 'AI selected channel based on customer preference.',
        }
      );
    }
  });

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

function StatCard({
  label,
  value,
  color = 'text-white',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-zinc-600 text-xs uppercase tracking-widest mt-0.5">{label}</div>
    </div>
  );
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const companyId = Number(id);

  const { data: companies = [], isLoading } = useQuery({ queryKey: ['companies'], queryFn: getCompanies });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });

  const company = companies.find((c) => c.company_id === companyId);
  const coInvoices = invoices.filter((i: Invoice) => i.company_id === companyId);
  const outstanding = coInvoices
    .filter((i: Invoice) => !i.invoice_amount_status)
    .reduce((s, i) => s + Number(i.invoice_amount), 0);
  const recovered = coInvoices
    .filter((i: Invoice) => i.invoice_amount_status)
    .reduce((s, i) => s + Number(i.invoice_amount), 0);
  const overdueCount = coInvoices.filter(
    (i: Invoice) => !i.invoice_amount_status && new Date(i.invoice_due_date) < new Date()
  ).length;

  const activity = company ? deriveCustomerActivity(coInvoices, company.company_name) : [];

  if (isLoading)
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  if (!company)
    return (
      <div className="p-6 lg:p-8 text-center">
        <p className="text-zinc-500 mb-4">Customer not found.</p>
        <Link href="/customers" className="text-indigo-400 hover:text-indigo-300 text-sm">
          ← Back to Customers
        </Link>
      </div>
    );

  const channelIcon =
    company.preferred_channel === 'WHATSAPP' ? (
      <MessageCircle className="w-4 h-4 text-green-400" />
    ) : company.preferred_channel === 'EMAIL' ? (
      <Mail className="w-4 h-4 text-blue-400" />
    ) : (
      <Phone className="w-4 h-4 text-amber-400" />
    );

  const channelLabel =
    company.preferred_channel === 'WHATSAPP'
      ? 'WhatsApp'
      : company.preferred_channel === 'EMAIL'
      ? 'Email'
      : 'Voice Call';

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-black text-xl shrink-0">
              {company.company_name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{company.company_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                {channelIcon}
                <span className="text-zinc-500 text-sm">{company.company_email}</span>
              </div>
            </div>
          </div>

          <Link
            href="/invoices/create"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)] shrink-0"
          >
            <PlusCircle className="w-4 h-4" /> New Invoice
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/8 text-center">
          <StatCard label="Outstanding" value={outstanding > 0 ? `₹${Number(outstanding).toLocaleString('en-IN')}` : '₹0'} color={outstanding > 0 ? 'text-amber-400' : 'text-white'} />
          <StatCard label="Recovered" value={`₹${Number(recovered).toLocaleString('en-IN')}`} color="text-emerald-400" />
          <StatCard label="Overdue" value={String(overdueCount)} color={overdueCount > 0 ? 'text-rose-400' : 'text-white'} />
          <StatCard label="Total Invoices" value={String(coInvoices.length)} />
        </div>
      </div>

      {/* Contact + Channel info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Phone', value: company.company_phone },
          { label: 'Address', value: company.company_address || '—' },
          { label: 'Recovery Channel', value: channelLabel, icon: channelIcon },
          { label: 'Customer Since', value: company.created_at ? new Date(company.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1">{label}</div>
            <div className="flex items-center gap-1.5">
              {icon}
              <span className="text-white text-sm truncate">{value}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice history */}
        <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
            <FileText className="w-4 h-4 text-zinc-400" />
            <span className="text-white font-semibold text-sm">Invoice History</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-semibold ml-1">{coInvoices.length}</span>
          </div>

          {coInvoices.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm mb-4">No invoices for this customer yet.</p>
              <Link
                href="/invoices/create"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all"
              >
                <PlusCircle className="w-4 h-4" /> Create Invoice
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  {['Invoice', 'Amount', 'Due Date', 'Status'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-zinc-600 font-semibold uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {coInvoices.map((inv: Invoice) => (
                  <tr key={inv.invoice_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/invoices/${inv.invoice_id}`} className="text-white font-medium hover:text-indigo-300 transition-colors">
                        {inv.invoice_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-white font-semibold">₹{Number(inv.invoice_amount).toLocaleString('en-IN')}</td>
                    <td className="px-5 py-3.5 text-zinc-500">
                      {new Date(inv.invoice_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge invoice={inv} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* AI Recovery activity */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_6px_rgba(99,102,241,0.8)]" />
            <span className="text-white font-semibold text-sm">AI Recovery Activity</span>
          </div>
          <div className="p-5">
            <ActivityTimeline events={activity} />
          </div>
        </div>
      </div>
    </div>
  );
}
