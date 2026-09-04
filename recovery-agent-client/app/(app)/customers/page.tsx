'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanies } from '../../../lib/api/companies';
import { getInvoices } from '../../../lib/api/invoices';
import { Company, Invoice } from '../../../lib/types';
import { SkeletonCard } from '../../../components/ui/Skeleton';
import { Users, MessageCircle, Mail, Phone, ArrowRight, Plus, X } from 'lucide-react';
import { CompanyForm } from '../../../components/companies/CompanyForm';

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === 'WHATSAPP') return (
    <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full font-semibold">
      <MessageCircle className="w-3 h-3" /> WhatsApp
    </span>
  );
  if (channel === 'EMAIL') return (
    <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold">
      <Mail className="w-3 h-3" /> Email
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
      <Phone className="w-3 h-3" /> Voice
    </span>
  );
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { data: companies = [], isLoading: coLoading } = useQuery({ queryKey: ['companies'], queryFn: getCompanies });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: getInvoices });

  const enriched = companies.map((co: Company) => {
    const coInvoices = invoices.filter((i: Invoice) => i.company_id === co.company_id);
    const outstanding = coInvoices.filter((i: Invoice) => !i.invoice_amount_status).reduce((s, i) => s + Number(i.invoice_amount), 0);
    const active = coInvoices.filter((i: Invoice) => !i.invoice_amount_status).length;
    return { ...co, outstanding, active, total: coInvoices.length };
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Companies & Customers</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            {companies.length} compan{companies.length !== 1 ? 'ies' : 'y'} registered for automated payment recovery.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Add Company
        </button>
      </div>

      {coLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="py-24 text-center rounded-2xl border border-white/8 bg-white/[0.02]">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="text-white font-semibold mb-1">No companies yet</p>
          <p className="text-zinc-500 text-sm mb-6">Add your first company to start tracking overdue invoices.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Company
            </button>
            <Link
              href="/invoices/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all"
            >
              Create Invoice
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {enriched.map((co) => (
            <Link
              key={co.company_id}
              href={`/customers/${co.company_id}`}
              className="group block rounded-2xl border border-white/8 bg-white/[0.02] p-5 hover:border-indigo-500/20 hover:bg-white/[0.04] transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold text-sm">
                  {co.company_name[0]?.toUpperCase()}
                </div>
                <ChannelBadge channel={co.preferred_channel} />
              </div>

              <div className="mb-3">
                <div className="text-white font-semibold">{co.company_name}</div>
                <div className="text-zinc-500 text-xs mt-0.5 truncate">{co.company_email}</div>
                <div className="text-zinc-600 text-xs mt-0.5">{co.company_phone}</div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/8">
                <div>
                  <div className="text-xs text-zinc-600 uppercase tracking-widest">Outstanding</div>
                  <div className={`font-bold text-sm mt-0.5 ${co.outstanding > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {co.outstanding > 0 ? `₹${Number(co.outstanding).toLocaleString('en-IN')}` : 'All Paid'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-600 uppercase tracking-widest">Invoices</div>
                  <div className="text-white font-bold text-sm mt-0.5">{co.active} active / {co.total}</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 mt-3 text-zinc-600 group-hover:text-indigo-400 transition-colors text-xs font-medium">
                View details <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Add Company Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsAddModalOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1117] shadow-[0_0_60px_rgba(79,70,229,0.2)] overflow-hidden">
            <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Add Service Provider Company</h3>
                  <p className="text-zinc-500 text-sm mt-0.5">Register a new client company into the PostgreSQL database.</p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <CompanyForm
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['companies'] });
                  setIsAddModalOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
