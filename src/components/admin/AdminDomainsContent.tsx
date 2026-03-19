'use client';

import { trpc } from '@/lib/trpc';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { Globe, Search, Trash2, ShieldCheck, Settings, Timer, Copy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { formatDate } from '@/lib/dayjs';

interface AdminDomainsProps {
  dict: { admin: Record<string, string>; ui: Record<string, string> };
}

export function AdminDomainsContent({ dict }: AdminDomainsProps) {
  const a = dict.admin;
  const ui = dict.ui;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const debouncedSearch = useDebounce(search, 500);

  const domains = trpc.admin.domain.list.useQuery({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    status: statusFilter as any,
  });

  const utils = trpc.useUtils();
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();

  // ─── Cron Settings State ─────────────────────────────────────────
  const cronQuery = trpc.admin.domain.cronSettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [cronForm, setCronForm] = useState({
    enabled: true,
    batchSize: 5,
    recheckHours: 24,
    failureThreshold: 2,
  });

  // Sync form with query data
  useEffect(() => {
    if (cronQuery.data) {
      setCronForm({
        enabled: cronQuery.data.enabled,
        batchSize: cronQuery.data.batchSize,
        recheckHours: cronQuery.data.recheckHours,
        failureThreshold: cronQuery.data.failureThreshold,
      });
    }
  }, [cronQuery.data]);

  const updateCronSettings = trpc.admin.domain.updateCronSettings.useMutation({
    onSuccess: () => {
      toast.success(a.domainsCronSaved);
      cronQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // ─── Domain Mutations ────────────────────────────────────────────
  const createDomain = trpc.admin.domain.create.useMutation({
    onSuccess: () => {
      toast.success(a.domainsAddSuccess);
      setShowAdd(false);
      setNewDomain('');
      utils.admin.domain.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteDomain = trpc.admin.domain.delete.useMutation({
    onSuccess: () => {
      toast.success(a.domainsDeleteSuccess);
      setShowDelete(null);
      utils.admin.domain.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncDomains = trpc.admin.domain.sync.useMutation({
    onSuccess: (data) => {
      setIsSyncing(false);
      toast.success(a.domainsSynced.replace('{count}', String(data.added)));
      utils.admin.domain.list.invalidate();
    },
    onError: (err) => {
      setIsSyncing(false);
      toast.error(err.message);
    },
  });

  const items = domains.data?.data ?? [];

  // ─── Helper: number input ────────────────────────────────────────
  const NumberField = ({ label, desc, value, min, max, onChange }: {
    label: string; desc: string; value: number; min: number; max: number;
    onChange: (v: number) => void;
  }) => (
    <div>
      <label className="text-xs font-semibold text-text-secondary block mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-2.5 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <p className="text-[10px] text-text-muted mt-1">{desc}</p>
    </div>
  );

  // ─── Helper: copy row ─────────────────────────────────────────────
  const CopyRow = ({ label, value, copiedText }: { label: string; value: string; copiedText: string }) => {
    const [copied, setCopied] = useState(false);
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-text-muted w-16 shrink-0">{label}</span>
        <code className="flex-1 text-[11px] text-text-secondary bg-white/[0.03] border border-border-subtle rounded-lg px-3 py-1.5 font-mono truncate">
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/50 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer shrink-0"
          title={copiedText}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{a.domains}</h1>
          <p className="text-sm text-text-muted">{a.domainsSubtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsSyncing(true);
              syncDomains.mutate();
            }}
            disabled={isSyncing || syncDomains.isPending}
            className="px-4 py-2 text-sm font-bold text-text-primary bg-white/[0.05] border border-border-subtle rounded-xl hover:bg-white/[0.1] transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSyncing || syncDomains.isPending ? a.domainsSyncing : a.domainsSyncBtn}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all cursor-pointer"
          >
            {a.domainsAddBtn}
          </button>
        </div>
      </div>

      {/* ─── Cron Settings Card ─────────────────────────────────── */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-5 mb-6 animate-fade-in-up delay-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Timer className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">{a.domainsCronTitle}</h2>
            <p className="text-[11px] text-text-muted">{a.domainsCronSubtitle}</p>
          </div>
        </div>

        {cronQuery.isLoading ? (
          <div className="text-xs text-text-muted animate-pulse py-4">Loading settings...</div>
        ) : (
          <div className="space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-text-secondary">{a.domainsCronEnabled}</p>
                <p className="text-[10px] text-text-muted">{a.domainsCronEnabledDesc}</p>
              </div>
              <button
                onClick={() => setCronForm((f) => ({ ...f, enabled: !f.enabled }))}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  cronForm.enabled ? 'bg-brand' : 'bg-white/[0.1]'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${
                    cronForm.enabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {/* Number inputs — 3 column grid */}
            <div className="grid grid-cols-3 gap-4">
              <NumberField
                label={a.domainsCronBatchSize}
                desc={a.domainsCronBatchSizeDesc}
                value={cronForm.batchSize}
                min={1}
                max={50}
                onChange={(v) => setCronForm((f) => ({ ...f, batchSize: v }))}
              />
              <NumberField
                label={a.domainsCronRecheckHours}
                desc={a.domainsCronRecheckHoursDesc}
                value={cronForm.recheckHours}
                min={1}
                max={168}
                onChange={(v) => setCronForm((f) => ({ ...f, recheckHours: v }))}
              />
              <NumberField
                label={a.domainsCronFailureThreshold}
                desc={a.domainsCronFailureThresholdDesc}
                value={cronForm.failureThreshold}
                min={1}
                max={10}
                onChange={(v) => setCronForm((f) => ({ ...f, failureThreshold: v }))}
              />
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => updateCronSettings.mutate(cronForm)}
                disabled={updateCronSettings.isPending}
                className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <Settings className="w-3.5 h-3.5" />
                {updateCronSettings.isPending ? a.domainsCronSaving : a.domainsCronSave}
              </button>
            </div>

            {/* ─── External Cron Endpoint Info ─────────────────────── */}
            <div className="mt-2 pt-4 border-t border-white/[0.06]">
              <p className="text-xs font-semibold text-text-secondary mb-1">{a.domainsCronEndpointTitle}</p>
              <p className="text-[10px] text-text-muted mb-3">{a.domainsCronEndpointDesc}</p>
              <div className="space-y-2">
                <CopyRow label={a.domainsCronEndpointMethod} value="GET" copiedText={a.domainsCronCopied} />
                <CopyRow label={a.domainsCronEndpointUrl} value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/cron/domain-recheck`} copiedText={a.domainsCronCopied} />
                <CopyRow label={a.domainsCronEndpointHeader} value="Authorization: Bearer <CRON_SECRET>" copiedText={a.domainsCronCopied} />
              </div>
              <p className="text-[10px] text-amber-400/80 mt-2">⚠ {a.domainsCronEndpointNote}</p>
            </div>
          </div>
        )}
      </div>


      {/* ─── Search + Filter ────────────────────────────────────── */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-4 mb-6 animate-fade-in-up delay-2">
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
            <option value="VERIFIED">{ui.verified}</option>
            <option value="PENDING">{ui.pending}</option>
            <option value="ACTIVE">{ui.active}</option>
            <option value="SUSPENDED">{ui.suspended}</option>
            <option value="ARCHIVED">{a.domainsArchived}</option>
          </select>
        </div>
      </div>

      {/* ─── Domain Table ───────────────────────────────────────── */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden animate-fade-in-up delay-3">
        {domains.isLoading ? (
          <div className="p-6"><SkeletonTable rows={10} /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Globe className="w-6 h-6" />} title={ui.noResults} description="" />
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-x-auto">
            <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-4 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted/60">
              <span>{a.domainsColDomain}</span>
              <span>{a.owner}</span>
              <span>{a.domainsColMailboxes}</span>
              <span>{ui.status}</span>
              <span></span>
            </div>
            {items.map((item: any) => (
              <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-all items-center group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.isSystem ? 'bg-indigo-500/10' : 'bg-brand/10'}`}>
                    {item.isSystem ? <ShieldCheck className="w-4 h-4 text-indigo-400" /> : <Globe className="w-4 h-4 text-brand" />}
                  </div>
                  <div className="min-w-0 flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary font-mono truncate">{item.name}</p>
                    {item.isSystem && (
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-[9px] font-bold uppercase tracking-wider text-indigo-400 border border-indigo-400/20">{a.domainsColSystem}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-text-secondary truncate">{item.user?.email ?? a.domainsColSystem}</span>
                <span className="text-xs text-text-muted font-mono">{item.mailboxCount}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setShowDelete(item.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted/40 hover:text-danger hover:bg-danger/8 transition-all cursor-pointer"
                    title={ui.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(domains.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          <span className="text-xs text-text-muted">{ui.page} {page} {ui.of} {domains.data?.totalPages ?? 1}</span>
          <button disabled={page >= (domains.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
        </div>
      )}

      {/* Add Domain Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={a.domainsAddTitle}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{a.domainsDomainName}</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 px-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50"
              placeholder={a.domainsAddPlaceholder}
            />
            <p className="text-[10px] text-text-muted mt-1.5">
              {a.domainsAddHint}
            </p>
          </div>
          
          {createDomain.error && (
            <div className="p-3 bg-danger/10 text-danger text-xs rounded-xl border border-danger/20">
              {createDomain.error.message}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => createDomain.mutate({ name: newDomain })}
              disabled={createDomain.isPending || !newDomain.trim()}
              className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {createDomain.isPending ? a.domainsAdding : a.domainsAddBtn}
            </button>
          </div>
        </div>
      </Modal>
      {/* Delete Confirm */}
      <ConfirmModal
        open={!!showDelete}
        onClose={() => setShowDelete(null)}
        onConfirm={async () => { if (showDelete) await deleteDomain.mutateAsync({ id: showDelete }); }}
        title={a.domainsDeleteTitle}
        message={a.domainsDeleteMessage}
        confirmLabel={ui.delete}
        cancelLabel={ui.cancel}
        variant="danger"
      />
    </div>
  );
}
