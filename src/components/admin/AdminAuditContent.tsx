'use client';

import { trpc } from '@/lib/trpc';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ScrollText, Search } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '@/lib/dayjs';
import { useDebounce } from '@/hooks/useDebounce';

interface AdminAuditProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

export function AdminAuditContent({ dict }: AdminAuditProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const debouncedAction = useDebounce(actionFilter, 500);

  const logs = trpc.admin.audit.list.useQuery({
    page,
    pageSize: 30,
    action: debouncedAction || undefined,
  });

  const items = logs.data?.data ?? [];

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.audit}</h1>
        <p className="text-sm text-text-muted">{a.auditSubtitle}</p>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-1">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            placeholder={`${a.action}...`}
          />
        </div>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        {logs.isLoading ? (
          <div className="p-6"><SkeletonTable rows={10} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<ScrollText className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>{a.action}</span>
              <span>{a.actor}</span>
              <span>{a.target}</span>
              <span>{a.timestamp}</span>
              <span>{a.ip}</span>
            </div>
            {items.map((log: any) => (
              <div key={log.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <span className="text-xs font-mono text-brand">{log.action}</span>
                <span className="text-xs text-text-secondary truncate">{log.actor?.email ?? log.actorType}</span>
                <span className="text-xs text-text-muted truncate">{log.targetType}:{log.targetId?.slice(0, 8)}</span>
                <span className="text-[10px] text-text-muted">{formatDate(log.createdAt)}</span>
                <span className="text-[10px] text-text-muted/50 font-mono">{log.ipAddress ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {(logs.data?.total ?? 0) > 30 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {logs.data?.totalPages ?? 1}</span>
          <button disabled={page >= (logs.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}
    </div>
  );
}
