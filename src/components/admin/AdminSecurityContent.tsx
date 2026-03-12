'use client';

import { trpc } from '@/lib/trpc';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Shield, Search, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/dayjs';
import { useToast } from '@/components/ui/Toast';

interface AdminSecurityProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

export function AdminSecurityContent({ dict }: AdminSecurityProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const security = trpc.admin.security.getRiskEvents.useQuery({
    page,
    pageSize: 20,
    type: debouncedSearch || undefined,
    severity: severityFilter ? (severityFilter as any) : undefined,
  });

  const revokeSessions = trpc.admin.security.globalRevokeSessions.useMutation({
    onSuccess: (data) => toast.success(`Revoked ${data.sessionsRevoked} sessions successfully`),
    onError: (err) => toast.error(err.message),
  });

  const items = security.data?.data ?? [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.security}</h1>
          <p className="text-sm text-text-muted">{a.securitySubtitle}</p>
        </div>
        <button
          onClick={() => {
            if (confirm('Are you sure you want to logically revoke all active sessions across the platform? Users will need to log in again.')) {
              revokeSessions.mutate({ reason: 'Admin triggered global revoke from security dashboard' });
            }
          }}
          disabled={revokeSessions.isPending}
          className="px-4 py-2.5 bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Revoke All Sessions</span>
        </button>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-1">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
              placeholder="Search event type..." />
          </div>
          <select value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 transition-all">
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        {security.isLoading ? (
          <div className="p-6"><SkeletonTable rows={10} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Shield className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>Time</span>
              <span>Type / User</span>
              <span>Severity</span>
              <span>IP Address</span>
              <span>Resolved</span>
            </div>
            {items.map((item: any) => (
              <div key={item.id} className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <span className="text-[10px] text-text-muted">{formatDate(item.createdAt)}</span>
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-text-primary truncate">{item.type}</p>
                  <p className="text-[10px] text-text-muted truncate">{item.user?.email ?? 'System'}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md w-fit ${
                  item.severity === 'critical' ? 'bg-warning/20 text-warning' :
                  item.severity === 'high' ? 'bg-[#ff9800]/20 text-[#ff9800]' :
                  item.severity === 'medium' ? 'bg-amber/20 text-amber' :
                  'bg-white/10 text-text-secondary'
                }`}>{item.severity}</span>
                <span className="text-[10px] text-text-muted/60 font-mono truncate">{item.ipAddress ?? '—'}</span>
                <div className="flex items-center justify-end">
                  {item.resolvedAt ? (
                    <span className="text-[10px] text-success font-medium">Yes</span>
                  ) : (
                    <span className="text-[10px] text-warning font-medium">No</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(security.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {Math.ceil((security.data?.total ?? 0) / 20)}</span>
          <button disabled={page >= Math.ceil((security.data?.total ?? 0) / 20)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}
    </div>
  );
}
