'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES: Record<ToastVariant, { border: string; icon: string; bg: string }> = {
  success: {
    border: 'border-emerald-500/30',
    icon: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  error: {
    border: 'border-rose-500/30',
    icon: 'text-rose-400',
    bg: 'bg-rose-500/10',
  },
  warning: {
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
  info: {
    border: 'border-indigo-500/30',
    icon: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const style = STYLES[toast.variant];
  const Icon = ICONS[toast.variant];

  useEffect(() => {
    // Trigger enter animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, duration);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 w-full max-w-sm rounded-xl border ${style.border} ${style.bg} backdrop-blur-xl bg-[#0f1117]/90 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
    >
      <div className={`shrink-0 mt-0.5 ${style.icon}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-sm text-zinc-200 flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="shrink-0 text-zinc-600 hover:text-white transition-colors ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration?: number) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
