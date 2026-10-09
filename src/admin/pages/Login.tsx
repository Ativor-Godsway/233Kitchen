import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, ApiError } from '../../lib/api';
import { loginSchema } from '../../../shared/schemas';
import { Logo } from '../../components/Logo';
import { KenteBand } from '../../components/KenteBand';
import { Button, Field, Input, PasswordInput } from '../ui';

type Form = z.infer<typeof loginSchema>;

export default function Login() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    document.title = 'Log in · +233 Kitchen Admin';
  }, []);

  const onSubmit = async (data: Form) => {
    setError('');
    try {
      const res = await api<{ admin: { email: string } }>('/admin/login', {
        method: 'POST',
        json: data,
      });
      qc.setQueryData(['admin', 'me'], res.admin);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not log in');
    }
  };

  return (
    <div className="admin grid min-h-screen place-items-center bg-neutral-50 px-4 text-neutral-900">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-card">
        <div className="flex flex-col items-center bg-ink px-6 py-8">
          <Logo size={72} />
        </div>
        <KenteBand height={5} />
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6" noValidate>
          <div>
            <h1 className="text-lg font-semibold">Owner login</h1>
            <p className="text-sm text-neutral-500">Manage orders, menu and customers.</p>
          </div>
          <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="username" {...register('email')} />
          </Field>
          <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              {...register('password')}
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={formState.isSubmitting}
          >
            Log in
          </Button>
        </form>
      </div>
    </div>
  );
}
