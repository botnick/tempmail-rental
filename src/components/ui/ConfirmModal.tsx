'use client';

import { Modal } from './Modal';
import { Loader2, ShieldAlert, AlertTriangle, HelpCircle } from 'lucide-react';
import { useState } from 'react';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant?: 'danger' | 'warning' | 'default';
}

const VARIANT_CONFIG = {
  danger: {
    Icon: ShieldAlert,
    gradient: 'linear-gradient(135deg, #ef4444, #f87171, #fb7185)',
    glowShadow: '0 0 32px -4px rgba(239,68,68,0.5)',
    ringColor: 'rgba(239,68,68,0.15)',
    accentGradient: 'linear-gradient(to right, rgba(239,68,68,0.6), rgba(239,68,68,0.15), transparent)',
    btnGradient: 'linear-gradient(to right, #ef4444, #f87171, #fb7185)',
    btnShadow: '0 8px 24px -4px rgba(239,68,68,0.35)',
    btnShadowHover: '0 12px 32px -4px rgba(239,68,68,0.5)',
    btnText: '#fff',
  },
  warning: {
    Icon: AlertTriangle,
    gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24, #fcd34d)',
    glowShadow: '0 0 32px -4px rgba(245,158,11,0.5)',
    ringColor: 'rgba(245,158,11,0.15)',
    accentGradient: 'linear-gradient(to right, rgba(245,158,11,0.6), rgba(245,158,11,0.15), transparent)',
    btnGradient: 'linear-gradient(to right, #f59e0b, #fbbf24, #fcd34d)',
    btnShadow: '0 8px 24px -4px rgba(245,158,11,0.35)',
    btnShadowHover: '0 12px 32px -4px rgba(245,158,11,0.5)',
    btnText: '#000',
  },
  default: {
    Icon: HelpCircle,
    gradient: 'linear-gradient(135deg, #f97316, #fb923c, #f59e0b)',
    glowShadow: '0 0 32px -4px rgba(249,115,22,0.5)',
    ringColor: 'rgba(249,115,22,0.15)',
    accentGradient: 'linear-gradient(to right, rgba(249,115,22,0.6), rgba(249,115,22,0.15), transparent)',
    btnGradient: 'linear-gradient(to right, #f97316, #fb923c, #f59e0b)',
    btnShadow: '0 8px 24px -4px rgba(249,115,22,0.35)',
    btnShadowHover: '0 12px 32px -4px rgba(249,115,22,0.5)',
    btnText: '#fff',
  },
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
}: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState(false);
  const config = VARIANT_CONFIG[variant];
  const Icon = config.Icon;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-[380px]">
      <div className="relative overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: config.accentGradient }} />

        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-gradient-to-b from-white/[0.015] to-transparent blur-3xl pointer-events-none" />

        <div className="relative text-center pt-2 pb-1">
          {/* Icon with premium glow ring */}
          <div className="relative inline-flex mb-6">
            <div
              className="absolute inset-0 rounded-2xl opacity-15 blur-xl scale-150"
              style={{ background: config.gradient }}
            />
            <div
              className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: config.gradient,
                boxShadow: config.glowShadow,
                outline: `1px solid ${config.ringColor}`,
              }}
            >
              <Icon className="w-8 h-8 text-white drop-shadow-lg" />
            </div>
          </div>

          <h3 className="text-lg font-extrabold text-text-primary mb-2 tracking-tight">{title}</h3>
          <p className="text-[13px] text-text-muted leading-relaxed mb-8 max-w-[280px] mx-auto">{message}</p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 text-sm font-semibold text-text-secondary bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.07] hover:border-white/[0.12] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => setHover(false)}
              className="flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
              style={{
                background: config.btnGradient,
                color: config.btnText,
                boxShadow: hover ? config.btnShadowHover : config.btnShadow,
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
