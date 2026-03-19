'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

interface LandingMobileNavProps {
  locale: string;
  links: { href: string; label: string }[];
  loginLabel: string;
  loginHref: string;
  registerLabel: string;
  registerHref: string;
}

export function LandingMobileNav({
  locale,
  links,
  loginLabel,
  loginHref,
  registerLabel,
  registerHref,
}: LandingMobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-all cursor-pointer"
        aria-label="Toggle navigation"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 bg-base/95 backdrop-blur-2xl border-b border-border-subtle px-6 py-4 space-y-1 animate-fade-in-up z-50">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm text-text-secondary hover:text-text-primary hover:bg-brand/5 rounded-xl transition-all"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-border-subtle mt-3 flex flex-col gap-2">
            <Link
              href={loginHref}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm font-semibold text-brand border border-brand/30 rounded-xl text-center hover:bg-brand/10 transition-all"
            >
              {loginLabel}
            </Link>
            <Link
              href={registerHref}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl text-center hover:shadow-lg hover:shadow-brand/25 transition-all"
            >
              {registerLabel}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
