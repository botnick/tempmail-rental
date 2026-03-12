'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Mail, Plus, Clock, Trash2, Timer, Search } from 'lucide-react';
import { useState } from 'react';

interface MailboxListProps {
  dict: {
    mailboxes: Record<string, string>;
    ui: Record<string, string>;
  };
}

export function MailboxList({ dict }: MailboxListProps) {
  const d = dict.mailboxes;
  const ui = dict.ui;
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [showExtend, setShowExtend] = useState<string | null>(null);
  const [createUsername, setCreateUsername] = useState('');
  const [extendHours, setExtendHours] = useState(24);

  const mailboxes = trpc.mailbox.list.useQuery({ page, pageSize: 20 });

  const createMailbox = trpc.mailbox.create.useMutation({
    onSuccess: () => {
      toast.success(d.createSuccess);
      setShowCreate(false);
      setCreateUsername('');
      mailboxes.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMailbox = trpc.mailbox.delete.useMutation({
    onSuccess: () => {
      toast.success(d.deleteSuccess);
      setShowDelete(null);
      mailboxes.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const extendTTL = trpc.mailbox.extendTTL.useMutation({
    onSuccess: () => {
      toast.success(d.extendSuccess);
      setShowExtend(null);
      mailboxes.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const items = mailboxes.data?.data ?? [];
  const filtered = search ? items.filter((m: any) => m.address?.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{d.title}</h1>
          <p className="text-sm text-text-muted">{d.subtitle}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all duration-300 flex items-center gap-2 cursor-pointer"
          id="create-mailbox-btn"
        >
          <Plus className="w-4 h-4" />
          {d.create}
        </button>
      </div>

      {/* Search */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-1">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 pl-9 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
            placeholder={ui.searchPlaceholder}
            id="mailbox-search"
          />
        </div>
      </div>

      {/* List */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-2">
        {mailboxes.isLoading ? (
          <div className="p-6"><SkeletonTable rows={5} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Mail className="w-6 h-6" />}
            title={d.emptyTitle}
            description={d.emptyDesc}
            action={
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {d.create}
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((mb: any) => (
              <div key={mb.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand/10 shrink-0">
                    <Mail className="w-4 h-4 text-brand" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors font-mono truncate">{mb.address}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] text-text-muted">{mb.messageCount ?? 0} {d.messagesCount}</span>
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {mb.expiresAt ? new Date(mb.expiresAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <StatusBadge status={mb.status} />
                  <button
                    onClick={() => setShowExtend(mb.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-brand hover:bg-brand/8 transition-all cursor-pointer"
                    title={d.extendTtl}
                  >
                    <Timer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDelete(mb.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-danger hover:bg-danger/8 transition-all cursor-pointer"
                    title={ui.delete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
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
          <span className="text-xs text-text-muted">{ui.page} {page}</span>
          <button disabled={filtered.length < 20} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={d.createTitle}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.username}</label>
            <input
              type="text"
              value={createUsername}
              onChange={(e) => setCreateUsername(e.target.value)}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
              placeholder={d.usernamePlaceholder}
            />
          </div>
          <button
            onClick={() => createMailbox.mutate({ username: createUsername || undefined } as any)}
            disabled={createMailbox.isPending}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {createMailbox.isPending ? ui.loading : d.create}
          </button>
        </div>
      </Modal>

      {/* Extend Modal */}
      <Modal open={!!showExtend} onClose={() => setShowExtend(null)} title={d.extendTitle}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.extendHours}</label>
            <input
              type="number"
              value={extendHours}
              onChange={(e) => setExtendHours(Number(e.target.value))}
              min={1}
              max={720}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all"
            />
          </div>
          <button
            onClick={() => showExtend && extendTTL.mutate({ mailboxId: showExtend, hours: extendHours })}
            disabled={extendTTL.isPending}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {extendTTL.isPending ? ui.loading : d.extendTtl}
          </button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!showDelete}
        onClose={() => setShowDelete(null)}
        onConfirm={async () => { if (showDelete) await deleteMailbox.mutateAsync({ mailboxId: showDelete }); }}
        title={d.deleteTitle}
        message={d.deleteMessage}
        confirmLabel={ui.delete}
        cancelLabel={ui.cancel}
        variant="danger"
      />
    </div>
  );
}
