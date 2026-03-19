'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Search, Settings, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface AdminCmsProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

export function AdminCmsContent({ dict }: AdminCmsProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  
  const [editItem, setEditItem] = useState<{ key: string, value: string } | null>(null);
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');

  const cms = trpc.admin.cms.listContent.useQuery({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  });

  const updateContent = trpc.admin.cms.updateContent.useMutation({
    onSuccess: () => {
      toast.success(ui.confirm);
      setEditItem(null);
      cms.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const items = cms.data?.data ?? [];

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.cms}</h1>
        <p className="text-sm text-text-muted">{a.cmsSubtitle}</p>
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
        {cms.isLoading ? (
          <div className="p-6"><SkeletonTable rows={10} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Settings className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            <div className="grid grid-cols-[1fr_2fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>Key</span>
              <span>Value</span>
              <span></span>
            </div>
            {items.map((item: any) => (
              <div key={item.key} className="grid grid-cols-[1fr_2fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <span className="text-xs font-mono text-brand">{item.key}</span>
                <span className="text-xs text-text-secondary truncate">{item.value?.slice(0, 100)}</span>
                <button
                  onClick={() => {
                    setEditItem(item);
                    setNewValue(item.value ?? '');
                    setReason('');
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(cms.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {cms.data?.totalPages ?? 1}</span>
          <button disabled={page >= (cms.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in text-left">
          <div className="bg-elevated border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">Edit Value</h2>
              <p className="text-sm text-text-muted font-mono mt-1">{editItem.key}</p>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-xs font-medium text-text-muted mb-2">Value</label>
                <textarea
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full h-32 bg-surface border border-border-subtle rounded-xl text-text-primary text-sm p-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">{a.reasonForChange}</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  placeholder="e.g. Updated SEO keywords"
                />
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button
                onClick={() => setEditItem(null)}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                {ui.cancel}
              </button>
              <button
                onClick={() => updateContent.mutate({ key: editItem.key, value: newValue, reason })}
                disabled={updateContent.isPending || !reason || newValue === editItem.value}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {ui.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
