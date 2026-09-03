'use client';

import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Building2,
  User,
  Mail,
  Shield,
  Bell,
  LogOut,
  ChevronRight,
  BrainCircuit,
  MessageCircle,
  CreditCard,
  Info,
} from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8">
        <h2 className="text-white font-semibold text-sm">{title}</h2>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  value,
  sub,
  action,
  actionLabel = 'Edit',
  danger,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  sub?: string;
  action?: () => void;
  actionLabel?: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
          <Icon className={`w-4 h-4 ${danger ? 'text-rose-400' : 'text-zinc-400'}`} />
        </div>
        <div>
          <div className={`text-sm font-medium ${danger ? 'text-rose-400' : 'text-white'}`}>{label}</div>
          {value && <div className="text-zinc-500 text-xs mt-0.5">{value}</div>}
          {sub && <div className="text-zinc-600 text-xs mt-0.5">{sub}</div>}
        </div>
      </div>
      {action && (
        <button
          onClick={action}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
            danger
              ? 'text-rose-400 hover:bg-rose-500/10 border border-rose-500/20'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-white/8'
          }`}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function IntegrationStatusRow({
  icon: Icon,
  label,
  color,
  connected,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-4">
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
        connected
          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          : 'text-zinc-500 bg-white/5 border-white/10'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
        {connected ? 'Connected' : 'Not connected'}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLogout = () => {
    logout();
    toast('You have been signed out.', 'info');
    router.push('/');
  };

  const handleSaveStub = () => {
    toast('Profile editing coming soon.', 'info');
  };

  const handleDeleteStub = () => {
    if (showDeleteConfirm) {
      toast('Account deletion is not yet available. Contact support.', 'warning');
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Manage your business account and preferences.</p>
      </div>

      <div className="space-y-6">
        {/* Business Profile */}
        <Section title="Business Profile">
          <SettingRow
            icon={Building2}
            label="Business Name"
            value={user?.business_name ?? '—'}
            action={handleSaveStub}
            actionLabel="Edit"
          />
          <SettingRow
            icon={User}
            label="Owner Name"
            value={user?.owner_name ?? '—'}
            action={handleSaveStub}
            actionLabel="Edit"
          />
          <SettingRow
            icon={Mail}
            label="Email Address"
            value={user?.email ?? '—'}
            sub="Used for account recovery and notifications"
            action={handleSaveStub}
            actionLabel="Change"
          />
        </Section>

        {/* Integrations Overview */}
        <Section title="Integrations">
          <div className="px-6 py-3 flex items-center gap-2 text-indigo-400 bg-indigo-500/5 border-b border-white/5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs">
              Manage full integration settings on the{' '}
              <a href="/integrations" className="underline hover:text-indigo-300">Integrations page</a>.
            </span>
          </div>
          <IntegrationStatusRow
            icon={MessageCircle}
            label="WhatsApp (Meta)"
            color="bg-green-500/10 border-green-500/20 text-green-400"
            connected={Boolean(process.env.NEXT_PUBLIC_META_CONFIGURED)}
          />
          <IntegrationStatusRow
            icon={Mail}
            label="Gmail"
            color="bg-blue-500/10 border-blue-500/20 text-blue-400"
            connected={false}
          />
          <IntegrationStatusRow
            icon={CreditCard}
            label="Razorpay"
            color="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
            connected={Boolean(process.env.NEXT_PUBLIC_RAZORPAY_CONFIGURED)}
          />
        </Section>

        {/* AI Agent */}
        <Section title="AI Recovery Agent">
          <SettingRow
            icon={BrainCircuit}
            label="Max Reminders per Invoice"
            value="3 reminders"
            sub="Automation stops after this limit to protect customer relationships"
            action={handleSaveStub}
            actionLabel="Configure"
          />
          <SettingRow
            icon={Bell}
            label="Escalation Notifications"
            value="Enabled"
            sub="Get notified when an invoice is escalated for human review"
            action={handleSaveStub}
            actionLabel="Manage"
          />
        </Section>

        {/* Security */}
        <Section title="Security">
          <SettingRow
            icon={Shield}
            label="Password"
            value="Last changed: unknown"
            action={handleSaveStub}
            actionLabel="Change"
          />
        </Section>

        {/* Account Actions */}
        <Section title="Account">
          <SettingRow
            icon={LogOut}
            label="Sign Out"
            sub="Sign out of your Recovery Agent account"
            action={handleLogout}
            actionLabel="Sign Out"
          />
          <SettingRow
            icon={Shield}
            label="Delete Account"
            sub="Permanently delete your account and all data. This cannot be undone."
            action={handleDeleteStub}
            actionLabel={showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
            danger
          />
          {showDeleteConfirm && (
            <div className="px-6 py-3 bg-rose-500/5 border-t border-rose-500/10">
              <p className="text-rose-400/80 text-xs">
                Are you sure? Click <strong>Confirm Delete</strong> above to proceed, or{' '}
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="underline text-rose-400 hover:text-rose-300"
                >
                  cancel
                </button>.
              </p>
            </div>
          )}
        </Section>
      </div>

      {/* Version */}
      <p className="text-center text-zinc-700 text-xs mt-10">Recovery Agent · v1.0.0</p>
    </div>
  );
}
