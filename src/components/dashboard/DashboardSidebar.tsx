'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { BRAND } from '@/config/ui';
import {
  LayoutDashboard, Mail, Globe, CreditCard, Settings,
  ShieldCheck, LogOut, ChevronRight, X, Bell,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Tooltip } from '@/components/ui/Tooltip';
import { useMobileMenu } from '@/components/providers/MobileMenuProvider';
import { RankBadge } from '@/components/RankBadge';

const ADMIN_ROLES = ['SYSTEM_ADMIN', 'ADMIN'];

interface DashboardSidebarProps {
  locale: string;
  dict: {
    nav: Record<string, string>;
    common: Record<string, string>;
    tooltips: Record<string, string>;
  };
}

export function DashboardSidebar({ locale, dict }: DashboardSidebarProps) {
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const Logo = BRAND.Logo;
  const { isOpen, close } = useMobileMenu();
  const tips = dict.tooltips ?? {};

  const roles: string[] = (me.data as any)?.roles ?? [];
  const hasAdminAccess = roles.some((r) => ADMIN_ROLES.includes(r));
  const planSlug: string = (me.data as any)?.planSlug ?? 'free';

  // Pull tier metadata from current subscription so the rank badge always
  // reflects DB state (admin can recolor / rename without code change).
  const subscription = trpc.plan.mySubscription.useQuery(undefined, { retry: false });
  const tier = subscription.data?.plan ?? null;

  const userNav = [
    { href: `/${locale}/dashboard`, icon: LayoutDashboard, label: dict.nav.dashboard, exact: true },
    { href: `/${locale}/dashboard/mailboxes`, icon: Mail, label: dict.nav.mailboxes },
    { href: `/${locale}/dashboard/domains`, icon: Globe, label: dict.nav.domains },
    { href: `/${locale}/dashboard/billing`, icon: CreditCard, label: dict.nav.billing },
    { href: `/${locale}/dashboard/notifications`, icon: Bell, label: dict.nav.notifications ?? 'การแจ้งเตือน' },
    { href: `/${locale}/dashboard/settings`, icon: Settings, label: dict.nav.settings },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = `/${locale}/login`;
    } catch {
      window.location.href = `/${locale}/login`;
    }
  };

  /* ── Sidebar inner content (shared for desktop & mobile) ── */
  const sidebarContent = (
    <>
      {/* Logo */}
      <Link href={`/${locale}`} className="flex items-center gap-2.5 mb-8 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-amber flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg shadow-brand/15">
          <Logo className="w-4 h-4 text-white" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-gradient">{BRAND.name}</span>
          {tier && (
            <RankBadge
              tierName={tier.tierName}
              tierColor={tier.tierColor}
              tierIcon={tier.tierIcon}
              size="sm"
            />
          )}
        </div>
      </Link>

      {/* User Navigation */}
      <nav className="flex-1 space-y-0.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted/40 px-3 mb-2">
          {dict.nav.dashboard}
        </p>
        {userNav.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group ${
                active
                  ? 'bg-brand/8 text-brand font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-brand/5'
              }`}
            >
              <item.icon className={`w-[18px] h-[18px] transition-all ${active ? 'text-brand' : 'opacity-50 group-hover:opacity-100 group-hover:text-brand'}`} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* Admin Access Section */}
        {hasAdminAccess && (
          <>
            <div className="my-3 border-t border-border-subtle" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-text-muted/40 px-3 mb-2">
              {dict.nav.admin ?? 'Admin'}
            </p>
            <Link
              href={`/${locale}/admin`}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group ${
                pathname.startsWith(`/${locale}/admin`)
                  ? 'bg-brand-deep/10 text-brand-deep font-semibold'
                  : 'text-text-muted hover:text-text-primary hover:bg-brand/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className={`w-[18px] h-[18px] transition-all ${pathname.startsWith(`/${locale}/admin`) ? 'text-brand-deep' : 'opacity-50 group-hover:opacity-100'}`} />
                <span className="font-medium">{dict.nav.adminPanel ?? 'Admin Panel'}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 opacity-40" />
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="pt-4 border-t border-border-subtle space-y-1">
        {me.data && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-text-primary truncate">{(me.data as any).displayName ?? (me.data as any).email}</p>
            <p className="text-[10px] text-text-muted truncate">{(me.data as any).email}</p>
          </div>
        )}
        <div className="px-3 py-1">
          <ThemeToggle />
        </div>
        <Tooltip text={tips.logout} position="right">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted/60 hover:text-danger hover:bg-danger/5 transition-all duration-200 w-full cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span className="font-medium">{dict.common.logout}</span>
        </button>
        </Tooltip>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop Sidebar (≥ md) ── */}
      <aside className="hidden md:flex w-60 bg-base/95 backdrop-blur-2xl border-r border-border-subtle p-5 flex-col relative z-10 shrink-0">
        {sidebarContent}
      </aside>

      {/* ── Mobile Slide-over (< md) ── */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={close}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-base border-r border-border-subtle p-5 flex flex-col animate-slide-in-right overflow-y-auto">
            {/* Close button */}
            <Tooltip text={tips.closeSidebar} position="right">
            <button
              onClick={close}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted/60 hover:text-text-primary hover:bg-white/[0.06] transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            </Tooltip>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
