'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Mail, Search, ShieldBan, Clock, RotateCcw, MoreVertical, Eye, ArrowLeft, Inbox, User, Calendar } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { formatDate } from '@/lib/dayjs';
import { useDebounce } from '@/hooks/useDebounce';

interface AdminMailboxesProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

type ActionType = 'quarantine' | 'forceExpire' | 'restore';

interface SelectedMailbox {
  id: string;
  address: string;
}

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

  // ─── Messages Viewer (inline, temp-mail.org style) ───
  const [selectedMailbox, setSelectedMailbox] = useState<SelectedMailbox | null>(null);
  const [msgPage, setMsgPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);

  const messagesQuery = trpc.admin.mailbox.listMessages.useQuery(
    { mailboxId: selectedMailbox?.id ?? '', page: msgPage, pageSize: 20 },
    { enabled: !!selectedMailbox },
  );

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

  // ─── If a mailbox is selected, show the messages viewer (inline, like temp-mail.org) ───
  if (selectedMailbox) {
    const msgs = messagesQuery.data?.data ?? [];

    return (
      <div>
        {/* ── Back + Mailbox Header ── */}
        <div className="mb-6 animate-fade-in-up">
          <button
            onClick={() => { setSelectedMailbox(null); setSelectedMessage(null); }}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-brand transition-colors mb-4 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            {a.mailboxes}
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Inbox className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-text-primary">{selectedMailbox.address}</h1>
              <p className="text-xs text-text-muted">
                {messagesQuery.data ? `${messagesQuery.data.total} message(s)` : a.messagesTitle?.replace('{address}', '') ?? ''}
              </p>
            </div>
          </div>
        </div>

        {/* ── Message Detail View (when a message is selected) ── */}
        {selectedMessage ? (
          <div className="animate-fade-in-up">
            <button
              onClick={() => setSelectedMessage(null)}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-brand transition-colors mb-4 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {a.viewMessages}
            </button>

            <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
              {/* Email Header Section */}
              <div className="px-6 py-5 border-b border-white/[0.04]">
                <h2 className="text-lg font-bold text-text-primary mb-3">{selectedMessage.subject}</h2>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-3.5 h-3.5 text-text-muted/50" />
                    <span className="text-text-muted">{a.from}:</span>
                    <span className="text-text-primary font-medium">{selectedMessage.from}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-text-muted/50" />
                    <span className="text-text-muted">{a.receivedAt}:</span>
                    <span className="text-text-secondary">{formatDate(selectedMessage.receivedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Email Body */}
              <div className="px-6 py-5">
                <pre className="text-sm text-text-secondary whitespace-pre-wrap break-words font-sans leading-relaxed">
                  {selectedMessage.bodyText || '(empty)'}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          /* ── Inbox List (temp-mail.org style) ── */
          <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-1">
            {messagesQuery.isLoading ? (
              <div className="p-6"><SkeletonTable rows={6} /></div>
            ) : msgs.length === 0 ? (
              <EmptyState icon={<Mail className="w-6 h-6" />} title={a.noMessages ?? 'No messages'} description="" />
            ) : (
              <div className="divide-y divide-white/[0.04] overflow-x-auto">
                {/* Table Header */}
                <div className="grid grid-cols-[auto_2fr_3fr_1fr] gap-4 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
                  <span className="w-2"></span>
                  <span>{a.from}</span>
                  <span>{a.subject}</span>
                  <span className="text-right">{a.receivedAt}</span>
                </div>

                {/* Message Rows */}
                {msgs.map((msg: any) => (
                  <button
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className={`w-full grid grid-cols-[auto_2fr_3fr_1fr] gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-all cursor-pointer text-left group ${!msg.isRead ? 'bg-brand/[0.03]' : ''}`}
                  >
                    {/* Unread indicator */}
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full ${msg.isRead ? 'bg-transparent' : 'bg-brand'}`} />
                    </div>

                    {/* From */}
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${!msg.isRead ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                        {msg.from}
                      </p>
                    </div>

                    {/* Subject */}
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${!msg.isRead ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                        {msg.subject}
                      </p>
                    </div>

                    {/* Date */}
                    <div className="text-right">
                      <span className="text-[11px] text-text-muted">{formatDate(msg.receivedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Pagination */}
            {(messagesQuery.data?.total ?? 0) > 20 && (
              <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-white/[0.04]">
                <button disabled={msgPage <= 1} onClick={() => setMsgPage((p) => p - 1)}
                  className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
                <span className="text-xs text-text-muted">{ui.page} {msgPage} {ui.of} {messagesQuery.data?.totalPages ?? 1}</span>
                <button disabled={msgPage >= (messagesQuery.data?.totalPages ?? 1)} onClick={() => setMsgPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Normal Mailbox List View ───
  return (
    <div>
      <div className="mb-8 animate-fade-in-up">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.mailboxes}</h1>
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
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
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
                      {/* View Messages */}
                      <button onClick={() => { setSelectedMailbox({ id: mb.id, address: mb.address }); setMsgPage(1); setSelectedMessage(null); setOpenMenu(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-white/[0.04] hover:text-brand transition-all cursor-pointer">
                        <Eye className="w-3.5 h-3.5" />{a.viewMessages}
                      </button>
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
