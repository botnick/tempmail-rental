'use client';

import { trpc } from '@/lib/trpc';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Layers, Search } from 'lucide-react';
import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/dayjs';

interface AdminPlansProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

export function AdminPlansContent({ dict }: AdminPlansProps) {
  const a = dict.admin;
  const ui = dict.ui;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const plans = trpc.admin.plan.list.useQuery({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  });

  const items = plans.data?.data ?? [];

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.plans}</h1>
        <p className="text-sm text-text-muted">{a.plansSubtitle}</p>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-1">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            placeholder={ui.searchPlaceholder} />
        </div>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        {plans.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Layers className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>Plan Name</span>
              <span>Sort Order</span>
              <span>Features</span>
              <span>Created</span>
            </div>
            {items.map((item: any) => (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4 text-brand" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary font-mono truncate">{item.name}</p>
                    <span className="text-[10px] text-text-muted truncate">{item.description}</span>
                  </div>
                </div>
                <span className="text-xs text-text-secondary font-mono">{item.sortOrder}</span>
                <span className="text-xs text-text-muted font-mono">{item.features?.length ?? 0} features</span>
                <span className="text-[10px] text-text-muted">{formatDate(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {(plans.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {plans.data?.totalPages ?? 1}</span>
          <button disabled={page >= (plans.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}
    </div>
  );
}
