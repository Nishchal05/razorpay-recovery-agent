'use client';

import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '../../../lib/api/invoices';
import { getCompanies } from '../../../lib/api/companies';
import { Invoice, Company } from '../../../lib/types';
import { ActivityTimeline } from '../../../components/dashboard/ActivityTimeline';
import { ActivityEvent, ActivityType } from '../../../lib/types';
import { BrainCircuit, AlertTriangle, CheckCircle2, Clock, MessageCircle, Mail } from 'lucide-react';

function isOverdue(inv: Invoice) {
  return !inv.invoice_amount_status && new Date(inv.invoice_due_date) < new Date();
}

function deriveActivity(invoices: Invoice[], companies: Company[]): ActivityEvent[] {
  const cm = new Map(companies.map(c => [c.company_id, c]));
  return invoices.slice(0, 15).map((inv, i): ActivityEvent => {
    const co = cm.get(inv.company_id);
    const ch = co?.preferred_channel ?? 'WHATSAPP';
    let type: ActivityType;
    if (inv.invoice_amount_status) type = 'PAID';
    else if (inv.invoice_status === 'DISPUTE') type = 'ESCALATED';
    else if (isOverdue(inv)) type = ch === 'EMAIL' ? 'EMAIL_SENT' : 'WHATSAPP_SENT';
    else type = 'OVERDUE_DETECTED';
    return {
      id: inv.invoice_id,
      type,
      invoice_name: inv.invoice_name,
      company_name: co?.company_name ?? `#${inv.company_id}`,
      amount: Number(inv.invoice_amount),
      timestamp: inv.updated_at ?? inv.created_at ?? new Date().toISOString(),
    };
  });
}

export default function RecoveryPage() {
  const { data: invoices = [], isLoading: invLoading } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: getCompanies });

  const overdueInvoices = invoices.filter(isOverdue);
  const activity = deriveActivity(invoices, companies);
  const companyMap = new Map(companies.map((c: Company) => [c.company_id, c]));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Recovery Overview</h1>
        <p className="text-zinc-500 text-sm mt-0.5">AI-powered recovery status across all invoices</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: active recovery cases */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-white font-semibold">Active Recovery Cases</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-semibold">{overdueInvoices.length}</span>
          </div>

          {overdueInvoices.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] py-16 text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-white font-semibold">No overdue invoices!</p>
              <p className="text-zinc-500 text-sm mt-1">All invoices are within their due dates.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueInvoices.map((inv: Invoice) => {
                const co = companyMap.get(inv.company_id);
                const days = Math.floor((Date.now() - new Date(inv.invoice_due_date).getTime()) / 86400000);
                const ch = co?.preferred_channel ?? 'WHATSAPP';

                return (
                  <div key={inv.invoice_id} className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-white font-semibold">{inv.invoice_name}</div>
                        <div className="text-zinc-500 text-sm">{co?.company_name ?? `#${inv.company_id}`}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-amber-400 font-bold text-lg">₹{Number(inv.invoice_amount).toLocaleString('en-IN')}</div>
                        <div className="text-zinc-600 text-xs">{days}d overdue</div>
                      </div>
                    </div>

                    {/* Recovery steps */}
                    <div className="mt-4 pt-4 border-t border-amber-500/10 space-y-2">
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Invoice detected as overdue
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> Customer history retrieved
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white font-medium">
                        {ch === 'EMAIL'
                          ? <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          : <MessageCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />}
                        {ch === 'EMAIL' ? 'Email' : 'WhatsApp'} reminder sent
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="w-3.5 h-3.5 text-zinc-600 shrink-0" /> Waiting for customer response...
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: activity log */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_6px_rgba(99,102,241,0.8)]" />
            <span className="text-white font-semibold text-sm">AI Activity Log</span>
          </div>
          <div className="p-5">
            <ActivityTimeline events={activity} />
          </div>
        </div>
      </div>
    </div>
  );
}
