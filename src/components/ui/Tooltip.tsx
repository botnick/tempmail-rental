'use client';

import { type ReactNode, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** Tooltip text content */
  text: string;
  /** Preferred position — auto-adjusts if clipped by viewport */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Children to wrap */
  children: ReactNode;
}

const GAP = 8;
const EDGE = 8;

/**
 * Tooltip v6 — reliable wrapper approach.
 * Uses a plain <span> wrapper (no cloneElement) with portal tooltip.
 * The wrapper is invisible to flex layout and never blocks child clicks.
 */
export function Tooltip({ text, position: preferred = 'top', children }: TooltipProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<'hidden' | 'measuring' | 'visible'>('hidden');
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  const [arrow, setArrow] = useState(preferred);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

  // Measure & reposition (sync before paint)
  useLayoutEffect(() => {
    if (phase !== 'measuring') return;
    // Use the first child element for positioning (more accurate than wrapper)
    const wrapper = wrapperRef.current;
    const child = wrapper?.firstElementChild as HTMLElement | null;
    const anchor = child ?? wrapper;
    const tr = anchor?.getBoundingClientRect();
    const tt = tooltipRef.current?.getBoundingClientRect();
    if (!tr || !tt) { setPhase('hidden'); return; }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const space = { top: tr.top, bottom: vh - tr.bottom, left: tr.left, right: vw - tr.right };
    const order: Record<string, string[]> = {
      top: ['top', 'bottom', 'right', 'left'],
      bottom: ['bottom', 'top', 'right', 'left'],
      left: ['left', 'right', 'top', 'bottom'],
      right: ['right', 'left', 'top', 'bottom'],
    };
    const fits = (d: string) =>
      d === 'top' || d === 'bottom'
        ? space[d as 'top' | 'bottom'] >= tt.height + GAP
        : space[d as 'left' | 'right'] >= tt.width + GAP;

    const dir = (order[preferred].find(fits) ?? 'top') as typeof preferred;
    setArrow(dir);

    let top = 0, left = 0;
    switch (dir) {
      case 'top':    top = tr.top - tt.height - GAP; left = tr.left + tr.width / 2 - tt.width / 2; break;
      case 'bottom': top = tr.bottom + GAP;          left = tr.left + tr.width / 2 - tt.width / 2; break;
      case 'left':   top = tr.top + tr.height / 2 - tt.height / 2; left = tr.left - tt.width - GAP; break;
      case 'right':  top = tr.top + tr.height / 2 - tt.height / 2; left = tr.right + GAP; break;
    }
    left = Math.max(EDGE, Math.min(left, vw - tt.width - EDGE));
    top = Math.max(EDGE, Math.min(top, vh - tt.height - EDGE));
    setPos({ top, left });
    setPhase('visible');
  }, [phase, preferred]);

  const show = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setPhase('measuring'), 200);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setPhase('hidden');
  }, []);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  // No text → render children with zero overhead
  if (!text) return <>{children}</>;

  const isShown = phase === 'visible';

  const arrowStyle: Record<string, React.CSSProperties> = {
    top:    { bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    bottom: { top: -4,    left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    left:   { right: -4,  top: '50%',  transform: 'translateY(-50%) rotate(45deg)' },
    right:  { left: -4,   top: '50%',  transform: 'translateY(-50%) rotate(45deg)' },
  };

  const arrowBorders: Record<string, React.CSSProperties> = {
    top:    { borderRight: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' },
    bottom: { borderLeft: '1px solid rgba(255,255,255,0.06)', borderTop: '1px solid rgba(255,255,255,0.06)' },
    left:   { borderRight: '1px solid rgba(255,255,255,0.06)', borderTop: '1px solid rgba(255,255,255,0.06)' },
    right:  { borderLeft: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  };

  return (
    <>
      <span
        ref={wrapperRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        style={{ display: 'contents' }}
      >
        {children}
      </span>
      {mounted && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          aria-hidden={!isShown}
          style={{
            position: 'fixed',
            zIndex: 99999,
            top: pos.top,
            left: pos.left,
            pointerEvents: 'none',
            opacity: isShown ? 1 : 0,
            transform: isShown ? 'scale(1)' : 'scale(0.96)',
            transition: isShown ? 'opacity 120ms ease-out, transform 120ms ease-out' : 'none',
            ...(phase === 'measuring' ? { top: -9999, left: -9999, opacity: 0 } : {}),
          }}
        >
          <div style={{
            position: 'relative',
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: 500,
            lineHeight: 1.4,
            color: '#e4e4e7',
            background: '#18181b',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
            maxWidth: '200px',
            textAlign: 'center' as const,
          }}>
            {text}
            <div style={{
              position: 'absolute', width: 8, height: 8,
              background: '#18181b',
              ...arrowStyle[arrow],
              ...arrowBorders[arrow],
            }} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
