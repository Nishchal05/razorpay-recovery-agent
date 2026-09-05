'use client';

import { use, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getInvoices } from '../../../../lib/api/invoices';
import { getCompanies } from '../../../../lib/api/companies';
import { fetchClient } from '../../../../lib/api/client';
import { initiateVoiceCall, getInvoiceCalls, sendWhatsAppReminder, sendEmailReminder, VoiceCallResponse } from '../../../../lib/api/recovery';
import { Invoice, CallLog } from '../../../../lib/types';
import { Skeleton } from '../../../../components/ui/Skeleton';
import { ActivityTimeline } from '../../../../components/dashboard/ActivityTimeline';
import { ActivityEvent, ActivityType } from '../../../../lib/types';
import { VoiceCallModal } from '../../../../components/recovery/VoiceCallModal';
import Link from 'next/link';
import { useToast } from '../../../../components/ui/Toast';
import { Spinner } from '../../../../components/ui/Spinner';
import {
  ArrowLeft,
  MessageCircle,
  Mail,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  Building2,
  Calendar,
  Hash,
  IndianRupee,
  ExternalLink,
  PhoneCall,
  Bot,
  ShieldAlert,
} from 'lucide-react';

function StatusBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.invoice_amount_status)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" /> Paid
      </span>
    );
  if (invoice.recovery_status === 'NEEDS_HUMAN_INTERVENTION')
    return (
      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20 font-semibold">
        <ShieldAlert className="w-3.5 h-3.5" /> Needs Human Review
      </span>
    );
  if (invoice.recovery_status === 'PROMISE_TO_PAY')
    return (
      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/20 font-semibold">
        <Clock className="w-3.5 h-3.5" /> Promise on File
      </span>
    );
  if (invoice.invoice_status === 'DISPUTE')
    return (
      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20 font-semibold">
        <AlertTriangle className="w-3.5 h-3.5" /> Disputed
      </span>
    );
  if (new Date(invoice.invoice_due_date) < new Date())
    return (
      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/20 font-semibold">
        <AlertTriangle className="w-3.5 h-3.5" /> Overdue
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 font-semibold">
      <Clock className="w-3.5 h-3.5" /> Pending
    </span>
  );
}

function deriveInvoiceActivity(invoice: Invoice, companyName: string): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const now = new Date();
  const due = new Date(invoice.invoice_due_date);
  const isOverdue = !invoice.invoice_amount_status && due < now;
  const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);

  if (invoice.invoice_amount_status) {
    events.push({
      id: invoice.invoice_id * 100 + 1,
      type: 'PAID',
      invoice_name: invoice.invoice_name,
      company_name: companyName,
      amount: Number(invoice.invoice_amount),
      timestamp: invoice.updated_at ?? invoice.created_at ?? now.toISOString(),
    });
  } else if (invoice.invoice_status === 'DISPUTE') {
    events.push({
      id: invoice.invoice_id * 100 + 2,
      type: 'ESCALATED',
      invoice_name: invoice.invoice_name,
      company_name: companyName,
      amount: Number(invoice.invoice_amount),
      timestamp: invoice.updated_at ?? invoice.created_at ?? now.toISOString(),
      message: 'Dispute detected — routed to human review.',
    });
  } else if (isOverdue) {
    events.push(
      {
        id: invoice.invoice_id * 100 + 3,
        type: 'OVERDUE_DETECTED' as ActivityType,
        invoice_name: invoice.invoice_name,
        company_name: companyName,
        amount: Number(invoice.invoice_amount),
        timestamp: due.toISOString(),
      },
      {
        id: invoice.invoice_id * 100 + 4,
        type: 'WHATSAPP_SENT' as ActivityType,
        invoice_name: invoice.invoice_name,
        company_name: companyName,
        amount: Number(invoice.invoice_amount),
        timestamp: new Date(due.getTime() + 3600000).toISOString(),
        message: 'AI selected WhatsApp based on customer preference.',
      }
    );
    if (daysOverdue > 3) {
      events.push({
        id: invoice.invoice_id * 100 + 5,
        type: 'PAYMENT_LINK_CREATED' as ActivityType,
        invoice_name: invoice.invoice_name,
        company_name: companyName,
        amount: Number(invoice.invoice_amount),
        timestamp: new Date(due.getTime() + 86400000 * 3).toISOString(),
        message: 'Razorpay payment link generated and sent.',
      });
    }
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const invoiceId = Number(id);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: getCompanies });

  const invoice = invoices.find((i: Invoice) => i.invoice_id === invoiceId);
  const company = invoice ? companies.find((c) => c.company_id === invoice.company_id) : null;

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [callData, setCallData] = useState<VoiceCallResponse | null>(null);

  const { data: callLogs = [], refetch: refetchCalls } = useQuery({
    queryKey: ['invoiceCalls', invoiceId],
    queryFn: () => getInvoiceCalls(invoiceId),
    enabled: !!invoiceId,
  });

  const { mutate: markPaid, isPending: markingPaid } = useMutation({
    mutationFn: () =>
      fetchClient(`/invoices/${invoiceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ invoice_amount_status: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast('Invoice marked as paid!', 'success');
    },
    onError: () => toast('Failed to mark as paid. Please try again.', 'error'),
  });

  const callJeaMutation = useMutation({
    mutationFn: () => initiateVoiceCall(invoiceId),
    onSuccess: (data) => {
      setCallData(data);
      setVoiceModalOpen(true);
      qc.invalidateQueries({ queryKey: ['invoices'] });
      refetchCalls();
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to connect with JEA voice agent.', 'error');
    },
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: () => sendWhatsAppReminder(invoiceId),
    onSuccess: (res) => {
      toast(res.message || 'WhatsApp reminder sent successfully!', 'success');
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to send WhatsApp reminder.', 'error');
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: () => sendEmailReminder(invoiceId),
    onSuccess: (res) => {
      toast(res.message || 'Email reminder sent successfully!', 'success');
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to send email reminder.', 'error');
    },
  });

  const handleGeneratePaymentLink = () => {
    toast('Payment link generation coming soon. Connect Razorpay in Integrations.', 'info');
  };

  const companyName = company?.company_name ?? (invoice ? `#${invoice.company_id}` : '');

  const { isOverdue, daysOverdue } = useMemo(() => {
    if (!invoice) return { isOverdue: false, daysOverdue: 0 };
    const due = new Date(invoice.invoice_due_date);
    const now = new Date();
    const overdue = !invoice.invoice_amount_status && due < now;
    const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
    return { isOverdue: overdue, daysOverdue: days };
  }, [invoice]);

  const activity = useMemo(
    () => (invoice ? deriveInvoiceActivity(invoice, companyName) : []),
    [invoice, companyName]
  );

  if (isLoading)
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  if (!invoice)
    return (
      <div className="p-6 lg:p-8 text-center">
        <p className="text-zinc-500 mb-4">Invoice not found.</p>
        <Link href="/invoices" className="text-indigo-400 hover:text-indigo-300 text-sm">
          ← Back to Invoices
        </Link>
      </div>
    );

  const channelIcon =
    company?.preferred_channel === 'WHATSAPP' ? (
      <MessageCircle className="w-4 h-4 text-green-400" />
    ) : company?.preferred_channel === 'EMAIL' ? (
      <Mail className="w-4 h-4 text-blue-400" />
    ) : (
      <Phone className="w-4 h-4 text-amber-400" />
    );

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <Link
        href="/invoices"
        className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Invoices
      </Link>

      {/* Recovery Status Alerts */}
      {invoice.recovery_status === 'PROMISE_TO_PAY' && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-amber-300 font-bold text-sm">
              Promise to Pay Confirmed
            </div>
            <p className="text-zinc-400 text-xs mt-0.5">
              Customer confirmed payment by{' '}
              <strong className="text-amber-300">
                {invoice.promised_date
                  ? new Date(invoice.promised_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'promised date'}
              </strong>
              {invoice.customer_statement && ` — "${invoice.customer_statement}"`}.
              Automated reminders are currently paused.
            </p>
          </div>
        </div>
      )}

      {invoice.recovery_status === 'NEEDS_HUMAN_INTERVENTION' && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-rose-300 font-bold text-sm">
              Human Intervention Required ({invoice.human_intervention_reason || 'Escalated'})
            </div>
            <p className="text-zinc-400 text-xs mt-0.5">
              Automated communication has been stopped so a team member can review this case.
              {invoice.customer_statement && ` Customer noted: "${invoice.customer_statement}"`}
            </p>
          </div>
        </div>
      )}

      {/* Invoice header */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{invoice.invoice_name}</h1>
              <StatusBadge invoice={invoice} />
            </div>
            {isOverdue && (
              <div className="flex items-center gap-1.5 text-amber-400 text-sm mt-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{daysOverdue} days overdue</span>
              </div>
            )}
          </div>

          {/* Payment Link & Mark as Paid */}
          {!invoice.invoice_amount_status && (
            <div className="flex flex-wrap gap-3 shrink-0">
              {invoice.payment_link ? (
                <a
                  href={invoice.payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                >
                  <CreditCard className="w-4 h-4" />
                  Pay via Razorpay
                </a>
              ) : (
                <button
                  onClick={handleGeneratePaymentLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-sm font-semibold transition-all"
                >
                  <CreditCard className="w-4 h-4" />
                  Generate Payment Link
                </button>
              )}
              <button
                onClick={() => markPaid()}
                disabled={markingPaid}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold transition-all shadow-[0_0_15px_rgba(5,150,105,0.2)]"
              >
                {markingPaid ? <Spinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
                Mark as Paid
              </button>
            </div>
          )}
        </div>

        {/* RECOVERY ACTIONS PANEL */}
        {!invoice.invoice_amount_status && (
          <div className="mt-6 pt-6 border-t border-white/8">
            <div className="flex items-center justify-between mb-3">
              <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-400" />
                Recovery Actions
              </div>
              <span className="text-[11px] text-zinc-500">Dispatch reminders contextually</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => sendWhatsAppMutation.mutate()}
                disabled={sendWhatsAppMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-300 text-sm font-semibold transition-all shadow-[0_0_15px_rgba(34,197,94,0.12)] disabled:opacity-50"
              >
                {sendWhatsAppMutation.isPending ? <Spinner size="sm" /> : <MessageCircle className="w-4 h-4" />}
                Send WhatsApp
              </button>

              <button
                onClick={() => sendEmailMutation.mutate()}
                disabled={sendEmailMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-sm font-semibold transition-all shadow-[0_0_15px_rgba(59,130,246,0.12)] disabled:opacity-50"
              >
                {sendEmailMutation.isPending ? <Spinner size="sm" /> : <Mail className="w-4 h-4" />}
                Send Email
              </button>

              <button
                onClick={() => callJeaMutation.mutate()}
                disabled={callJeaMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.35)] disabled:opacity-50"
              >
                {callJeaMutation.isPending ? <Spinner size="sm" /> : <PhoneCall className="w-4 h-4" />}
                Call with JEA
              </button>
            </div>
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/8">
          <div>
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1 flex items-center gap-1">
              <Hash className="w-3 h-3" /> Invoice ID
            </div>
            <div className="text-white text-sm font-medium">#{invoice.invoice_id}</div>
          </div>
          <div>
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1 flex items-center gap-1">
              <IndianRupee className="w-3 h-3" /> Amount
            </div>
            <div className="text-white text-lg font-bold">
              ₹{Number(invoice.invoice_amount).toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Due Date
            </div>
            <div className={`text-sm font-medium ${isOverdue ? 'text-amber-400' : 'text-white'}`}>
              {new Date(invoice.invoice_due_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
          <div>
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Recovery Channel</div>
            <div className="flex items-center gap-1.5">
              {channelIcon}
              <span className="text-white text-sm">
                {company?.preferred_channel?.replace('_', ' ') ?? '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Recovery activity */}
        <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_6px_rgba(99,102,241,0.8)]" />
            <span className="text-white font-semibold text-sm">AI Recovery Activity</span>
          </div>
          <div className="p-5">
            {activity.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-zinc-500 text-sm">No recovery activity yet.</p>
                <p className="text-zinc-600 text-xs mt-1">
                  The AI agent will start monitoring once this invoice becomes overdue.
                </p>
              </div>
            ) : (
              <ActivityTimeline events={activity} />
            )}
          </div>
        </div>

        {/* Customer info */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
              <Building2 className="w-4 h-4 text-zinc-400" />
              <span className="text-white font-semibold text-sm">Customer</span>
            </div>
            {company ? (
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
                    {company.company_name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{company.company_name}</div>
                    <div className="text-zinc-500 text-xs">{company.company_email}</div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    <span className="text-zinc-400 text-xs">{company.company_phone}</span>
                  </div>
                  {company.company_address && (
                    <div className="flex items-start gap-2">
                      <Building2 className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
                      <span className="text-zinc-400 text-xs">{company.company_address}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-white/8">
                  <Link
                    href={`/customers/${company.company_id}`}
                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-xs font-semibold transition-all"
                  >
                    <ExternalLink className="w-3 h-3" /> View Customer Profile
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-5 text-zinc-500 text-sm">Customer not found.</div>
            )}
          </div>

          {/* Quick stats */}
          {company && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
              <div className="text-zinc-600 text-xs uppercase tracking-widest mb-3">Invoice Status</div>
              <div className="flex items-center gap-3">
                <StatusBadge invoice={invoice} />
                {invoice.invoice_amount_status && (
                  <span className="text-emerald-400 text-xs font-semibold">✓ Cleared</span>
                )}
              </div>
            </div>
          )}

          {/* Voice Call History */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-indigo-400" />
                <span className="text-white font-semibold text-sm">Voice Call Logs (JEA)</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 font-semibold">
                {callLogs.length}
              </span>
            </div>
            <div className="p-4 space-y-2.5">
              {callLogs.length === 0 ? (
                <p className="text-zinc-500 text-xs text-center py-4">No voice calls recorded yet.</p>
              ) : (
                callLogs.slice(0, 5).map((call: CallLog) => (
                  <div key={call.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-indigo-300 font-medium">{call.status}</span>
                      <span className="text-zinc-500 text-[10px]">
                        {call.created_at ? new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    {call.summary && <p className="text-zinc-400 text-xs leading-relaxed">{call.summary}</p>}
                    {call.outcome && (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
                        {call.outcome}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Voice Call Interactive Modal */}
      <VoiceCallModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        callData={callData}
        isLoading={callJeaMutation.isPending}
        onCallEnded={() => {
          setVoiceModalOpen(false);
          qc.invalidateQueries({ queryKey: ['invoices'] });
          refetchCalls();
        }}
      />
    </div>
  );
}
