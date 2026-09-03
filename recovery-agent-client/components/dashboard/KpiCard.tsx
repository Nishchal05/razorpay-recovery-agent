import { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue';
  trend?: { value: string; up: boolean };
}

const colors = {
  indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
};

export function KpiCard({ label, value, sub, icon: Icon, color = 'indigo', trend }: KpiCardProps) {
  return (
    <div className="relative rounded-2xl border border-white/8 bg-white/[0.03] p-5 overflow-hidden group hover:border-white/12 transition-all">
      {/* Subtle hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-indigo-500/3 to-transparent pointer-events-none" />

      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {trend && (
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend.up
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      <div className="text-2xl font-bold text-white tracking-tight mb-0.5">{value}</div>
      <div className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{label}</div>
      {sub && <div className="text-xs text-zinc-600 mt-1">{sub}</div>}
    </div>
  );
}
