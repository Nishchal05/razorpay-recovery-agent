"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { createCompany } from '../../lib/api/companies';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const companySchema = z.object({
  company_name: z.string().min(2, 'Name is required'),
  company_email: z.string().email('Invalid email address'),
  company_phone: z.string().min(5, 'Valid phone number is required'),
  company_address: z.string().min(5, 'Address is required'),
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanyFormProps {
  onSuccess?: () => void;
}

export function CompanyForm({ onSuccess }: CompanyFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
  });

  const mutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      reset();
      if (onSuccess) onSuccess();
    },
  });

  const onSubmit = (data: CompanyFormValues) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company_name">Company Name</Label>
        <Input id="company_name" placeholder="Acme Corp" {...register('company_name')} />
        {errors.company_name && <p className="text-sm text-red-500">{errors.company_name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company_email">Email</Label>
        <Input id="company_email" type="email" placeholder="contact@acme.com" {...register('company_email')} />
        {errors.company_email && <p className="text-sm text-red-500">{errors.company_email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company_phone">Phone</Label>
        <Input id="company_phone" placeholder="+1 (555) 000-0000" {...register('company_phone')} />
        {errors.company_phone && <p className="text-sm text-red-500">{errors.company_phone.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="company_address">Address</Label>
        <Input id="company_address" placeholder="123 Main St, City, Country" {...register('company_address')} />
        {errors.company_address && <p className="text-sm text-red-500">{errors.company_address.message}</p>}
      </div>

      {mutation.isError && (
        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-md">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to create company'}
        </div>
      )}

      <Button type="submit" disabled={mutation.isPending} className="w-full">
        {mutation.isPending ? 'Creating...' : 'Add Company'}
      </Button>
    </form>
  );
}
