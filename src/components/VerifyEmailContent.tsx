'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/config/ui';

interface VerifyEmailContentProps {
  locale: string;
  dict: {
    verifyEmailTitle: string;
    verifyingEmail: string;
    verifySuccess: string;
    verifySuccessMessage: string;
    verifyFailed: string;
    verifyFailedMessage: string;
    goToDashboard: string;
    backToLogin: string;
    resendVerification: string;
    networkError: string;
  };
}

export function VerifyEmailContent({ locale, dict }: VerifyEmailContentProps) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        setStatus(res.ok ? 'success' : 'error');
      } catch {
        setStatus('error');
      }
    };

    verify();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-brand animate-spin mx-auto" />
        <p className="text-sm text-text-secondary">{dict.verifyingEmail}</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">{dict.verifySuccess}</h2>
        <p className="text-sm text-text-secondary">{dict.verifySuccessMessage}</p>
        <Link
          href={`/${locale}${ROUTES.dashboard}`}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 transition-all duration-300"
        >
          {dict.goToDashboard}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center mx-auto">
        <XCircle className="w-8 h-8 text-danger" />
      </div>
      <h2 className="text-lg font-bold text-text-primary">{dict.verifyFailed}</h2>
      <p className="text-sm text-text-secondary">{dict.verifyFailedMessage}</p>
      <div className="flex flex-col items-center gap-2">
        <Link
          href={`/${locale}${ROUTES.dashboard}`}
          className="inline-flex items-center gap-2 text-sm text-brand font-semibold hover:underline"
        >
          {dict.goToDashboard}
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href={`/${locale}${ROUTES.login}`}
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-brand transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {dict.backToLogin}
        </Link>
      </div>
    </div>
  );
}
