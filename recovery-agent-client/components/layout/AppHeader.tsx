'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronDown, Settings, BrainCircuit } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import Link from 'next/link';

export function AppHeader() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = () => {
    logout();
    toast('You have been signed out.', 'info');
    router.push('/');
  };

  return (
    <header className="h-16 border-b border-white/8 bg-[#090b10]/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
      {/* Left — AI agent status pill */}
      <div className="hidden lg:flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/8 border border-indigo-500/15">
          <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-indigo-400/80 text-xs font-medium">AI Recovery Agent</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse" />
        </div>
      </div>

      {/* Right — user menu */}
      <div className="ml-auto relative">
        <button
          onClick={() => setMenuOpen((p) => !p)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-bold text-sm">
            {user?.business_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'B'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-white text-sm font-medium leading-tight">
              {user?.business_name ?? 'My Business'}
            </div>
            <div className="text-zinc-500 text-xs leading-tight">{user?.email ?? ''}</div>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-xl border border-white/10 bg-[#0f1117] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/8">
                <div className="text-white text-sm font-semibold truncate">
                  {user?.business_name ?? 'My Business'}
                </div>
                <div className="text-zinc-500 text-xs truncate">{user?.email}</div>
              </div>
              <div className="p-1">
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 text-sm transition-all"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-sm transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
