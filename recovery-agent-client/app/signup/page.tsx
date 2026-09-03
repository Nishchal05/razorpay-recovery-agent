'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Building2, User, Mail, Lock, ArrowRight } from 'lucide-react';
import { signup } from '../../lib/api/auth';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

export default function SignupPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await signup(form);
      login(res);
      toast(`Welcome, ${form.business_name}! Your account is ready.`, 'success');
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;
  if (isAuthenticated) return null;

  const fields = [
    { key: 'business_name' as const, label: 'Business Name', type: 'text', placeholder: 'Acme Services Ltd', icon: Building2 },
    { key: 'owner_name' as const, label: 'Your Name', type: 'text', placeholder: 'Ravi Sharma', icon: User },
    { key: 'email' as const, label: 'Work Email', type: 'email', placeholder: 'ravi@acme.com', icon: Mail },
    { key: 'password' as const, label: 'Password', type: 'password', placeholder: '••••••••', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-600/8 blur-[120px] rounded-full pointer-events-none" />

      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-white text-lg tracking-tight">Recovery Agent</span>
      </Link>

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[#0f1117] shadow-[0_0_60px_rgba(79,70,229,0.1)] overflow-hidden">
          <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
          <div className="p-8">
            <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
            <p className="text-zinc-500 text-sm mb-8">Start recovering invoices automatically with AI.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {fields.map(({ key, label, type, placeholder, icon: Icon }) => (
                <div key={key}>
                  <label className="block text-zinc-400 text-sm font-medium mb-1.5">{label}</label>
                  <div className="relative">
                    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <input
                      type={type}
                      value={form[key]}
                      onChange={set(key)}
                      required
                      placeholder={placeholder}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                    />
                  </div>
                </div>
              ))}

              {error && (
                <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] mt-2"
              >
                {loading ? <Spinner size="sm" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-zinc-500 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/signin" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
