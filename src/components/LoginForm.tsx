'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { ROUTES } from '@/config/ui';

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
    mfaTitle?: string;
    mfaSubtitle?: string;
    mfaCode?: string;
    mfaVerify?: string;
    mfaInvalid?: string;
    mfaExpired?: string;
    backToLogin?: string;
  };
}

type Step = 'credentials' | 'mfa';

export function LoginForm({ locale, dict }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // MFA state
  const [step, setStep] = useState<Step>('credentials');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const mfaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'mfa' && mfaInputRef.current) {
      mfaInputRef.current.focus();
    }
  }, [step]);

  const handleLogin = async (e: React.FormEvent) => {
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

      // MFA required
      if (data.mfaRequired) {
        setMfaToken(data.mfaToken);
        setStep('mfa');
        setLoading(false);
        return;
      }

      // No MFA — redirect
      redirectToDashboard();
    } catch {
      setError(dict.networkError);
      setLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? (dict.mfaInvalid || 'Invalid code'));
        setLoading(false);
        return;
      }

      redirectToDashboard();
    } catch {
      setError(dict.networkError);
      setLoading(false);
    }
  };

  const redirectToDashboard = () => {
    const rawRedirect = searchParams.get('redirect') || `/${locale}/dashboard`;
    const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      ? rawRedirect
      : `/${locale}/dashboard`;
    router.push(redirectTo);
  };

  const resetToCredentials = () => {
    setStep('credentials');
    setMfaToken('');
    setMfaCode('');
    setError('');
  };

  // ─── MFA Step ───────────────────────────────────
  if (step === 'mfa') {
    return (
      <>
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-brand" />
          </div>
          <h1 className="text-xl font-extrabold text-center text-text-primary">
            {dict.mfaTitle || 'Two-Factor Authentication'}
          </h1>
          <p className="text-sm text-text-muted text-center mt-1">
            {dict.mfaSubtitle || 'Enter the 6-digit code from your authenticator app'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleMfaVerify}>
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">
              {dict.mfaCode || 'Verification Code'}
            </label>
            <input
              ref={mfaInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-2xl text-center tracking-[0.5em] py-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 disabled:opacity-50 font-mono"
              placeholder="000000"
            />
          </div>
          <button
            type="submit"
            disabled={loading || mfaCode.length !== 6}
            className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {dict.mfaVerify || 'Verify'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={resetToCredentials}
            className="w-full text-xs text-text-muted hover:text-text-primary transition-colors mt-2"
          >
            ← {dict.backToLogin || 'Back to login'}
          </button>
        </form>
      </>
    );
  }

  // ─── Credentials Step ───────────────────────────
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

      <form className="space-y-4" onSubmit={handleLogin}>
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
          <Link href={`/${locale}${ROUTES.forgotPassword}`} className="text-brand hover:underline font-medium">{dict.forgotPassword}</Link>
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
