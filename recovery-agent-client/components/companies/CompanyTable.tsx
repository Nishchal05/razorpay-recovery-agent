import React from 'react';
import { Company } from '../../lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';

interface CompanyTableProps {
  companies: Company[];
  isLoading: boolean;
}

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  WHATSAPP:   { label: 'WhatsApp',   color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  EMAIL:      { label: 'Email',      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  VOICE_CALL: { label: 'Voice Call', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
};

export function CompanyTable({ companies, isLoading }: CompanyTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-800 p-10 text-center text-zinc-500 animate-pulse">
        Loading companies…
      </div>
    );
  }

  const companiesList = Array.isArray(companies) ? companies : [];

  if (companiesList.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed rounded-xl border-zinc-800">
        <p className="text-zinc-400">No companies found.</p>
        <p className="text-sm text-zinc-600 mt-1">Click "Add Company" to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 bg-zinc-900/60">
            <TableHead className="text-zinc-400">Company</TableHead>
            <TableHead className="text-zinc-400">Email</TableHead>
            <TableHead className="text-zinc-400">Phone</TableHead>
            <TableHead className="text-zinc-400">Preferred Channel</TableHead>
            <TableHead className="text-zinc-400">Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companiesList.map((company) => {
            const ch = CHANNEL_LABELS[company.preferred_channel] ?? { label: company.preferred_channel, color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
            return (
              <TableRow key={company.company_id} className="border-zinc-800 hover:bg-zinc-900/40 transition-colors">
                <TableCell className="font-semibold text-white">{company.company_name}</TableCell>
                <TableCell className="text-zinc-400">{company.company_email}</TableCell>
                <TableCell className="text-zinc-400">{company.company_phone}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ch.color}`}>
                    {ch.label}
                  </span>
                </TableCell>
                <TableCell className="text-zinc-400 text-sm">{company.company_address}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
