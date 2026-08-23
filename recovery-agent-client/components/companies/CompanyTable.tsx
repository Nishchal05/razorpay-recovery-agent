import React from 'react';
import { Company } from '../../lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';

interface CompanyTableProps {
  companies: Company[];
  isLoading: boolean;
}

export function CompanyTable({ companies, isLoading }: CompanyTableProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500">Loading companies...</div>;
  }
console.log(companies)
  const companiesList = Array.isArray(companies) ? companies : [];

  if (companiesList.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed rounded-lg border-zinc-300 dark:border-zinc-800">
        <p className="text-zinc-500">No companies found.</p>
        <p className="text-sm text-zinc-400 mt-1">Add a company to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border dark:border-zinc-800">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Address</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companiesList.map((company) => (
            <TableRow key={company.company_id}>
              <TableCell className="font-medium">{company.company_name}</TableCell>
              <TableCell>{company.company_email}</TableCell>
              <TableCell>{company.company_phone}</TableCell>
              <TableCell>{company.company_address}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
