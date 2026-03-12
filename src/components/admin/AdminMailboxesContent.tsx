'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Mail, Search, ShieldBan, Clock, RotateCcw, MoreVertical } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/dayjs';
import { useDebounce } from '@/hooks/useDebounce';

interface AdminMailboxesProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

type ActionType = 'quarantine' | 'forceExpire' | 'restore';

export function AdminMailboxesContent({ dict }: AdminMailboxesProps) {
  const a = dict.admin;
  const ui = dict.ui;
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebounce(search, 500);

  const mailboxes = trpc.admin.mailbox.list.useQuery({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    status: statusFilter as any,
  });

  // ─── Mutations ───
  const quarantine = trpc.admin.mailbox.quarantine.useMutation({
    onSuccess: () => { toast.success(a.quarantine); setConfirmAction(null); mailboxes.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const forceExpire = trpc.admin.mailbox.forceExpire.useMutation({
    onSuccess: () => { toast.success(a.forceExpire); setConfirmAction(null); mailboxes.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const restore = trpc.admin.mailbox.restore.useMutation({
    onSuccess: () => { toast.success(a.restore); setConfirmAction(null); mailboxes.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const [confirmAction, setConfirmAction] = useState<{ id: string; action: ActionType } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = mailboxes.data?.data ?? [];

  const getConfirmProps = () => {
    if (!confirmAction) return { title: '', message: '', variant: 'warning' as const };
    const map: Record<ActionType, { title: string; message: string; variant: 'warning' | 'danger' }> = {
      quarantine: { title: a.quarantineTitle, message: a.quarantineMessage, variant: 'warning' },
      forceExpire: { title: a.forceExpireTitle, message: a.forceExpireMessage, variant: 'danger' },
      restore: { title: a.restoreTitle, message: a.restoreMessage, variant: 'warning' },
    };
    return map[confirmAction.action];
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const reason = `Admin ${confirmAction.action} from mailbox management`;
    if (confirmAction.action === 'quarantine') await quarantine.mutateAsync({ mailboxId: confirmAction.id, reason });
    else if (confirmAction.action === 'forceExpire') await forceExpire.mutateAsync({ mailboxId: confirmAction.id, reason });
    else if (confirmAction.action === 'restore') await restore.mutateAsync({ mailboxId: confirmAction.id, reason });
  };

  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.mailboxes}</h1>
        <p className="text-sm text-text-muted">{a.mailboxesSubtitle}</p>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-1">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
            <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
              placeholder={ui.searchPlaceholder} />
          </div>
          <select value={statusFilter ?? ''} onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
            className="bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 transition-all">
            <option value="">{ui.all}</option>
            <option value="ACTIVE">{ui.active}</option>
            <option value="EXPIRED">{ui.expired}</option>
            <option value="QUARANTINED">Quarantined</option>
            <option value="DELETED">Deleted</option>
            <option value="SUSPENDED">{ui.suspended}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        {mailboxes.isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Mail className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>Address</span>
              <span>{a.owner}</span>
              <span>Messages</span>
              <span>Status</span>
              <span>Created</span>
              <span>Actions</span>
            </div>
            {items.map((mb: any) => (
              <div key={mb.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-brand" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary font-mono truncate">{mb.address}</p>
                    {mb.domain && <p className="text-[10px] text-text-muted truncate">{mb.domain}</p>}
                  </div>
                </div>
                <span className="text-xs text-text-secondary truncate">{mb.user?.email ?? '—'}</span>
                <span className="text-xs text-text-muted font-mono">{mb.messageCount}</span>
                <StatusBadge status={mb.status} />
                <span className="text-[10px] text-text-muted">{formatDate(mb.createdAt)}</span>
                <div className="relative" ref={openMenu === mb.id ? menuRef : undefined}>
                  <button onClick={() => setOpenMenu(openMenu === mb.id ? null : mb.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-text-primary hover:bg-white/[0.06] transition-all cursor-pointer">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenu === mb.id && (
                    <div className="absolute right-0 top-8 z-20 bg-bg-card border border-border-subtle rounded-xl shadow-2xl py-1 w-44 animate-fade-in">
                      {mb.status === 'ACTIVE' && (
                        <>
                          <button onClick={() => { setConfirmAction({ id: mb.id, action: 'quarantine' }); setOpenMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-warning transition-all cursor-pointer">
                            <ShieldBan className="w-3.5 h-3.5" />{a.quarantine}
                          </button>
                          <button onClick={() => { setConfirmAction({ id: mb.id, action: 'forceExpire' }); setOpenMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-danger transition-all cursor-pointer">
                            <Clock className="w-3.5 h-3.5" />{a.forceExpire}
                          </button>
                        </>
                      )}
                      {(mb.status === 'QUARANTINED' || mb.status === 'EXPIRED') && (
                        <button onClick={() => { setConfirmAction({ id: mb.id, action: 'restore' }); setOpenMenu(null); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-success transition-all cursor-pointer">
                          <RotateCcw className="w-3.5 h-3.5" />{a.restore}
                        </button>
                      )}
                      {mb.status !== 'ACTIVE' && mb.status !== 'QUARANTINED' && mb.status !== 'EXPIRED' && (
                        <p className="text-[10px] text-text-muted px-3 py-2">No actions available</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(mailboxes.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {mailboxes.data?.totalPages ?? 1}</span>
          <button disabled={page >= (mailboxes.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Confirm Action Modal */}
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={getConfirmProps().title}
        message={getConfirmProps().message}
        confirmLabel={confirmAction ? a[confirmAction.action] : ''}
        cancelLabel={ui.cancel}
        variant={getConfirmProps().variant}
      />
    </div>
  );
}
