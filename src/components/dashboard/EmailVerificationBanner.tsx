'use client';

import { useState } from 'react';
import { AlertTriangle, X, Loader2, Mail } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { trpc } from '@/lib/trpc';

interface EmailVerificationBannerProps {
  dict: {
    verifyBanner?: string;
    verifyBannerAction?: string;
    verifyBannerSent?: string;
    tooltips?: Record<string, string>;
  };
}

export function EmailVerificationBanner({ dict }: EmailVerificationBannerProps) {
  const tips = (dict as any).tooltips ?? {};
  const me = trpc.auth.me.useQuery();
  const requestVerification = trpc.auth.requestEmailVerification.useMutation();
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  // Don't show if loading, verified, or dismissed
  if (me.isLoading || !me.data || me.data.emailVerifiedAt || dismissed) {
    return null;
  }

  const handleResend = async () => {
    try {
      await requestVerification.mutateAsync();
      setSent(true);
    } catch {
      // silently fail — rate limit will handle abuse
    }
  };

  return (
    <div className="relative flex items-center gap-3 px-4 py-3 mb-4 rounded-xl bg-amber/10 border border-amber/20 text-amber-200 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0 text-amber" />
      <span className="flex-1">
        {sent
          ? (dict.verifyBannerSent || 'Verification email sent! Check your inbox.')
          : (dict.verifyBanner || 'Your email is not verified. Please verify to unlock all features.')}
      </span>
      {!sent && (
        <Tooltip text={tips.verifyEmail} position="bottom">
        <button
          onClick={handleResend}
          disabled={requestVerification.isPending}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber/20 hover:bg-amber/30 text-amber font-medium text-xs transition-all disabled:opacity-50"
        >
          {requestVerification.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Mail className="w-3 h-3" />
          )}
          {dict.verifyBannerAction || 'Verify Now'}
        </button>
        </Tooltip>
      )}
      <Tooltip text={tips.dismissBanner} position="left">
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded-lg hover:bg-amber/20 text-amber/50 hover:text-amber transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      </Tooltip>
    </div>
  );
}
