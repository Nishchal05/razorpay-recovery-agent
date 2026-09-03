'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '../../../lib/api/invoices';
import { getCompanies } from '../../../lib/api/companies';
import { Invoice, Company, ActivityEvent } from '../../../lib/types';
import { KpiCard } from '../../../components/dashboard/KpiCard';
import { ActivityTimeline } from '../../../components/dashboard/ActivityTimeline';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { useAuth } from '../../../context/AuthContext';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Activity,
  FileText,
  Users,
  PlusCircle,
  ArrowRight,
  Clock,
  MessageCircle,
} from 'lucide-react';

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

function statusBadge(status: string, amountStatus: boolean) {
  if (amountStatus) return { label: 'Paid', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
  if (status === 'DISPUTE') return { label: 'Disputed', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
  const now = new Date();
  return { label: 'Pending', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
}

function isOverdue(invoice: Invoice) {
  return !invoice.invoice_amount_status && new Date(invoice.invoice_due_date) < new Date();
}

// Derive mock activity events from real invoice data
function deriveActivity(invoices: Invoice[], companies: Company[]): ActivityEvent[] {
  const companyMap = new Map(companies.map((c) => [c.company_id, c]));
  return invoices
    .filter((inv) => !inv.invoice_amount_status)
    .slice(0, 8)
    .map((inv, i): ActivityEvent => {
      const company = companyMap.get(inv.company_id);
      const ch = company?.preferred_channel ?? 'WHATSAPP';
      const type = isOverdue(inv)
        ? ch === 'EMAIL' ? 'EMAIL_SENT' : 'WHATSAPP_SENT'
        : 'OVERDUE_DETECTED';
      return {
        id: inv.invoice_id,
        type,
        invoice_name: inv.invoice_name,
        company_name: company?.company_name ?? `Company #${inv.company_id}`,
        amount: Number(inv.invoice_amount),
        timestamp: inv.updated_at ?? inv.created_at ?? new Date().toISOString(),
        channel: ch,
      };
    });
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: getInvoices,
  });

  const { data: companies = [], isLoading: coLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies,
  });

  const isLoading = invLoading || coLoading;

  // Compute KPIs from real data
  const totalOutstanding = invoices
    .filter((i) => !i.invoice_amount_status)
    .reduce((s, i) => s + Number(i.invoice_amount), 0);

  const overdueInvoices = invoices.filter(isOverdue);
  const overdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.invoice_amount), 0);

  const recoveredAmount = invoices
    .filter((i) => i.invoice_amount_status)
    .reduce((s, i) => s + Number(i.invoice_amount), 0);

  const totalAmount = invoices.reduce((s, i) => s + Number(i.invoice_amount), 0);
  const recoveryRate = totalAmount > 0 ? Math.round((recoveredAmount / totalAmount) * 100) : 0;

  const activeInvoices = invoices.filter((i) => !i.invoice_amount_status).length;
  const activityEvents = deriveActivity(invoices, companies);

  const isEmpty = !isLoading && invoices.length === 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {user?.business_name ? `${user.business_name}` : 'Dashboard'}
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">AI-powered receivables recovery</p>
        </div>
        <Link
          href="/invoices/create"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.25)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)]"
        >
          <PlusCircle className="w-4 h-4" />
          Create Invoice
        </Link>
      </div>

      {isEmpty ? (
        /* ── Empty state ── */
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
            <Activity className="w-7 h-7 text-indigo-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Your recovery dashboard is ready.</h2>
          <p className="text-zinc-500 text-sm mb-8 max-w-sm mx-auto">
            Create your first invoice to start tracking receivables and let AI handle follow-ups.
          </p>
          <Link
            href="/invoices/create"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Create Invoice
          </Link>
        </div>
      ) : (
        <>
          {/* ── KPI cards ── */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
              <KpiCard label="Total Outstanding" value={formatINR(totalOutstanding)} icon={Activity} color="indigo" />
              <KpiCard label="Overdue Amount" value={formatINR(overdueAmount)} icon={AlertTriangle} color="amber" />
              <KpiCard label="Recovered" value={formatINR(recoveredAmount)} icon={TrendingUp} color="emerald" />
              <KpiCard label="Recovery Rate" value={`${recoveryRate}%`} icon={CheckCircle2} color="blue" />
              <KpiCard label="Active Invoices" value={activeInvoices} icon={FileText} color="indigo" />
              <KpiCard label="Customers" value={companies.length} icon={Users} color="indigo" />
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* ── Left column: Overdue + Recent invoices ── */}
            <div className="xl:col-span-2 space-y-6">

              {/* Overdue invoices */}
              {overdueInvoices.length > 0 && (
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-amber-500/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span className="text-white font-semibold text-sm">Overdue Invoices</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold">
                        {overdueInvoices.length}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-white/5">
                    {overdueInvoices.slice(0, 5).map((inv) => {
                      const co = companies.find((c) => c.company_id === inv.company_id);
                      const days = Math.floor((Date.now() - new Date(inv.invoice_due_date).getTime()) / 86400000);
                      return (
                        <div key={inv.invoice_id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                          <div className="min-w-0">
                            <div className="text-white text-sm font-medium">{inv.invoice_name}</div>
                            <div className="text-zinc-500 text-xs">{co?.company_name ?? `Company #${inv.company_id}`}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-amber-400 font-bold text-sm">₹{Number(inv.invoice_amount).toLocaleString('en-IN')}</div>
                            <div className="text-zinc-600 text-xs">{days}d overdue</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent invoices */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-zinc-400" />
                    <span className="text-white font-semibold text-sm">Recent Invoices</span>
                  </div>
                  <Link href="/invoices" className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Invoice', 'Customer', 'Amount', 'Due', 'Status'].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs text-zinc-600 font-semibold uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {invoices.slice(0, 8).map((inv) => {
                        const co = companies.find((c) => c.company_id === inv.company_id);
                        const badge = statusBadge(inv.invoice_status, inv.invoice_amount_status);
                        return (
                          <tr key={inv.invoice_id} className="hover:bg-white/[0.02] transition-colors cursor-pointer">
                            <td className="px-5 py-3">
                              <Link href={`/invoices/${inv.invoice_id}`} className="text-white font-medium hover:text-indigo-300 transition-colors">{inv.invoice_name}</Link>
                            </td>
                            <td className="px-5 py-3 text-zinc-400">{co?.company_name ?? `#${inv.company_id}`}</td>
                            <td className="px-5 py-3 text-white font-semibold">₹{Number(inv.invoice_amount).toLocaleString('en-IN')}</td>
                            <td className="px-5 py-3 text-zinc-500">
                              {new Date(inv.invoice_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </td>
                            <td className="px-5 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${badge.cls}`}>{badge.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Right column: Activity + Customers ── */}
            <div className="space-y-6">
              {/* AI Activity */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.8)] animate-pulse" />
                  <span className="text-white font-semibold text-sm">AI Recovery Activity</span>
                </div>
                <div className="p-5">
                  <ActivityTimeline events={activityEvents} />
                </div>
              </div>

              {/* Customer spotlight */}
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-zinc-400" />
                    <span className="text-white font-semibold text-sm">Customers</span>
                  </div>
                  <Link href="/customers" className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-1">
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="divide-y divide-white/5">
                  {companies.slice(0, 5).map((co) => {
                    const outstanding = invoices
                      .filter((i) => i.company_id === co.company_id && !i.invoice_amount_status)
                      .reduce((s, i) => s + Number(i.invoice_amount), 0);
                    const active = invoices.filter((i) => i.company_id === co.company_id && !i.invoice_amount_status).length;

                    return (
                      <Link
                        key={co.company_id}
                        href={`/customers/${co.company_id}`}
                        className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-white text-sm font-medium truncate">{co.company_name}</div>
                          <div className="text-zinc-600 text-xs">{active} active invoice{active !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-white text-sm font-semibold">
                            {outstanding > 0 ? `₹${Number(outstanding).toLocaleString('en-IN')}` : <span className="text-emerald-400">Cleared</span>}
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {co.preferred_channel === 'WHATSAPP' && <MessageCircle className="w-3 h-3 text-green-500" />}
                            {co.preferred_channel === 'EMAIL' && <span className="text-zinc-600 text-[10px]">Email</span>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {companies.length === 0 && (
                    <div className="px-5 py-8 text-center">
                      <p className="text-zinc-500 text-sm">No customers yet.</p>
                      <p className="text-zinc-600 text-xs mt-1">Customers are added when you create an invoice.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
