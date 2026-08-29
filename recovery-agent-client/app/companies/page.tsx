"use client";

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompanies } from '../../lib/api/companies';
import { CompanyTable } from '../../components/companies/CompanyTable';
import { CompanyForm } from '../../components/companies/CompanyForm';

function AddCompanyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1117] shadow-[0_0_60px_rgba(79,70,229,0.15)] overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-white">Add New Company</h3>
              <p className="text-zinc-500 text-sm mt-0.5">Register a new company in the system.</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all"
            >
              ✕
            </button>
          </div>
          <CompanyForm onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const [showModal, setShowModal] = useState(false);
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies,
  });

  return (
    <>
      {showModal && <AddCompanyModal onClose={() => setShowModal(false)} />}

      <div className="container mx-auto py-10 px-4 md:px-6 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Companies</h1>
            <p className="text-zinc-500 mt-1">Manage registered companies and their preferences.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
          >
            <span className="text-lg leading-none">+</span> Add Company
          </button>
        </div>

        <CompanyTable companies={companies} isLoading={isLoading} />
      </div>
    </>
  );
}
