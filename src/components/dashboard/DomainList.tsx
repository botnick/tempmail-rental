'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Globe, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface DomainListProps {
  dict: {
    domains: Record<string, string>;
    ui: Record<string, string>;
  };
}

export function DomainList({ dict }: DomainListProps) {
  const d = dict.domains;
  const ui = dict.ui;
  const toast = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [showRemove, setShowRemove] = useState<string | null>(null);
  const [domainName, setDomainName] = useState('');

  const domains = trpc.domain.list.useQuery();

  const createDomain = trpc.domain.create.useMutation({
    onSuccess: () => {
      toast.success(d.addSuccess);
      setShowAdd(false);
      setDomainName('');
      domains.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const verifyDomain = trpc.domain.verify.useMutation({
    onSuccess: () => {
      toast.success(d.verifySuccess);
      domains.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const items = domains.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{d.title}</h1>
          <p className="text-sm text-text-muted">{d.subtitle}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all duration-300 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {d.add}
        </button>
      </div>

      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-1">
        {domains.isLoading ? (
          <div className="p-6"><SkeletonTable rows={3} /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Globe className="w-6 h-6" />}
            title={d.emptyTitle}
            description={d.emptyDesc}
            action={
              <button onClick={() => setShowAdd(true)} className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all flex items-center gap-2 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />{d.add}
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((domain: any) => (
              <div key={domain.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-brand/10">
                    <Globe className="w-4 h-4 text-brand" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary font-mono">{domain.name}</p>
                    <p className="text-[10px] text-text-muted">{d.dnsStatus}: {domain.dnsVerified ? ui.verified : ui.pending}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={domain.dnsVerified ? 'VERIFIED' : 'PENDING_DNS'} label={domain.dnsVerified ? ui.verified : ui.pending} />
                  {!domain.dnsVerified && (
                    <button
                      onClick={() => verifyDomain.mutate({ domainId: domain.id })}
                      disabled={verifyDomain.isPending}
                      className="px-3 py-1.5 text-[11px] font-bold text-brand border border-brand/25 rounded-lg hover:bg-brand/8 transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldCheck className="w-3 h-3" />{d.verifyDns}
                    </button>
                  )}
                  <button
                    onClick={() => setShowRemove(domain.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-danger hover:bg-danger/8 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={d.addTitle}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.domainName}</label>
            <input
              type="text"
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
              placeholder={d.domainPlaceholder}
            />
          </div>
          <button
            onClick={() => createDomain.mutate({ name: domainName } as any)}
            disabled={createDomain.isPending || !domainName}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {createDomain.isPending ? ui.loading : d.add}
          </button>
        </div>
      </Modal>

      {/* Remove Confirm */}
      <ConfirmModal
        open={!!showRemove}
        onClose={() => setShowRemove(null)}
        onConfirm={() => { setShowRemove(null); toast.info(d.removeSuccess); domains.refetch(); }}
        title={d.removeTitle}
        message={d.removeMessage}
        confirmLabel={d.remove}
        cancelLabel={ui.cancel}
        variant="danger"
      />
    </div>
  );
}
