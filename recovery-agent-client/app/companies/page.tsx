"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCompanies } from '../../lib/api/companies';
import { CompanyTable } from '../../components/companies/CompanyTable';
import { CompanyForm } from '../../components/companies/CompanyForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';

export default function CompaniesPage() {
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: getCompanies
  });

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="w-full md:w-2/3">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
              <p className="text-zinc-500 dark:text-zinc-400">Manage registered companies.</p>
            </div>
          </div>
          <CompanyTable companies={companies} isLoading={isLoading} />
        </div>
        
        <div className="w-full md:w-1/3">
          <Card>
            <CardHeader>
              <CardTitle>Add Company</CardTitle>
              <CardDescription>Register a new company to the system.</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
