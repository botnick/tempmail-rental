'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { BRAND } from '@/config/ui';
import {
  LayoutDashboard, Users, Mail, Globe, CreditCard,
  Shield, Flag, FileText, ScrollText, ArrowLeft,
  Package, LogOut, Search,
} from 'lucide-react';

/**
 * Admin nav items with role-based access control.
 * Each item specifies which roles can see it.
 * SYSTEM_ADMIN sees everything.
 */
const ALL_ADMIN_ROLES = ['SYSTEM_ADMIN', 'ADMIN'];

function getAdminNavItems(locale: string, dict: Record<string, string>) {
  return [
    {
      href: `/${locale}/admin`,
      icon: LayoutDashboard,
      label: dict.dashboard,
      roles: ALL_ADMIN_ROLES,
      exact: true,
    },
    {
      href: `/${locale}/admin/users`,
      icon: Users,
      label: dict.users,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/mailboxes`,
      icon: Mail,
      label: dict.mailboxes,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/domains`,
      icon: Globe,
      label: dict.domains,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/tempmail`,
      icon: Mail,
      label: dict.tempMail || 'TempMail API',
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/plans`,
      icon: Package,
      label: dict.plans,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/billing`,
      icon: CreditCard,
      label: dict.billing,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/security`,
      icon: Shield,
      label: dict.security,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/feature-flags`,
      icon: Flag,
      label: dict.featureFlags,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/cms`,
      icon: FileText,
      label: dict.cms,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/seo`,
      icon: Search,
      label: dict.seo ?? 'SEO',
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/audit`,
      icon: ScrollText,
      label: dict.audit,
      roles: ALL_ADMIN_ROLES,
    },
    {
      href: `/${locale}/admin/rbac`,
      icon: Shield,
      label: dict.rbac ?? 'RBAC',
      roles: ALL_ADMIN_ROLES,
    },
  ];
}

interface AdminSidebarProps {
  locale: string;
  dict: {
    admin: Record<string, string>;
    common: Record<string, string>;
  };
}

export function AdminSidebar({ locale, dict }: AdminSidebarProps) {
  const pathname = usePathname();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const AdminLogo = BRAND.adminLogo;

  const roles: string[] = (me.data as any)?.roles ?? [];
  const isSystemAdmin = roles.includes('SYSTEM_ADMIN');

  const allItems = getAdminNavItems(locale, dict.admin);

  // SYSTEM_ADMIN sees everything; others see only items matching their roles
  const visibleItems = isSystemAdmin
    ? allItems
    : allItems.filter((item) => item.roles.some((r) => roles.includes(r)));

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

  return (
    <aside className="w-64 bg-base/95 backdrop-blur-2xl border-r border-border-subtle p-5 flex flex-col relative z-10 shrink-0">
      {/* Admin Logo */}
      <div className="mb-8">
        <Link href={`/${locale}/admin`} className="flex items-center gap-2.5 group mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-deep to-coral flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg shadow-brand/15">
            <AdminLogo className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <span className="font-bold text-sm text-gradient-warm">Admin</span>
            <span className="text-xs text-text-muted ml-1.5">Panel</span>
          </div>
        </Link>
        {roles.length > 0 && (
          <p className="text-[9px] text-brand/60 ml-[46px] tracking-wider uppercase font-bold">
            {roles[0].replace(/_/g, ' ')}
          </p>
        )}
      </div>

      {/* Admin Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
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
      </nav>

      {/* Footer */}
      <div className="pt-4 border-t border-border-subtle space-y-0.5 mt-4">
        {me.data && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-text-primary truncate">{(me.data as any).displayName ?? (me.data as any).email}</p>
            <p className="text-[10px] text-text-muted truncate">{(me.data as any).email}</p>
          </div>
        )}
        <Link
          href={`/${locale}/dashboard`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted/60 hover:text-text-secondary hover:bg-white/[0.02] transition-all duration-200"
        >
          <ArrowLeft className="w-[18px] h-[18px]" />
          <span className="font-medium">{dict.common.backToDashboard}</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted/60 hover:text-danger hover:bg-danger/5 transition-all duration-200 w-full cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px]" />
          <span className="font-medium">{dict.common.logout}</span>
        </button>
      </div>
    </aside>
  );
}
