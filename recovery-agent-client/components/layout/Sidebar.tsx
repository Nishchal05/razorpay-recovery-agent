'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  BrainCircuit,
  Plug,
  Settings,
  PlusCircle,
  ChevronRight,
  X,
  Menu,
  Zap,
  Activity,
} from 'lucide-react';

const NAV = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Invoices',
    icon: FileText,
    children: [
      { label: 'All Invoices', href: '/invoices' },
      { label: 'Create Invoice', href: '/invoices/create', highlight: true },
    ],
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: Users,
  },
  {
    label: 'Recovery',
    icon: BrainCircuit,
    children: [
      { label: 'Overview', href: '/recovery' },
    ],
  },
  {
    label: 'Integrations',
    href: '/integrations',
    icon: Plug,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

function NavItem({
  item,
  onClose,
}: {
  item: (typeof NAV)[number];
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() =>
    item.children?.some((c) => pathname.startsWith(c.href)) ?? false
  );

  if (item.children) {
    const isActive = item.children.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'));
    return (
      <div>
        <button
          onClick={() => setOpen((p) => !p)}
          className={`flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            isActive
              ? 'text-white bg-indigo-500/10'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="flex items-center gap-3">
            <item.icon className="w-4 h-4" />
            {item.label}
          </span>
          <ChevronRight
            className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </button>
        {open && (
          <div className="mt-1 ml-7 border-l border-white/8 pl-3 space-y-0.5">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                onClick={onClose}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  pathname === child.href
                    ? 'text-white bg-indigo-500/15 font-semibold'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                } ${child.highlight ? 'text-indigo-400 hover:text-indigo-300' : ''}`}
              >
                {child.highlight && <PlusCircle className="w-3.5 h-3.5" />}
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href!));

  return (
    <Link
      href={item.href!}
      onClick={onClose}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'text-white bg-indigo-500/15 border border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.1)]'
          : 'text-zinc-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <item.icon className="w-4 h-4" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const inner = (onClose?: () => void) => (
    <nav className="flex flex-col gap-1 p-3 flex-1">
      {NAV.map((item) => (
        <NavItem key={item.label} item={item} onClose={onClose} />
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 h-full bg-[#090b10] border-r border-white/8 flex flex-col">
            <SidebarHeader onClose={() => setMobileOpen(false)} />
            {inner(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-[#090b10] border-r border-white/8 h-screen sticky top-0">
        <SidebarHeader />
        {inner()}
        <SidebarFooter />
      </aside>
    </>
  );
}

function SidebarHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-5 border-b border-white/8">
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-[0_0_16px_rgba(99,102,241,0.4)]">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white text-base tracking-tight">Recovery Agent</span>
      </Link>
      {onClose && (
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function SidebarFooter() {
  return (
    <div className="p-3 border-t border-white/8">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse shrink-0" />
        <div className="min-w-0">
          <div className="text-emerald-400 text-xs font-semibold">AI Agent Active</div>
          <div className="text-zinc-600 text-[10px] truncate">Monitoring all invoices</div>
        </div>
      </div>
    </div>
  );
}
