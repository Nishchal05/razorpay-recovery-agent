'use client';

import { useState } from 'react';
import { MessageCircle, Mail, CreditCard, CheckCircle2, ExternalLink, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';

function InfoBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 animate-in fade-in">
      <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
      <p className="text-indigo-300 text-sm flex-1 leading-relaxed">{message}</p>
      <button onClick={onClose} className="text-indigo-500 hover:text-indigo-300 transition-colors shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function IntegrationCard({
  title,
  description,
  icon: Icon,
  color,
  connected,
  onConnect,
  label,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  connected: boolean;
  onConnect?: () => void;
  label?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full font-semibold">
            <AlertCircle className="w-3 h-3" />
            Not connected
          </span>
        )}
      </div>

      <div>
        <h3 className="text-white font-semibold">{title}</h3>
        <p className="text-zinc-500 text-sm mt-1 leading-relaxed">{description}</p>
      </div>

      {onConnect && (
        <button
          onClick={onConnect}
          className="mt-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-sm font-semibold transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          {label ?? 'Connect'}
        </button>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [infoBanner, setInfoBanner] = useState<string | null>(null);
  const [gmailConnecting, setGmailConnecting] = useState(false);

  const connectGmail = () => {
    setGmailConnecting(true);
    window.location.href = 'http://localhost:8000/auth/gmail';
  };

  const showWhatsAppInfo = () => {
    setInfoBanner(
      'To enable WhatsApp, set META_ACCESS_TOKEN and META_PHONE_NUMBER_ID in your server .env file, then restart the server.'
    );
  };

  const showRazorpayInfo = () => {
    setInfoBanner(
      'To enable Razorpay, set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your server .env file, then restart the server.'
    );
  };

  const envConfig = {
    whatsapp: Boolean(process.env.NEXT_PUBLIC_META_CONFIGURED),
    razorpay: Boolean(process.env.NEXT_PUBLIC_RAZORPAY_CONFIGURED),
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Connect your communication and payment channels.</p>
      </div>

      {infoBanner && (
        <div className="mb-6">
          <InfoBanner message={infoBanner} onClose={() => setInfoBanner(null)} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <IntegrationCard
          title="WhatsApp (Meta)"
          description="Send personalized payment reminders directly through WhatsApp Business API."
          icon={MessageCircle}
          color="bg-green-500/10 border-green-500/20 text-green-400"
          connected={envConfig.whatsapp}
          label={envConfig.whatsapp ? 'Reconfigure' : 'How to set up'}
          onConnect={showWhatsAppInfo}
        />

        <IntegrationCard
          title="Gmail"
          description="Send recovery emails through your Google Workspace or Gmail account via OAuth."
          icon={Mail}
          color="bg-blue-500/10 border-blue-500/20 text-blue-400"
          connected={false}
          label={gmailConnecting ? 'Connecting...' : 'Connect Gmail'}
          onConnect={connectGmail}
        />

        <IntegrationCard
          title="Razorpay"
          description="Generate unique payment links and embed them in recovery messages for instant payment."
          icon={CreditCard}
          color="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
          connected={envConfig.razorpay}
          label={envConfig.razorpay ? 'Reconfigure' : 'How to set up'}
          onConnect={showRazorpayInfo}
        />
      </div>

      <div className="mt-8 p-5 rounded-2xl border border-indigo-500/15 bg-indigo-500/5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-white font-semibold text-sm">How channels work</div>
            <p className="text-zinc-500 text-sm mt-1 leading-relaxed">
              The AI recovery agent selects the best channel for each customer based on their{' '}
              <strong className="text-zinc-300">preferred channel</strong> setting. Set the preference per customer when
              creating an invoice. The agent never sends through all channels simultaneously — it chooses contextually.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
