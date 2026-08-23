"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInvoices } from '../../lib/api/invoices';
import { InvoiceTable } from '../../components/invoices/InvoiceTable';
import { InvoiceForm } from '../../components/invoices/InvoiceForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';

export default function InvoicesPage() {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: getInvoices
  });

  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full lg:w-2/3">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
              <p className="text-zinc-500 dark:text-zinc-400">Manage all system invoices.</p>
            </div>
          </div>
          <InvoiceTable invoices={invoices} isLoading={isLoading} />
        </div>
        
        <div className="w-full lg:w-1/3">
          <Card>
            <CardHeader>
              <CardTitle>Add Invoice</CardTitle>
              <CardDescription>Create a new invoice for a company.</CardDescription>
            </CardHeader>
            <CardContent>
              <InvoiceForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
