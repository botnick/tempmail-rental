'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/config/ui';

interface ResetPasswordFormProps {
  locale: string;
  dict: {
    resetPasswordTitle: string;
    resetPasswordSubtitle: string;
    newPassword: string;
    confirmNewPassword: string;
    resetPasswordButton: string;
    resetSuccess: string;
    resetSuccessMessage: string;
    invalidResetToken: string;
    passwordMismatch: string;
    passwordMinLength: string;
    backToLogin: string;
    networkError: string;
  };
}

export function ResetPasswordForm({ locale, dict }: ResetPasswordFormProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(dict.passwordMinLength);
      return;
    }
    if (password !== confirm) {
      setError(dict.passwordMismatch);
      return;
    }
    if (!token) {
      setError(dict.invalidResetToken);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? dict.invalidResetToken);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError(dict.networkError);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">{dict.resetSuccess}</h2>
        <p className="text-sm text-text-secondary">{dict.resetSuccessMessage}</p>
        <Link
          href={`/${locale}${ROUTES.login}`}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300"
        >
          {dict.backToLogin}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-danger" />
        </div>
        <p className="text-sm text-text-secondary">{dict.invalidResetToken}</p>
        <Link
          href={`/${locale}${ROUTES.login}`}
          className="inline-flex items-center gap-2 text-sm text-brand font-semibold hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          {dict.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-extrabold text-center mb-1 text-text-primary">{dict.resetPasswordTitle}</h1>
      <p className="text-sm text-text-muted text-center mb-8">{dict.resetPasswordSubtitle}</p>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{dict.newPassword}</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="password"
              id="reset-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{dict.confirmNewPassword}</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="password"
              id="reset-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          id="reset-submit"
          disabled={loading}
          className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {dict.resetPasswordButton}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </>
  );
}
