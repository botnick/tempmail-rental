'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface LoginFormProps {
  locale: string;
  dict: {
    loginTitle: string;
    loginSubtitle: string;
    email: string;
    password: string;
    rememberMe: string;
    forgotPassword: string;
    loginButton: string;
    networkError: string;
    loginFailed: string;
  };
}

export function LoginForm({ locale, dict }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? dict.loginFailed);
        setLoading(false);
        return;
      }

      // Redirect to original page or dashboard
      const redirectTo = searchParams.get('redirect') || `/${locale}/dashboard`;
      router.push(redirectTo);
    } catch {
      setError(dict.networkError);
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-xl font-extrabold text-center mb-1 text-text-primary">{dict.loginTitle}</h1>
      <p className="text-sm text-text-muted text-center mb-8">{dict.loginSubtitle}</p>

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
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 disabled:opacity-50"
              placeholder="you@email.com"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{dict.password}</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="password"
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 text-text-muted cursor-pointer">
            <input type="checkbox" className="rounded border-border-warm bg-white/5 accent-brand" />
            {dict.rememberMe}
          </label>
          <button type="button" className="text-brand hover:underline font-medium">{dict.forgotPassword}</button>
        </div>
        <button
          type="submit"
          id="login-submit"
          disabled={loading}
          className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {dict.loginButton}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </>
  );
}
