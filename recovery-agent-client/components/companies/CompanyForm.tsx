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

const CHANNELS = [
  {
    value: 'WHATSAPP',
    label: 'WhatsApp',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
    color: 'green',
    desc: 'Best for quick responses',
  },
  {
    value: 'EMAIL',
    label: 'Email',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
    color: 'blue',
    desc: 'Formal communication',
  },
  {
    value: 'VOICE_CALL',
    label: 'Voice Call',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
    color: 'purple',
    desc: 'For high-priority cases',
  },
] as const;

const colorMap = {
  green:  { ring: 'ring-green-500/60',  border: 'border-green-500/40',  bg: 'bg-green-500/10',  text: 'text-green-400',  dot: 'bg-green-400' },
  blue:   { ring: 'ring-blue-500/60',   border: 'border-blue-500/40',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  purple: { ring: 'ring-purple-500/60', border: 'border-purple-500/40', bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400' },
};

const companySchema = z.object({
  company_name:      z.string().min(2, 'Name is required'),
  company_email:     z.string().email('Invalid email address'),
  company_phone:     z.string().min(5, 'Valid phone number is required'),
  company_address:   z.string().min(5, 'Address is required'),
  preferred_channel: z.enum(['WHATSAPP', 'EMAIL', 'VOICE_CALL']),
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanyFormProps {
  onSuccess?: () => void;
}

export function CompanyForm({ onSuccess }: CompanyFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { preferred_channel: 'WHATSAPP' },
  });

  const selectedChannel = watch('preferred_channel');

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

  const inputClass = "flex h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:border-indigo-500/40 transition-all";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Company Name */}
      <div className="space-y-1.5">
        <Label htmlFor="company_name" className="text-zinc-300 text-sm font-medium">Company Name</Label>
        <Input id="company_name" placeholder="Acme Corp" {...register('company_name')} className={inputClass} />
        {errors.company_name && <p className="text-xs text-red-400 mt-1">{errors.company_name.message}</p>}
      </div>

      {/* Email + Phone side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="company_email" className="text-zinc-300 text-sm font-medium">Email</Label>
          <Input id="company_email" type="email" placeholder="contact@acme.com" {...register('company_email')} className={inputClass} />
          {errors.company_email && <p className="text-xs text-red-400 mt-1">{errors.company_email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company_phone" className="text-zinc-300 text-sm font-medium">Phone</Label>
          <Input id="company_phone" placeholder="+91 99999 00000" {...register('company_phone')} className={inputClass} />
          {errors.company_phone && <p className="text-xs text-red-400 mt-1">{errors.company_phone.message}</p>}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label htmlFor="company_address" className="text-zinc-300 text-sm font-medium">Address</Label>
        <Input id="company_address" placeholder="123 Main St, Mumbai, India" {...register('company_address')} className={inputClass} />
        {errors.company_address && <p className="text-xs text-red-400 mt-1">{errors.company_address.message}</p>}
      </div>

      {/* Preferred Communication Channel */}
      <div className="space-y-2.5">
        <Label className="text-zinc-300 text-sm font-medium">Preferred Communication Channel</Label>
        <p className="text-xs text-zinc-500">The AI will prioritise this channel when reaching out for payment recovery.</p>
        <div className="grid grid-cols-3 gap-2.5">
          {CHANNELS.map((ch) => {
            const isSelected = selectedChannel === ch.value;
            const c = colorMap[ch.color];
            return (
              <button
                key={ch.value}
                type="button"
                onClick={() => setValue('preferred_channel', ch.value as CompanyFormValues['preferred_channel'])}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all cursor-pointer
                  ${isSelected
                    ? `${c.bg} ${c.border} ring-2 ${c.ring}`
                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-600'
                  }`}
              >
                {isSelected && (
                  <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${c.dot} shadow-[0_0_6px_rgba(0,0,0,0.5)]`} />
                )}
                <span className={isSelected ? c.text : 'text-zinc-500'}>
                  {ch.icon}
                </span>
                <span className={`text-xs font-semibold leading-tight ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                  {ch.label}
                </span>
                <span className="text-[10px] text-zinc-600 leading-tight hidden sm:block">{ch.desc}</span>
              </button>
            );
          })}
        </div>
        {/* Hidden input to register the field */}
        <input type="hidden" {...register('preferred_channel')} />
        {errors.preferred_channel && <p className="text-xs text-red-400">{errors.preferred_channel.message}</p>}
      </div>

      {/* Success / Error feedback */}
      {mutation.isSuccess && (
        <div className="p-3 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          Company added successfully!
        </div>
      )}
      {mutation.isError && (
        <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          {mutation.error instanceof Error ? mutation.error.message : 'Failed to create company'}
        </div>
      )}

      <Button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-[0_0_20px_rgba(79,70,229,0.25)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)]"
      >
        {mutation.isPending ? 'Adding…' : 'Add Company'}
      </Button>
    </form>
  );
}
