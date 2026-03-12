'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, Loader2, AlertCircle, Users } from 'lucide-react';

interface RegisterFormProps {
  locale: string;
  dict: {
    registerTitle: string;
    registerSubtitle: string;
    displayName: string;
    email: string;
    password: string;
    confirmPassword: string;
    registerButton: string;
    passwordMismatch: string;
    passwordMinLength: string;
    networkError: string;
    registerFailed: string;
  };
}

export function RegisterForm({ locale, dict }: RegisterFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(dict.passwordMismatch);
      return;
    }

    if (password.length < 8) {
      setError(dict.passwordMinLength);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? dict.registerFailed);
        setLoading(false);
        return;
      }

      // Redirect to dashboard
      router.push(`/${locale}/dashboard`);
    } catch {
      setError(dict.networkError);
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-xl font-extrabold text-center mb-1 text-text-primary">{dict.registerTitle}</h1>
      <p className="text-sm text-text-muted text-center mb-8">{dict.registerSubtitle}</p>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{dict.displayName}</label>
          <div className="relative">
            <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              id="register-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 disabled:opacity-50"
              placeholder={dict.displayName}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{dict.email}</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="email"
              id="register-email"
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
              id="register-password"
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
          <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{dict.confirmPassword}</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="password"
              id="register-confirm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>
        </div>
        <button
          type="submit"
          id="register-submit"
          disabled={loading}
          className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {dict.registerButton}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </>
  );
}
