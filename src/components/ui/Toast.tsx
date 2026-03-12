'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const api: ToastContextType = {
    success: (msg) => add('success', msg),
    error: (msg) => add('error', msg),
    info: (msg) => add('info', msg),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none">
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={() => setToasts((x) => x.filter((y) => y.id !== t.id))} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const TOAST_CONFIG = {
  success: {
    Icon: CheckCircle,
    accent: 'rgba(34,197,94,0.6)',
    borderColor: 'rgba(34,197,94,0.15)',
    iconColor: '#22c55e',
    stripeGradient: 'linear-gradient(to bottom, rgba(34,197,94,0.4), rgba(34,197,94,0))',
  },
  error: {
    Icon: XCircle,
    accent: 'rgba(239,68,68,0.6)',
    borderColor: 'rgba(239,68,68,0.15)',
    iconColor: '#ef4444',
    stripeGradient: 'linear-gradient(to bottom, rgba(239,68,68,0.4), rgba(239,68,68,0))',
  },
  info: {
    Icon: Info,
    accent: 'rgba(249,115,22,0.6)',
    borderColor: 'rgba(249,115,22,0.15)',
    iconColor: '#f97316',
    stripeGradient: 'linear-gradient(to bottom, rgba(249,115,22,0.4), rgba(249,115,22,0))',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const config = TOAST_CONFIG[toast.type];
  const Icon = config.Icon;

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 pl-0 pr-3 py-0 rounded-xl overflow-hidden min-w-[300px] max-w-[420px] animate-slide-in-right"
      style={{
        background: 'linear-gradient(135deg, rgba(28,24,20,0.97) 0%, rgba(22,18,16,0.98) 100%)',
        border: `1px solid ${config.borderColor}`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px -8px rgba(0,0,0,0.6), 0 0 16px -4px ${config.accent}`,
      }}
    >
      {/* Left accent stripe */}
      <div className="w-[3px] self-stretch shrink-0" style={{ background: config.stripeGradient }} />

      {/* Icon */}
      <div className="py-3 pl-2">
        <Icon className="w-[18px] h-[18px]" style={{ color: config.iconColor }} />
      </div>

      {/* Message */}
      <p className="text-[13px] font-medium flex-1 text-text-primary py-3 leading-snug">{toast.message}</p>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted/30 hover:text-text-primary hover:bg-white/[0.06] transition-all cursor-pointer shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
