'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Flag, Search, Plus } from 'lucide-react';
import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

interface AdminFeatureFlagsProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

export function AdminFeatureFlagsContent({ dict }: AdminFeatureFlagsProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const flags = trpc.admin.featureFlag.list.useQuery({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  });

  const updateFlag = trpc.admin.featureFlag.update.useMutation({
    onSuccess: () => { toast.success(ui.confirm); flags.refetch(); },
    onError: (err: any) => toast.error(err.message),
  });

  // Create flag state
  const [showCreate, setShowCreate] = useState(false);
  const [newFlag, setNewFlag] = useState({
    key: '', name: '', description: '', enabled: false, rolloutPct: 0,
    targetRoles: '', targetPlans: '', targetUsers: '',
  });

  const createFlag = trpc.admin.featureFlag.create.useMutation({
    onSuccess: () => {
      toast.success(ui.confirm);
      setShowCreate(false);
      setNewFlag({ key: '', name: '', description: '', enabled: false, rolloutPct: 0, targetRoles: '', targetPlans: '', targetUsers: '' });
      flags.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const items = flags.data?.data ?? [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.featureFlags}</h1>
          <p className="text-sm text-text-muted">{a.featureFlagsSubtitle}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 bg-brand text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-hover active:scale-[0.98] transition-all cursor-pointer text-sm">
          <Plus className="w-4 h-4" />{a.createFlag}
        </button>
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
        {flags.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Flag className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((flag: any) => (
              <div key={flag.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium text-text-primary font-mono">{flag.key}</p>
                    {flag.rolloutPct > 0 && flag.rolloutPct < 100 && (
                      <span className="text-[10px] bg-amber/10 text-amber px-1.5 py-0.5 rounded-md font-bold">{flag.rolloutPct}%</span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5">{flag.description ?? flag.name ?? ''}</p>
                </div>
                <button
                  onClick={() => updateFlag.mutate({ id: flag.id, enabled: !flag.enabled, reason: `Toggled ${flag.key} to ${!flag.enabled ? 'enabled' : 'disabled'}` })}
                  disabled={updateFlag.isPending}
                  className={`relative w-11 h-6 rounded-full transition-all duration-200 cursor-pointer ${flag.enabled ? 'bg-success' : 'bg-white/[0.08]'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${flag.enabled ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(flags.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {Math.ceil((flags.data?.total ?? 0) / 20)}</span>
          <button disabled={page >= Math.ceil((flags.data?.total ?? 0) / 20)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Create Flag Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in text-left">
          <div className="bg-elevated border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary">{a.createFlagTitle}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Key</label>
                  <input type="text" value={newFlag.key} onChange={(e) => setNewFlag({ ...newFlag, key: e.target.value })}
                    className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono"
                    placeholder="feature.my-flag" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-2">Name</label>
                  <input type="text" value={newFlag.name} onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
                    className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                    placeholder="My Feature" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Description</label>
                <input type="text" value={newFlag.description} onChange={(e) => setNewFlag({ ...newFlag, description: e.target.value })}
                  className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
                  placeholder="Optional description" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-2">Rollout Percentage: {newFlag.rolloutPct}%</label>
                <input type="range" min="0" max="100" value={newFlag.rolloutPct} onChange={(e) => setNewFlag({ ...newFlag, rolloutPct: Number(e.target.value) })}
                  className="w-full accent-brand" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newFlag.enabled} onChange={(e) => setNewFlag({ ...newFlag, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-border-subtle accent-brand" />
                <span className="text-sm text-text-secondary">{a.enabled}</span>
              </label>
              <div className="border-t border-border-subtle pt-4 mt-2">
                <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted/60 mb-3">Targeting (optional)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Target Roles</label>
                    <input type="text" value={newFlag.targetRoles} onChange={(e) => setNewFlag({ ...newFlag, targetRoles: e.target.value })}
                      className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono"
                      placeholder="ADMIN, USER_PRO" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Target Plans</label>
                    <input type="text" value={newFlag.targetPlans} onChange={(e) => setNewFlag({ ...newFlag, targetPlans: e.target.value })}
                      className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono"
                      placeholder="pro, business" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1">Target Users</label>
                    <input type="text" value={newFlag.targetUsers} onChange={(e) => setNewFlag({ ...newFlag, targetUsers: e.target.value })}
                      className="w-full bg-surface border border-border-subtle rounded-xl text-text-primary text-sm py-2 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 font-mono"
                      placeholder="user-id-1, user-id-2" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/[0.02] border-t border-border-subtle flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer">{ui.cancel}</button>
              <button onClick={() => {
                const payload: any = {
                  ...newFlag,
                  description: newFlag.description || undefined,
                  targetRoles: newFlag.targetRoles ? newFlag.targetRoles.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
                  targetPlans: newFlag.targetPlans ? newFlag.targetPlans.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
                  targetUsers: newFlag.targetUsers ? newFlag.targetUsers.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
                };
                delete payload.targetRoles; delete payload.targetPlans; delete payload.targetUsers;
                createFlag.mutate({
                  key: newFlag.key,
                  name: newFlag.name,
                  description: newFlag.description || undefined,
                  enabled: newFlag.enabled,
                  rolloutPct: newFlag.rolloutPct,
                  ...(newFlag.targetRoles ? { targetRoles: newFlag.targetRoles.split(',').map((s: string) => s.trim()).filter(Boolean) } : {}),
                  ...(newFlag.targetPlans ? { targetPlans: newFlag.targetPlans.split(',').map((s: string) => s.trim()).filter(Boolean) } : {}),
                  ...(newFlag.targetUsers ? { targetUsers: newFlag.targetUsers.split(',').map((s: string) => s.trim()).filter(Boolean) } : {}),
                });
              }}
                disabled={createFlag.isPending || newFlag.key.length < 2 || newFlag.name.length < 2}
                className="px-6 py-2 text-sm font-medium text-white bg-brand rounded-xl hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer">{ui.create}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
