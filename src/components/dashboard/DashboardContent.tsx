'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SkeletonCard, SkeletonRow } from '@/components/ui/Skeleton';
import { Mail, Globe, Wallet, MessageSquare, Plus, ArrowUpRight, TrendingUp, Clock, Inbox, Flame } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { useState } from 'react';

interface DashboardContentProps {
  locale: string;
  dict: {
    dashboard: Record<string, string>;
    common: Record<string, string>;
    tooltips: Record<string, string>;
  };
}

export function DashboardContent({ locale, dict }: DashboardContentProps) {
  const d = dict.dashboard;
  const tips = dict.tooltips ?? {};
  const toast = useToast();
  const [username, setUsername] = useState('');

  const mailboxes = trpc.mailbox.list.useQuery({ page: 1, pageSize: 5 });
  const wallet = trpc.billing.getWallet.useQuery();
  const domains = trpc.domain.list.useQuery();

  const createMailbox = trpc.mailbox.create.useMutation({
    onSuccess: () => {
      toast.success(d.createSuccess);
      setUsername('');
      mailboxes.refetch();
    },
    onError: (err) => {
      toast.error(err.message ?? d.createError);
    },
  });

  const isLoading = mailboxes.isLoading || wallet.isLoading;

  const stats = [
    { icon: Mail, label: d.statMailboxes, value: mailboxes.data?.total ?? '—', gradient: 'from-brand to-amber' },
    { icon: MessageSquare, label: d.statMessages, value: mailboxes.data?.data?.reduce((sum: number, m: any) => sum + (m.messageCount ?? 0), 0) ?? '—', gradient: 'from-brand-deep to-coral' },
    { icon: Globe, label: d.statDomains, value: domains.data?.length ?? '—', gradient: 'from-tangerine to-peach' },
    { icon: Wallet, label: d.statBalance, value: wallet.data ? `฿${Number(wallet.data.balance).toLocaleString()}` : '—', gradient: 'from-success to-accent-teal' },
  ];

  const handleQuickCreate = () => {
    createMailbox.mutate({ username: username || undefined } as any);
  };

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{d.title}</h1>
        <p className="text-sm text-text-muted">{d.welcome}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((s, i) => (
              <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} gradient={s.gradient} index={i} />
            ))
        }
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-2">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-bold text-text-primary">{d.quickCreate}</h2>
          </div>
          <div className="flex gap-2.5">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
                placeholder={d.quickCreatePlaceholder}
                id="quick-create-username"
              />
            </div>
            <Tooltip text={tips.quickCreate} position="bottom">
            <button
              onClick={handleQuickCreate}
              disabled={createMailbox.isPending}
              className="px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all duration-300 whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              id="quick-create-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              {dict.common.create ?? d.quickCreate}
            </button>
            </Tooltip>
          </div>
        </div>

        <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-bold text-text-primary">{d.currentPlan}</h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/10 border border-brand/15 px-3 py-1 rounded-full flex items-center gap-1">
              <Flame className="w-2.5 h-2.5" />
              Free
            </span>
          </div>
          <p className="text-xs text-text-muted mb-4">{mailboxes.data?.total ?? 0}/3 {d.statMailboxes}</p>
          <Tooltip text={tips.upgrade} position="bottom">
          <a
            href={`/${locale}/pricing`}
            className="w-full py-2.5 text-sm font-semibold text-brand border border-brand/25 rounded-xl hover:bg-brand/8 hover:border-brand/40 transition-all duration-300 flex items-center justify-center gap-1.5"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            {dict.common.upgrade ?? 'Upgrade'}
          </a>
          </Tooltip>
        </div>
      </div>

      {/* Recent Mailboxes */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-bold text-text-primary">{d.recentMailboxes}</h2>
          </div>
          <a href={`/${locale}/dashboard/mailboxes`} className="text-xs text-brand hover:underline flex items-center gap-1 transition-colors font-medium">
            {dict.common.viewAll ?? 'View All'}
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
        <div className="space-y-2">
          {mailboxes.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
          ) : mailboxes.data?.data?.length ? (
            mailboxes.data.data.map((mb: any) => (
              <div key={mb.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.015] hover:bg-white/[0.03] transition-all cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-brand/10">
                    <Mail className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors font-mono">{mb.address}</p>
                    <p className="text-[10px] text-text-muted">{mb.messageCount ?? 0} {d.messages}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-[10px] text-text-muted">
                    <Clock className="w-3 h-3" />
                    {d.expiresIn}
                  </div>
                  <StatusBadge status={mb.status} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-text-muted/50 py-8">{dict.common.noData ?? 'No data'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
