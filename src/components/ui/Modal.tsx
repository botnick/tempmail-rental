'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop with brand tint */}
      <div className="fixed inset-0 animate-fade-in" style={{
        background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.04) 0%, rgba(0,0,0,0.7) 100%)',
        backdropFilter: 'blur(8px)',
      }} />

      {/* Panel */}
      <div
        className={`relative ${maxWidth} w-full rounded-2xl overflow-hidden animate-fade-in-up`}
        style={{
          background: 'linear-gradient(170deg, rgba(32,26,22,0.99) 0%, rgba(18,14,12,0.99) 100%)',
          boxShadow: '0 0 0 1px rgba(249,115,22,0.06), 0 0 40px -8px rgba(249,115,22,0.08), 0 32px 80px -16px rgba(0,0,0,0.8)',
        }}
      >
        {/* Top accent line */}
        <div className="h-[2px] bg-gradient-to-r from-transparent via-brand/40 to-transparent" />

        {/* Header */}
        {title && (
          <div className="flex items-start justify-between px-6 pt-5 pb-0">
            <div>
              <h2 className="text-base font-bold text-text-primary">{title}</h2>
              {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted/40 hover:text-text-primary hover:bg-white/[0.06] transition-all duration-150 -mt-0.5 -mr-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">{children}</div>

        {/* Bottom subtle gradient */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>
    </div>,
    document.body
  );
}
