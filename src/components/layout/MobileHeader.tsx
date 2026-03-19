'use client';

import { Menu } from 'lucide-react';
import { useMobileMenu } from '@/components/providers/MobileMenuProvider';
import { BRAND } from '@/config/ui';

/**
 * Mobile-only top header bar with hamburger menu toggle.
 * Hidden on ≥ md breakpoint.
 */
export function MobileHeader() {
  const { toggle } = useMobileMenu();
  const Logo = BRAND.Logo;

  return (
    <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-border-subtle bg-base/90 backdrop-blur-xl sticky top-0 z-50">
      <button
        onClick={toggle}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all cursor-pointer"
        aria-label="Toggle menu"
      >
        <Menu className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-amber flex items-center justify-center">
          <Logo className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-bold text-sm text-gradient">{BRAND.name}</span>
      </div>
      {/* Spacer for centering */}
      <div className="w-9" />
    </header>
  );
}
