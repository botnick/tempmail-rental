'use client';

import { useState } from 'react';
import { Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/config/ui';

interface ForgotPasswordFormProps {
  locale: string;
  dict: {
    forgotPasswordTitle: string;
    forgotPasswordSubtitle: string;
    email: string;
    sendResetLink: string;
    resetLinkSent: string;
    backToLogin: string;
    networkError: string;
  };
}

export function ForgotPasswordForm({ locale, dict }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong');
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
        <p className="text-sm text-text-secondary">{dict.resetLinkSent}</p>
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
      <h1 className="text-xl font-extrabold text-center mb-1 text-text-primary">{dict.forgotPasswordTitle}</h1>
      <p className="text-sm text-text-muted text-center mb-8">{dict.forgotPasswordSubtitle}</p>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{dict.email}</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="email"
              id="forgot-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 disabled:opacity-50"
              placeholder="you@email.com"
            />
          </div>
        </div>

        <button
          type="submit"
          id="forgot-submit"
          disabled={loading}
          className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {dict.sendResetLink}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center mt-4">
        <Link
          href={`/${locale}${ROUTES.login}`}
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-brand transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {dict.backToLogin}
        </Link>
      </div>
    </>
  );
}
