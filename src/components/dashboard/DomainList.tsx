'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import {
  Globe, Plus, ShieldCheck, Trash2, Settings2, X,
  Copy, Check, ChevronRight, AlertTriangle, Mail,
  Lock, FileText, Shield, Server, Loader2, Search,
} from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';

interface DomainListProps {
  dict: {
    domains: Record<string, string>;
    ui: Record<string, string>;
  };
}

/**
 * Get the app host from env. Falls back to window.location.host.
 */
function getAppHost(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL).host;
    } catch {
      return process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, '');
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.host;
  }
  return 'your-app.com';
}

// ─── DNS Record Card ───────────────────────────────────────────────
function DnsRecord({
  step,
  title,
  icon: Icon,
  type,
  name,
  value,
  accent,
  labels,
}: {
  step: number;
  title: string;
  icon: React.ElementType;
  type: string;
  name: string;
  value: string;
  accent: string;
  labels: { type: string; name: string; value: string; copy: string; copied: string };
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div className="group relative">
      {/* Subtle left accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-[2px] rounded-full ${accent} opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="pl-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className={`w-6 h-6 rounded-full ${accent.replace('bg-', 'bg-').replace(/\/\d+/, '/10')} flex items-center justify-center`}>
            <span className="text-[10px] font-black text-text-primary/80">{step}</span>
          </div>
          <Icon className="w-3.5 h-3.5 text-text-muted/70" />
          <span className="text-xs font-semibold text-text-secondary tracking-wide">{title}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr_1fr] gap-px bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.04]">
          {/* Type */}
          <div className="bg-white/[0.02] p-3 sm:border-r border-white/[0.04]">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted/40 block mb-1">{labels.type}</span>
            <span className="text-xs font-bold text-brand font-mono">{type}</span>
          </div>
          {/* Name */}
          <div className="bg-white/[0.02] p-3 sm:border-r border-white/[0.04] group/cell relative">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted/40 block mb-1">{labels.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-primary font-mono break-all flex-1">{name}</span>
              <button
                onClick={() => copy(name, `${step}-name`)}
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-white/[0.08] transition-all cursor-pointer"
                title={labels.copy}
              >
                {copied === `${step}-name`
                  ? <><Check className="w-3 h-3 text-emerald-400" /><span className="sr-only">{labels.copied}</span></>
                  : <Copy className="w-3 h-3 text-text-muted/50" />
                }
              </button>
            </div>
          </div>
          {/* Value */}
          <div className="bg-white/[0.02] p-3 group/cell relative">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted/40 block mb-1">{labels.value}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-primary font-mono break-all flex-1">{value}</span>
              <button
                onClick={() => copy(value, `${step}-value`)}
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover/cell:opacity-100 hover:bg-white/[0.08] transition-all cursor-pointer"
                title={labels.copy}
              >
                {copied === `${step}-value`
                  ? <><Check className="w-3 h-3 text-emerald-400" /><span className="sr-only">{labels.copied}</span></>
                  : <Copy className="w-3 h-3 text-text-muted/50" />
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DomainList({ dict }: DomainListProps) {
  const d = dict.domains;
  const ui = dict.ui;
  const toast = useToast();

  const [showAdd, setShowAdd] = useState(false);
  const [showRemove, setShowRemove] = useState<string | null>(null);
  const [showDnsFor, setShowDnsFor] = useState<string | null>(null);
  const [domainName, setDomainName] = useState('');
  const [dnsCheckResults, setDnsCheckResults] = useState<Record<string, any>>({});
  const [dnsCheckLoading, setDnsCheckLoading] = useState<Record<string, boolean>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const appHost = useMemo(() => getAppHost(), []);

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
    onSuccess: (result) => {
      if (result.verified) {
        toast.success(d.verifySuccess || 'Domain verified successfully');
      } else {
        toast.error(result.error || d.verifyFailed || 'Verification failed');
      }
      domains.refetch();
      setVerifyingId(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setVerifyingId(null);
    },
  });

  const trpcUtils = trpc.useUtils();

  const handleCheckDns = useCallback(async (domainId: string) => {
    setDnsCheckLoading((prev) => ({ ...prev, [domainId]: true }));
    try {
      const result = await trpcUtils.domain.checkDns.fetch({ domainId });
      setDnsCheckResults((prev) => ({ ...prev, [domainId]: result }));
    } catch {
      toast.error(d.dnsCheckError || 'Failed to check DNS');
    } finally {
      setDnsCheckLoading((prev) => ({ ...prev, [domainId]: false }));
    }
  }, [trpcUtils, toast, d]);

  const handleVerify = useCallback((domainId: string) => {
    setVerifyingId(domainId);
    verifyDomain.mutate({ domainId });
  }, [verifyDomain]);

  const deleteDomain = trpc.domain.delete.useMutation({
    onSuccess: () => {
      toast.success(d.removeSuccess);
      setShowRemove(null);
      domains.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const items = domains.data ?? [];

  const isVerified = (status: string) => status === 'VERIFIED' || status === 'ACTIVE';
  const isSuspended = (status: string) => status === 'SUSPENDED';

  return (
    <div>
      {/* Header */}
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

      {/* Domain List */}
      <div className="space-y-4 animate-fade-in-up delay-1">
        {domains.isLoading ? (
          <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl p-6">
            <SkeletonTable rows={3} />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-2xl overflow-hidden">
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
          </div>
        ) : (
          items.map((domain: any) => {
            const verified = isVerified(domain.status);
            const suspended = isSuspended(domain.status);
            const dnsOpen = showDnsFor === domain.id;
            const showDns = domain.verification && (!verified || dnsOpen);

            return (
              <div
                key={domain.id}
                className={`bg-white/[0.025] backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-300 ${
                  dnsOpen ? 'border-brand/30 shadow-lg shadow-brand/5' : 'border-border-subtle hover:border-border-subtle/80'
                }`}
              >
                {/* Domain Header Row */}
                <div className="p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        suspended
                          ? 'bg-gradient-to-br from-red-500/15 to-rose-500/15 border border-red-500/20'
                          : verified
                            ? 'bg-gradient-to-br from-emerald-500/15 to-teal-500/15 border border-emerald-500/20'
                            : 'bg-gradient-to-br from-amber-500/15 to-brand/15 border border-amber-500/20'
                      }`}>
                        {suspended
                          ? <ShieldCheck className="w-4.5 h-4.5 text-red-400" />
                          : verified
                            ? <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" />
                            : <Globe className="w-4.5 h-4.5 text-amber-400" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary font-mono truncate">{domain.name}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {suspended
                            ? `⛔ ${d.statusSuspended || 'Subscription expired'}`
                            : verified
                              ? `✓ ${d.statusVerified}`
                              : `⏳ ${d.statusPending}`
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge
                        status={suspended ? 'SUSPENDED' : verified ? 'VERIFIED' : 'PENDING_DNS'}
                        label={suspended ? (d.suspended || 'Suspended') : verified ? ui.verified : ui.pending}
                      />

                      {/* DNS Toggle */}
                      <button
                        onClick={() => setShowDnsFor(dnsOpen ? null : domain.id)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          dnsOpen
                            ? 'bg-brand text-white shadow-md shadow-brand/20'
                            : 'text-text-secondary bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.06]'
                        }`}
                      >
                        <Settings2 className="w-3 h-3" />
                        DNS
                        <ChevronRight className={`w-3 h-3 transition-transform ${dnsOpen ? 'rotate-90' : ''}`} />
                      </button>

                      {/* Check DNS */}
                      <button
                        onClick={() => handleCheckDns(domain.id)}
                        disabled={dnsCheckLoading[domain.id]}
                        className="px-3 py-1.5 text-[11px] font-bold text-sky-400 border border-sky-400/25 rounded-lg hover:bg-sky-400/8 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {dnsCheckLoading[domain.id]
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Search className="w-3 h-3" />
                        }
                        {d.checkDns || 'Check DNS'}
                      </button>

                      {/* Verify (unverified only) */}
                      {!verified && (
                        <button
                          onClick={() => handleVerify(domain.id)}
                          disabled={verifyingId === domain.id}
                          className="px-3 py-1.5 text-[11px] font-bold text-emerald-400 border border-emerald-400/25 rounded-lg hover:bg-emerald-400/8 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          {verifyingId === domain.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <ShieldCheck className="w-3 h-3" />
                          }
                          {d.verifyDns}
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setShowRemove(domain.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted/30 hover:text-danger hover:bg-danger/8 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* DNS Check Results */}
                {dnsCheckResults[domain.id] && (
                  <div className="border-t border-white/[0.04] px-5 py-3 bg-white/[0.015] animate-fade-in-up">
                    <div className="flex items-center gap-3 text-[11px] font-semibold flex-wrap">
                      <span className="text-text-muted">{d.dnsStatus || 'DNS Status'}:</span>
                      {/* Ownership */}
                      {(() => {
                        const own = dnsCheckResults[domain.id]?.ownership;
                        if (!own) return null;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            own.found
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {own.found ? '✓' : '✗'} {d.dnsOwnership || 'Ownership'}
                          </span>
                        );
                      })()}
                      {/* MX — show pointsToUs status */}
                      {(() => {
                        const mx = dnsCheckResults[domain.id]?.mx;
                        if (!mx) return null;
                        const ok = mx.found && mx.pointsToUs;
                        const partial = mx.found && !mx.pointsToUs;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : partial ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {ok ? '✓' : partial ? '⚠' : '✗'} MX
                            {partial && <span className="text-[9px] opacity-70 ml-0.5">({d.dnsNotPointingToUs || 'not pointing to us'})</span>}
                          </span>
                        );
                      })()}
                      {/* SPF — show includesUs status */}
                      {(() => {
                        const spf = dnsCheckResults[domain.id]?.spf;
                        if (!spf) return null;
                        const ok = spf.found && spf.includesUs;
                        const partial = spf.found && !spf.includesUs;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : partial ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {ok ? '✓' : partial ? '⚠' : '✗'} SPF
                            {partial && <span className="text-[9px] opacity-70 ml-0.5">({d.dnsNotIncludingUs || 'missing include'})</span>}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* DNS Setup Panel */}
                {showDns && (
                  <div className="border-t border-white/[0.04] animate-fade-in-up">
                    {/* Header */}
                    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                          <Server className="w-4 h-4 text-brand" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{d.dnsConfig}</h4>
                          <p className="text-[10px] text-text-muted mt-0.5">{d.dnsConfigDesc}</p>
                        </div>
                      </div>
                      {dnsOpen && (
                        <button
                          onClick={() => setShowDnsFor(null)}
                          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-white/[0.05] rounded-lg cursor-pointer transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Propagation Tip */}
                    {!verified && (
                      <div className="mx-5 mb-4 px-4 py-2.5 bg-amber-500/[0.06] border border-amber-500/15 rounded-xl flex items-start gap-2.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-amber-200/80 leading-relaxed">
                          {d.dnsTip} <strong>{d.dnsVerifyBtn}</strong>.
                        </p>
                      </div>
                    )}

                    {/* DNS Records */}
                    <div className="px-5 pb-5 space-y-5">
                      {(() => {
                        const dnsLabels = { type: d.dnsType, name: d.dnsHost, value: d.dnsValue, copy: d.dnsCopy, copied: d.dnsCopied };
                        return (
                          <>
                            <DnsRecord
                              step={1}
                              title={d.dnsOwnership}
                              icon={FileText}
                              type={domain.verification.recordType}
                              name={domain.verification.recordName}
                              value={domain.verification.recordValue}
                              accent="bg-brand"
                              labels={dnsLabels}
                            />
                            <DnsRecord
                              step={2}
                              title={d.dnsEmailRouting}
                              icon={Mail}
                              type="MX"
                              name="@"
                              value={`mx.${appHost} (Priority 10)`}
                              accent="bg-teal-500"
                              labels={dnsLabels}
                            />
                            <DnsRecord
                              step={3}
                              title={d.dnsSPF}
                              icon={Shield}
                              type="TXT"
                              name="@"
                              value={`v=spf1 include:_spf.${appHost} ~all`}
                              accent="bg-sky-500"
                              labels={dnsLabels}
                            />
                            <DnsRecord
                              step={4}
                              title={d.dnsDMARC}
                              icon={Lock}
                              type="TXT"
                              name="_dmarc"
                              value="v=DMARC1; p=none;"
                              accent="bg-violet-500"
                              labels={dnsLabels}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={d.addTitle}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.domainName}</label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />
              <input
                type="text"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                className="w-full bg-white/[0.03] border border-border-subtle rounded-xl text-text-primary text-sm py-3 pl-10 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all placeholder:text-text-muted/50 font-mono"
                placeholder={d.domainPlaceholder}
              />
            </div>
            <p className="text-[10px] text-text-muted/60 mt-1.5 ml-1">
              {d.addHint}
            </p>
          </div>
          <button
            onClick={() => createDomain.mutate({ name: domainName } as any)}
            disabled={createDomain.isPending || !domainName}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {createDomain.isPending ? ui.loading : d.add}
          </button>
        </div>
      </Modal>

      {/* Remove Confirm */}
      <ConfirmModal
        open={!!showRemove}
        onClose={() => setShowRemove(null)}
        onConfirm={() => { if (showRemove) deleteDomain.mutate({ domainId: showRemove }); }}
        title={d.removeTitle}
        message={d.removeMessage}
        confirmLabel={d.remove}
        cancelLabel={ui.cancel}
        variant="danger"
      />
    </div>
  );
}
