'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { User, Lock, ShieldCheck, Mail, Copy, Loader2, KeyRound, ShieldOff } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface SettingsContentProps {
  dict: {
    settings: Record<string, string>;
    ui: Record<string, string>;
  };
}

export function SettingsContent({ dict }: SettingsContentProps) {
  const d = dict.settings;
  const ui = dict.ui;
  const toast = useToast();

  const me = trpc.auth.me.useQuery();

  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');

  // MFA state
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaStep, setMfaStep] = useState<'qr' | 'backup'>('qr');
  const [mfaData, setMfaData] = useState<{ secret: string; otpauthUri: string; backupCodes: string[] } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const codeInputRef = useRef<HTMLInputElement>(null);

  // MFA tRPC mutations
  const setupMfa = trpc.auth.setupMfa.useMutation();
  const confirmMfa = trpc.auth.confirmMfa.useMutation();
  const disableMfa = trpc.auth.disableMfa.useMutation();

  // Populate display name when data loads
  if (me.data && !displayName && me.data.displayName) {
    setDisplayName(me.data.displayName);
  }

  // Check MFA status from me data (roles might contain info, but we'll check credential)
  const isMfaEnabled = false; // Will be determined once we add mfaEnabled to auth.me

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
    } catch (err: any) {
      toast.error(d.invalidCode);
      setMfaCode('');
      codeInputRef.current?.focus();
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    try {
      await disableMfa.mutateAsync({ password: disablePassword });
      toast.success(d.mfaDisableSuccess);
      setDisableModalOpen(false);
      setDisablePassword('');
      me.refetch();
    } catch (err: any) {
      toast.error(err.message ?? 'Error');
    }
  };

  const copySecret = () => {
    if (mfaData?.secret) {
      navigator.clipboard.writeText(mfaData.secret);
      toast.info(d.secretCopied);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{d.title}</h1>
        <p className="text-sm text-text-muted">{d.subtitle}</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 mb-6 animate-fade-in-up delay-1">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-amber flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          <h2 className="text-sm font-bold text-text-primary">{d.profile}</h2>
        </div>

        {me.isLoading ? (
          <div className="space-y-4">
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-12" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.displayName}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.emailAddress}</label>
              <div className="flex items-center gap-2 bg-white/[0.02] border border-border-subtle rounded-xl py-3 px-4">
                <Mail className="w-4 h-4 text-text-muted/40" />
                <span className="text-sm text-text-muted font-mono">{me.data?.email ?? '—'}</span>
              </div>
            </div>
            <button
              onClick={() => toast.success(d.saveSuccess)}
              className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer"
            >
              {ui.save}
            </button>
          </div>
        )}
      </div>

      {/* Password Section */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 mb-6 animate-fade-in-up delay-2">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-deep to-coral flex items-center justify-center">
            <Lock className="w-3.5 h-3.5 text-white" />
          </div>
          <h2 className="text-sm font-bold text-text-primary">{d.changePassword}</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.currentPassword}</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.newPassword}</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.confirmNewPassword}</label>
            <input type="password" value={confirmNew} onChange={(e) => setConfirmNew(e.target.value)}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
            />
          </div>
          <button
            onClick={() => {
              if (newPassword !== confirmNew) { toast.error(d.confirmNewPassword); return; }
              toast.success(d.passwordSuccess);
              setCurrentPassword(''); setNewPassword(''); setConfirmNew('');
            }}
            disabled={!currentPassword || !newPassword || !confirmNew}
            className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {d.changePassword}
          </button>
        </div>
      </div>

      {/* MFA Section */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-3">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-text-primary">{d.mfa}</h2>
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

        <p className="text-xs text-text-muted mb-5 leading-relaxed">{d.scanQr}</p>

        {isMfaEnabled ? (
          <button
            onClick={() => { setDisablePassword(''); setDisableModalOpen(true); }}
            className="px-5 py-2.5 text-sm font-bold text-danger border border-danger/25 rounded-xl hover:bg-danger/8 hover:border-danger/40 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
          >
            <ShieldOff className="w-4 h-4" />
            {d.disableMfa}
          </button>
        ) : (
          <button
            onClick={handleEnableMfa}
            disabled={mfaLoading}
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {d.enableMfa}
          </button>
        )}
      </div>

      {/* ───── MFA Setup Modal ───── */}
      <Modal open={mfaModalOpen} onClose={() => mfaStep !== 'backup' && setMfaModalOpen(false)} maxWidth="max-w-md">
        <div className="relative">
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/60 via-teal-400/30 to-transparent" />

          {mfaStep === 'qr' && mfaData && (
            <div className="pt-2">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-text-primary">{d.mfaSetupTitle}</h3>
              </div>

              {/* Step 1: QR Code */}
              <p className="text-xs font-semibold text-text-secondary mb-3">{d.step1}</p>
              <div className="bg-white rounded-2xl p-4 mb-4 mx-auto w-fit">
                {/* QR code rendered as image from otpauth URI */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mfaData.otpauthUri)}`}
                  alt="TOTP QR Code"
                  width={180}
                  height={180}
                  className="block"
                />
              </div>

              {/* Manual secret */}
              <div className="bg-white/[0.03] border border-border-subtle rounded-xl p-3 mb-5">
                <p className="text-[10px] text-text-muted mb-1.5">{d.copySecret}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-brand tracking-wider break-all">{mfaData.secret}</code>
                  <button onClick={copySecret} className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all cursor-pointer">
                    <Copy className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                </div>
              </div>

              {/* Step 2: Enter code */}
              <p className="text-xs font-semibold text-text-secondary mb-3">{d.step2}</p>
              <div className="flex gap-3 items-end">
                <input
                  ref={codeInputRef}
                  type="text"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={d.codePlaceholder}
                  className="flex-1 bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-center text-2xl font-mono tracking-[0.5em] py-3 px-4 outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
                <button
                  onClick={handleConfirmMfa}
                  disabled={mfaCode.length !== 6 || mfaLoading}
                  className="px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2 whitespace-nowrap"
                >
                  {mfaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {d.verifyCode}
                </button>
              </div>
            </div>
          )}

          {mfaStep === 'backup' && mfaData && (
            <div className="pt-2">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
                  <KeyRound className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-extrabold text-text-primary mb-2">{d.backupCodes}</h3>
                <p className="text-xs text-text-muted max-w-xs mx-auto">{d.backupCodesHint}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-6">
                {mfaData.backupCodes.map((code) => (
                  <div key={code} className="bg-white/[0.03] border border-border-subtle rounded-lg py-2 px-3 text-center">
                    <code className="text-sm font-mono text-brand tracking-wider">{code}</code>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(mfaData.backupCodes.join('\n'));
                  toast.info(d.secretCopied);
                }}
                className="w-full py-2.5 text-xs font-semibold text-text-secondary bg-white/[0.04] border border-white/[0.06] rounded-xl hover:bg-white/[0.07] transition-all mb-3 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {d.copySecret}
              </button>

              <button
                onClick={() => setMfaModalOpen(false)}
                className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] transition-all cursor-pointer"
              >
                {ui.confirm ?? 'Done'}
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Disable MFA Confirmation */}
      <Modal open={disableModalOpen} onClose={() => setDisableModalOpen(false)} maxWidth="max-w-sm">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-danger/20 to-danger/5 flex items-center justify-center mx-auto mb-5 shadow-[0_0_20px_-4px_rgba(239,68,68,0.3)]">
            <ShieldOff className="w-7 h-7 text-danger" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-2">{d.disableMfa}</h3>
          <p className="text-sm text-text-muted mb-5">{d.passwordRequired}</p>
          <input
            type="password"
            value={disablePassword}
            onChange={(e) => setDisablePassword(e.target.value)}
            placeholder={d.currentPassword}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-danger/40 focus:ring-2 focus:ring-danger/10 transition-all mb-5"
          />
          <div className="flex gap-3">
            <button onClick={() => setDisableModalOpen(false)}
              className="flex-1 py-3 text-sm font-semibold text-text-secondary bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.07] transition-all cursor-pointer">
              {ui.cancel}
            </button>
            <button onClick={handleDisableMfa} disabled={!disablePassword}
              className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-danger to-red-400 rounded-xl hover:shadow-lg hover:shadow-danger/25 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">
              {d.disableMfa}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
