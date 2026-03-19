'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  User, Lock, ShieldCheck, Mail, Copy, Loader2,
  KeyRound, ShieldOff, Eye, EyeOff, Check, X,
} from 'lucide-react';
import { useState, useRef, useMemo } from 'react';

/* ────────────────────────────────────────────────────────────────── */
/* Types                                                             */
/* ────────────────────────────────────────────────────────────────── */
interface SettingsContentProps {
  dict: {
    settings: Record<string, string>;
    ui: Record<string, string>;
    tooltips: Record<string, string>;
  };
}

/* ────────────────────────────────────────────────────────────────── */
/* Password strength helper                                          */
/* ────────────────────────────────────────────────────────────────── */
const getPasswordStrength = (pw: string): { level: number; label: string; color: string } => {
  if (!pw) return { level: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))   score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1, label: 'Weak',   color: 'bg-red-500' };
  if (score <= 2) return { level: 2, label: 'Fair',   color: 'bg-amber-500' };
  if (score <= 3) return { level: 3, label: 'Good',   color: 'bg-blue-500' };
  return               { level: 4, label: 'Strong', color: 'bg-emerald-500' };
};

/* ────────────────────────────────────────────────────────────────── */
/* Main Component                                                    */
/* ────────────────────────────────────────────────────────────────── */
export function SettingsContent({ dict }: SettingsContentProps) {
  const d = dict.settings;
  const ui = dict.ui;
  const tips = dict.tooltips ?? {};
  const toast = useToast();

  const me = trpc.auth.me.useQuery();

  // ── Form state ──────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [nameInitialized, setNameInitialized] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // MFA state
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaStep, setMfaStep] = useState<'qr' | 'backup'>('qr');
  const [mfaData, setMfaData] = useState<{ secret: string; otpauthUri: string; backupCodes: string[] } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableTotpCode, setDisableTotpCode] = useState('');
  const disableTotpRef = useRef<HTMLInputElement>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // MFA tRPC mutations
  const setupMfa = trpc.auth.setupMfa.useMutation();
  const confirmMfa = trpc.auth.confirmMfa.useMutation();
  const disableMfa = trpc.auth.disableMfa.useMutation();

  // Populate display name once
  if (me.data && !nameInitialized && me.data.displayName) {
    setDisplayName(me.data.displayName);
    setNameInitialized(true);
  }

  const isMfaEnabled = me.data?.totpEnabled ?? false;

  // Avatar initials
  const initials = useMemo(() => {
    const name = me.data?.displayName || me.data?.email || '';
    const parts = name.split(/[\s@]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [me.data]);

  // Password strength
  const pwStrength = getPasswordStrength(newPassword);
  const passwordsMatch = confirmNew.length > 0 && newPassword === confirmNew;
  const passwordsMismatch = confirmNew.length > 0 && newPassword !== confirmNew;

  // ── Handlers ────────────────────────────────────────────────────
  const handleEnableMfa = async () => {
    setMfaLoading(true);
    try {
      const data = await setupMfa.mutateAsync();
      setMfaData(data as any);
      setMfaStep('qr');
      setMfaCode('');
      setMfaModalOpen(true);
    } catch (err: any) {
      toast.error(err.message ?? d.invalidCode);
    } finally {
      setMfaLoading(false);
    }
  };

  const handleConfirmMfa = async () => {
    if (mfaCode.length !== 6) return;
    setMfaLoading(true);
    try {
      await confirmMfa.mutateAsync({ code: mfaCode });
      setMfaStep('backup');
      toast.success(d.mfaEnableSuccess);
      me.refetch();
    } catch {
      toast.error(d.invalidCode);
      setMfaCode('');
      codeInputRef.current?.focus();
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (disableTotpCode.length !== 6) return;
    try {
      await disableMfa.mutateAsync({ password: disablePassword, totpCode: disableTotpCode });
      toast.success(d.mfaDisableSuccess);
      setDisableModalOpen(false);
      setDisablePassword('');
      setDisableTotpCode('');
      me.refetch();
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    }
  };

  const copySecret = () => {
    if (mfaData?.secret) {
      navigator.clipboard.writeText(mfaData.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 1500);
      toast.info(d.secretCopied);
    }
  };

  // ── Shared input class ──────────────────────────────────────────
  const inputCls = 'w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/40';
  const passwordInputCls = `${inputCls} pr-10 font-mono`;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{d.title}</h1>
          <p className="text-sm text-text-muted">{d.subtitle}</p>
        </div>
      </div>

      {/* ─── 2-Column Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* ─── Card 1: Profile ──────────────────────────────────────── */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-1">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
            <User className="w-4.5 h-4.5 text-brand" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">{d.profile}</h2>
            <p className="text-[11px] text-text-muted">{d.profileDesc ?? d.subtitle}</p>
          </div>
        </div>

        {me.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-12" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Avatar + Name row */}
            <div className="flex items-center gap-4 p-3 bg-white/[0.03] border border-border-subtle rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center shrink-0 shadow-lg shadow-brand/20">
                <span className="text-base font-extrabold text-white">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-text-primary truncate">{me.data?.displayName || '—'}</p>
                <p className="text-[11px] text-text-muted font-mono truncate">{me.data?.email ?? '—'}</p>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">{d.displayName}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/40"
                />
              </div>
            </div>

            {/* Email (readonly) */}
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">{d.emailAddress}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
                <div className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-sm py-2.5 pl-10 pr-4 text-text-muted font-mono truncate">
                  {me.data?.email ?? '—'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => toast.success(d.saveSuccess)}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 active:scale-[0.98] transition-all cursor-pointer"
              >
                {ui.save}
              </button>
            </div>
          </div>
        )}
      </div>

        {/* ─── Right Column: Password ─── */}
        <div>

      {/* ─── Card 2: Change Password ──────────────────────────────── */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-2">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <Lock className="w-4.5 h-4.5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">{d.changePassword}</h2>
            <p className="text-[11px] text-text-muted">{d.passwordSecurityDesc ?? 'Update your password regularly for better security'}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">{d.currentPassword}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-10 pr-10 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/40 font-mono"
              />
              <Tooltip text={tips.togglePassword} position="left">
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-secondary transition-colors cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              </Tooltip>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">{d.newPassword}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-10 pr-10 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/40 font-mono"
              />
              <Tooltip text={tips.togglePassword} position="left">
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-secondary transition-colors cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              </Tooltip>
            </div>
            {/* Strength meter */}
            {newPassword && (
              <div className="mt-2 space-y-1 animate-fade-in-up">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        i <= pwStrength.level ? pwStrength.color : 'bg-white/[0.06]'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-[10px] font-semibold ${
                  pwStrength.level <= 1 ? 'text-red-400' :
                  pwStrength.level <= 2 ? 'text-amber-400' :
                  pwStrength.level <= 3 ? 'text-blue-400' : 'text-emerald-400'
                }`}>
                  {pwStrength.label}
                </p>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">{d.confirmNewPassword}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmNew}
                onChange={(e) => setConfirmNew(e.target.value)}
                className={`w-full bg-white/[0.04] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-10 pr-10 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/40 font-mono ${
                  passwordsMatch ? 'border-emerald-500/40 ring-1 ring-emerald-500/10' :
                  passwordsMismatch ? 'border-red-500/40 ring-1 ring-red-500/10' : ''
                }`}
              />
              <Tooltip text={tips.togglePassword} position="left">
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text-secondary transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              </Tooltip>
            </div>
            {passwordsMatch && (
              <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <Check className="w-3 h-3" /> Passwords match
              </p>
            )}
            {passwordsMismatch && (
              <p className="text-[10px] text-red-400 mt-1">Passwords do not match</p>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                if (newPassword !== confirmNew) { toast.error(d.confirmNewPassword); return; }
                toast.success(d.passwordSuccess);
                setCurrentPassword(''); setNewPassword(''); setConfirmNew('');
              }}
              disabled={!currentPassword || !newPassword || !confirmNew || passwordsMismatch}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              {d.changePassword}
            </button>
          </div>
        </div>
      </div>{/* end password card */}

      </div>{/* end right column */}
      </div>{/* end grid */}

      {/* ─── Card 3: MFA (Full Width) ──────────────────────────────── */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 mt-6 animate-fade-in-up delay-3">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">{d.mfa}</h2>
              <p className="text-[11px] text-text-muted">{d.scanQr}</p>
            </div>
          </div>
          {isMfaEnabled ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {d.mfaEnabled}
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted bg-white/[0.04] border border-white/[0.06] px-3 py-1 rounded-full">
              {d.mfaDisabled}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-center">
          {/* Info box */}
          <div className="bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl p-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-text-muted leading-relaxed">
                {d.mfaInfoDesc ?? 'Two-factor authentication adds an extra layer of security to your account by requiring a verification code from your authenticator app at sign-in.'}
              </p>
            </div>
          </div>

          {/* Action button */}
          {isMfaEnabled ? (
            <Tooltip text={tips.disableMfa} position="bottom">
            <button
              onClick={() => { setDisablePassword(''); setDisableTotpCode(''); setDisableModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-danger border border-danger/25 rounded-xl hover:bg-danger/8 hover:border-danger/40 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            >
              <ShieldOff className="w-4 h-4" />
              {d.disableMfa}
            </button>
            </Tooltip>
          ) : (
            <Tooltip text={tips.enableMfa} position="bottom">
            <button
              onClick={handleEnableMfa}
              disabled={mfaLoading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {d.enableMfa}
            </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ───── MFA Setup Modal ───── */}
      <Modal open={mfaModalOpen} onClose={() => mfaStep !== 'backup' && setMfaModalOpen(false)} maxWidth="max-w-[420px]">
        <div className="relative">
          {/* ── Close button (always visible) ── */}
          <button
            type="button"
            onClick={() => setMfaModalOpen(false)}
            className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted/40 hover:text-text-primary hover:bg-white/[0.08] transition-all z-20 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {mfaStep === 'qr' && mfaData && (
            <div className="pt-1">
              {/* ─── Header ─── */}
              <div className="text-center mb-5">
                <div className="relative w-14 h-14 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 blur-xl opacity-35" />
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <ShieldCheck className="w-7 h-7 text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-extrabold text-text-primary tracking-tight">{d.mfaSetupTitle}</h3>
                <p className="text-[11px] text-text-muted mt-1 max-w-[260px] mx-auto leading-relaxed">
                  {d.mfaInfoDesc ?? 'Scan the QR code with your authenticator app to get started'}
                </p>
              </div>

              {/* ─── Step 1: QR Code ─── */}
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold shrink-0">1</span>
                <p className="text-[11px] font-semibold text-text-secondary">{d.step1}</p>
              </div>

              <div className="flex justify-center mb-4">
                <div className="bg-white rounded-xl p-3.5 shadow-lg shadow-black/10 ring-1 ring-white/10">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mfaData.otpauthUri)}`}
                    alt="TOTP QR Code"
                    width={180}
                    height={180}
                    className="block rounded-md"
                  />
                </div>
              </div>

              {/* ─── Secret key ─── */}
              <div className="bg-white/[0.03] border border-border-subtle rounded-xl px-3.5 py-3 mb-5">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[9px] font-medium text-text-muted/60 uppercase tracking-widest">{d.copySecret}</p>
                  <Tooltip text={tips.copySecret} position="left">
                  <button
                    onClick={copySecret}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-text-secondary hover:text-text-primary transition-all cursor-pointer"
                  >
                    {secretCopied ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                    {secretCopied ? 'Copied!' : 'Copy'}
                  </button>
                  </Tooltip>
                </div>
                <code className="block text-xs font-mono text-emerald-400 tracking-[0.12em] break-all leading-relaxed select-all">{mfaData.secret}</code>
              </div>

              {/* ─── Step 2: OTP Code ─── */}
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold shrink-0">2</span>
                <p className="text-[11px] font-semibold text-text-secondary">{d.step2}</p>
              </div>

              {/* 6-digit OTP grid */}
              <div
                className="flex justify-center gap-2 mb-5 cursor-text"
                onClick={() => codeInputRef.current?.focus()}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-11 h-12 rounded-lg border flex items-center justify-center text-xl font-bold font-mono transition-all duration-150 ${
                      mfaCode[i]
                        ? 'border-emerald-500/40 bg-emerald-500/[0.06] text-text-primary'
                        : i === mfaCode.length
                          ? 'border-emerald-500/30 bg-white/[0.03] text-text-muted/50 animate-pulse'
                          : 'border-white/[0.06] bg-white/[0.02] text-text-muted/20'
                    }`}
                  >
                    {mfaCode[i] || '·'}
                  </div>
                ))}
              </div>

              {/* Hidden real input */}
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="sr-only"
                aria-label={d.codePlaceholder}
              />

              {/* ─── Verify Button ─── */}
              <button
                onClick={handleConfirmMfa}
                disabled={mfaCode.length !== 6 || mfaLoading}
                className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none cursor-pointer flex items-center justify-center gap-2"
              >
                {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {d.verifyCode}
              </button>
            </div>
          )}

          {mfaStep === 'backup' && mfaData && (
            <div className="pt-1">
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
                  <KeyRound className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-text-primary mb-1">{d.backupCodes}</h3>
                <p className="text-[11px] text-text-muted max-w-[280px] mx-auto leading-relaxed">{d.backupCodesHint}</p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {mfaData.backupCodes.map((code) => (
                  <div key={code} className="bg-white/[0.03] border border-border-subtle rounded-lg py-1.5 px-3 text-center">
                    <code className="text-xs font-mono text-brand tracking-wider">{code}</code>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(mfaData.backupCodes.join('\n'));
                  toast.info(d.secretCopied);
                }}
                className="w-full py-2 text-xs font-semibold text-text-secondary bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.07] transition-all mb-2.5 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {d.copySecret}
              </button>

              <button
                onClick={() => setMfaModalOpen(false)}
                className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                {ui.confirm ?? 'Done'}
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* ───── Disable MFA Confirmation ───── */}
      <Modal open={disableModalOpen} onClose={() => setDisableModalOpen(false)} maxWidth="max-w-md">
        <div className="relative">
          {/* Top accent — danger */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500/60 via-red-400/30 to-transparent" />

          <div className="pt-4 pb-1">
            {/* ─── Header with glow badge ─── */}
            <div className="text-center mb-6">
              <div className="relative w-16 h-16 mx-auto mb-5">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 blur-xl opacity-30" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/15 to-rose-500/10 border border-red-500/20 flex items-center justify-center">
                  <ShieldOff className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <h3 className="text-xl font-extrabold text-text-primary tracking-tight">{d.disableMfa}</h3>
              <p className="text-xs text-text-muted mt-1.5 max-w-[280px] mx-auto leading-relaxed">
                {d.passwordRequired}
              </p>
            </div>

            {/* ─── Warning box ─── */}
            <div className="bg-red-500/[0.06] border border-red-500/15 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-2.5">
                <ShieldOff className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-300/80 leading-relaxed">
                  {d.mfaDisableWarning ?? 'การปิดจะลบ authenticator ที่ผูกไว้ บัญชีจะใช้แค่รหัสผ่านในการเข้าสู่ระบบ'}
                </p>
              </div>
            </div>

            {/* ─── Password input ─── */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-text-secondary mb-2 block">
                {d.currentPassword}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-red-500/40 focus:ring-2 focus:ring-red-500/10 transition-all placeholder:text-text-muted/40"
                />
              </div>
            </div>

            {/* ─── TOTP Code input ─── */}
            <div className="mb-6">
              <label className="text-xs font-semibold text-text-secondary mb-2 block">
                {d.totpCode ?? 'Authenticator Code'}
              </label>
              <div
                className="grid grid-cols-6 gap-2 cursor-text"
                onClick={() => disableTotpRef.current?.focus()}
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-11 rounded-lg border flex items-center justify-center text-lg font-bold transition-all ${
                      disableTotpCode[i]
                        ? 'border-red-500/40 bg-red-500/[0.06] text-text-primary'
                        : i === disableTotpCode.length
                          ? 'border-red-500/50 bg-white/[0.04] text-text-muted/30 ring-1 ring-red-500/20'
                          : 'border-border-subtle bg-white/[0.02] text-text-muted/20'
                    }`}
                  >
                    {disableTotpCode[i] || '·'}
                  </div>
                ))}
              </div>
              <input
                ref={disableTotpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={disableTotpCode}
                onChange={(e) => setDisableTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="sr-only"
                autoComplete="one-time-code"
              />
            </div>

            {/* ─── Buttons ─── */}
            <div className="flex gap-3">
              <button
                onClick={() => setDisableModalOpen(false)}
                className="flex-1 py-3.5 text-sm font-semibold text-text-secondary bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.07] hover:border-white/[0.1] active:scale-[0.98] transition-all cursor-pointer"
              >
                {ui.cancel}
              </button>
              <button
                onClick={handleDisableMfa}
                disabled={!disablePassword || disableTotpCode.length !== 6 || mfaLoading}
                className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-red-500 to-rose-500 rounded-xl hover:shadow-lg hover:shadow-red-500/25 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none cursor-pointer flex items-center justify-center gap-2"
              >
                {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                {d.disableMfa}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
