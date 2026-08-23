import React from 'react';
import { Invoice, InvoiceStatus } from '../../lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { format } from 'date-fns';

interface InvoiceTableProps {
  invoices: Invoice[];
  isLoading: boolean;
}

const getStatusBadgeVariant = (status: InvoiceStatus) => {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'DISPUTE':
      return 'destructive';
    case 'PENDING':
    default:
      return 'secondary';
  }
};

export function InvoiceTable({ invoices, isLoading }: InvoiceTableProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500">Loading invoices...</div>;
  }
  const invoicesList = Array.isArray(invoices) ? invoices : [];
  if (invoicesList.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed rounded-lg border-zinc-300 dark:border-zinc-800">
        <p className="text-zinc-500">No invoices yet.</p>
        <p className="text-sm text-zinc-400 mt-1">Create your first invoice.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border dark:border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoicesList.map((invoice) => (
            <TableRow key={invoice.invoice_id}>
              <TableCell className="font-medium">{invoice.invoice_name}</TableCell>
              <TableCell>{invoice.company?.company_name || `Company #${invoice.company_id}`}</TableCell>
              <TableCell>${invoice.invoice_amount.toFixed(2)}</TableCell>
              <TableCell>
                {invoice.invoice_due_date ? format(new Date(invoice.invoice_due_date), 'MMM dd, yyyy') : 'N/A'}
              </TableCell>
              <TableCell>
                <Badge variant={getStatusBadgeVariant(invoice.invoice_status)}>
                  {invoice.invoice_status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
