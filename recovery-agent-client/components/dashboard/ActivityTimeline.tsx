import { ActivityEvent, ActivityType } from '../../lib/types';
import {
  MessageCircle,
  Mail,
  CreditCard,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

const TYPE_CONFIG: Record<
  ActivityType,
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  WHATSAPP_SENT: {
    icon: MessageCircle,
    label: 'WhatsApp sent',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
  },
  EMAIL_SENT: {
    icon: Mail,
    label: 'Email sent',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  PAYMENT_LINK_CREATED: {
    icon: CreditCard,
    label: 'Payment link created',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
  },
  PROMISE_RECEIVED: {
    icon: Clock,
    label: 'Promise to pay received',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  ESCALATED: {
    icon: ShieldAlert,
    label: 'Escalated to human',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
  PAID: {
    icon: CheckCircle2,
    label: 'Payment received',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  OVERDUE_DETECTED: {
    icon: AlertTriangle,
    label: 'Invoice overdue detected',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  REMINDER_CAPPED: {
    icon: XCircle,
    label: 'Reminder limit reached',
    color: 'text-zinc-400',
    bg: 'bg-white/5 border-white/10',
  },
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-4">
          <MessageCircle className="w-5 h-5 text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">No recovery activity yet.</p>
        <p className="text-zinc-600 text-xs mt-1">AI actions will appear here once invoices become overdue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, i) => {
        const cfg = TYPE_CONFIG[event.type];
        const Icon = cfg.icon;
        return (
          <div key={event.id} className="flex gap-4 group">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${cfg.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              {i < events.length - 1 && (
                <div className="w-px flex-1 bg-white/8 my-1" />
              )}
            </div>

            {/* Content */}
            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium">{cfg.label}</div>
                  <div className="text-zinc-500 text-xs mt-0.5 truncate">
                    {event.invoice_name} · <span className="text-zinc-400">{event.company_name}</span>
                    {event.amount && (
                      <span className="text-zinc-400"> · ₹{Number(event.amount).toLocaleString('en-IN')}</span>
                    )}
                  </div>
                  {event.message && (
                    <div className="text-zinc-600 text-xs mt-1 italic">{event.message}</div>
                  )}
                </div>
                <span className="text-zinc-600 text-xs shrink-0">{timeAgo(event.timestamp)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
