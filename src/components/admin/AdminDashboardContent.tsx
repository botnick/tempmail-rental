'use client';

import { trpc } from '@/lib/trpc';
import { StatCard } from '@/components/ui/StatCard';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { Users, Mail, CreditCard, ShieldAlert, TrendingUp } from 'lucide-react';

interface AdminDashboardProps {
  dict: { admin: Record<string, string> };
}

export function AdminDashboardContent({ dict }: AdminDashboardProps) {
  const a = dict.admin;
  const stats = trpc.admin.dashboard.getStats.useQuery();
  const trend = trpc.admin.dashboard.getSignupTrend.useQuery({ days: 30 });

  const cards = stats.data ? [
    { icon: Users, label: a.totalUsers, value: stats.data.users.total, gradient: 'from-brand to-amber' },
    { icon: Users, label: a.dau, value: stats.data.users.dau, gradient: 'from-brand-deep to-coral' },
    { icon: Users, label: a.mau, value: stats.data.users.mau, gradient: 'from-tangerine to-peach' },
    { icon: Mail, label: a.activeMailboxes, value: stats.data.mailboxes.active, gradient: 'from-success to-accent-teal' },
    { icon: Mail, label: a.totalMailboxes, value: stats.data.mailboxes.total, gradient: 'from-brand to-amber' },
    { icon: CreditCard, label: a.pendingTopups, value: stats.data.billing.pendingTopups, gradient: 'from-warning to-amber' },
    { icon: CreditCard, label: a.totalRevenue, value: `฿${Number(stats.data.billing.totalRevenue).toLocaleString()}`, gradient: 'from-success to-accent-teal' },
    { icon: ShieldAlert, label: a.riskAlerts, value: stats.data.security.unresolvedRiskEvents, gradient: 'from-danger to-coral' },
  ] : [];

  const trendData = trend.data ?? [];
  const maxCount = Math.max(...trendData.map((d) => d.count), 1);

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.dashboard}</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.isLoading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : cards.map((c, i) => <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} gradient={c.gradient} index={i} />)
        }
      </div>

      {/* ─── Signup Trend Chart ─── */}
      <div className="mt-8 bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6 animate-fade-in-up delay-2">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-amber flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Signup Trend</h2>
            <p className="text-[10px] text-text-muted">Last 30 days</p>
          </div>
        </div>

        {trend.isLoading ? (
          <div className="h-40 bg-white/[0.02] rounded-xl animate-pulse" />
        ) : trendData.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-8">No signup data available</p>
        ) : (
          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[9px] text-text-muted/50 pr-1">
              <span>{maxCount}</span>
              <span>{Math.round(maxCount / 2)}</span>
              <span>0</span>
            </div>

            {/* Chart area */}
            <div className="ml-10 overflow-x-auto">
              <div className="flex items-end gap-[3px] h-40 min-w-0" style={{ minWidth: trendData.length * 16 }}>
                {trendData.map((d) => {
                  const height = Math.max((d.count / maxCount) * 100, 4);
                  return (
                    <div key={d.date} className="flex-1 min-w-[12px] group relative flex flex-col items-center justify-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-brand to-brand/40 transition-all duration-300 group-hover:from-brand-hover group-hover:to-brand/60"
                        style={{ height: `${height}%` }}
                      />
                      {/* Tooltip */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-bg-card border border-border-subtle rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-xl">
                        <p className="text-[10px] font-bold text-text-primary">{d.count} signups</p>
                        <p className="text-[9px] text-text-muted">{d.date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* X-axis: show every 5th date */}
              <div className="flex gap-[3px] mt-1" style={{ minWidth: trendData.length * 16 }}>
                {trendData.map((d, i) => (
                  <div key={d.date} className="flex-1 min-w-[12px] text-center">
                    {i % 5 === 0 && <span className="text-[8px] text-text-muted/40">{d.date.slice(5)}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
