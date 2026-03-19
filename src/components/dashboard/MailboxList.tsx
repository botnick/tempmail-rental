'use client';

import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/Toast';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Clock, Copy, Download, Globe, Link as LinkIcon, Mail, MailOpen, MoreVertical, Plus, RefreshCw, Search, ShieldCheck, Timer, Trash2, Paperclip, ExternalLink, Code, FileText, Inbox } from 'lucide-react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { formatDate } from '@/lib/dayjs';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { decodeMIME, looksLikeHtml, tryDecodeBase64 } from '@/utils/emailHelpers';

dayjs.extend(relativeTime);

interface MailboxListProps {
  dict: {
    mailboxes: Record<string, string>;
    ui: Record<string, string>;
    tooltips: Record<string, string>;
  };
}

// looksLikeHtml, tryDecodeBase64, decodeMIME imported from @/utils/emailHelpers

// ─── Attachment Download Button ─────────────────────────────────────
function AttachmentButton({ att, mailboxPublicId }: { att: any; mailboxPublicId: string }) {
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

  const handleDownload = async () => {
    setLoading(true);
    try {
      const result = await utils.tempmail.getAttachmentUrl.fetch({ attachmentId: att.id, mailboxPublicId });
      window.open(result.downloadUrl, '_blank');
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const sizeLabel = att.sizeBytes > 1024 * 1024
    ? `${(att.sizeBytes / (1024 * 1024)).toFixed(1)}MB`
    : att.sizeBytes ? `${(att.sizeBytes / 1024).toFixed(0)}KB` : '';

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleDownload(); }}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[10px] text-text-secondary hover:bg-white/[0.08] hover:border-brand/20 transition-all cursor-pointer disabled:opacity-50"
    >
      <Paperclip className="w-2.5 h-2.5" />
      {att.filename}
      {sizeLabel && <span className="text-text-muted/50 ml-0.5">({sizeLabel})</span>}
    </button>
  );
}

// ─── Inline Message Row ──────────────────────────────────────────────
function MessageRow({
  msg,
  mailboxPublicId,
  dict,
  locale,
}: {
  msg: any;
  mailboxPublicId: string;
  dict: Record<string, string>;
  locale: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');

  // Fetch full message detail when expanded
  const msgDetail = trpc.tempmail.getMessage.useQuery(
    { messageId: msg.id, mailboxPublicId },
    { enabled: expanded, staleTime: 60_000 }
  );

  const detail = msgDetail.data;
  const rawHtml = tryDecodeBase64(detail?.htmlBody || msg.bodyHtml || '');
  const rawText = tryDecodeBase64(detail?.textBody || msg.bodyText || '');
  // Auto-detect HTML in textBody (some APIs put HTML in textBody)
  const htmlContent = rawHtml || (looksLikeHtml(rawText) ? rawText : '');
  const textContent = rawHtml ? rawText : (looksLikeHtml(rawText) ? '' : rawText);
  const hasHtml = !!htmlContent;
  const hasText = !!textContent;
  const attachments = detail?.attachments ?? msg.attachments ?? [];

  return (
    <div className="border-b border-white/[0.03] last:border-b-0">
      {/* Message summary row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 sm:gap-3 py-3 px-3 sm:px-4 hover:bg-white/[0.02] transition-all text-left cursor-pointer group"
      >
        <span className="text-text-muted/40 shrink-0 transition-transform duration-200" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>
          <ChevronRight className="w-3.5 h-3.5" />
        </span>

        {/* Sender — hidden on very small screens */}
        <span className="hidden sm:inline text-xs text-text-secondary truncate min-w-0 w-32 shrink-0 font-medium" title={decodeMIME(msg.from || '')}>
          {decodeMIME(msg.from?.replace(/<.*>/, '').trim() || msg.from || '')}
        </span>

        {/* Subject */}
        <span className="flex-1 text-xs text-text-primary truncate min-w-0">
          {decodeMIME(msg.subject) || dict.noSubject}
        </span>

        {/* Attachments indicator */}
        {(attachments.length > 0 || msg.attachments?.length > 0) && (
          <Paperclip className="w-3 h-3 text-text-muted/40 shrink-0" />
        )}

        {/* Time */}
        <span className="text-[10px] text-text-muted/60 shrink-0 tabular-nums">
          {dayjs(msg.receivedAt).fromNow(true)}
        </span>
      </button>

      {/* Message body */}
      {expanded && (
        <div className="bg-white/[0.015] border-t border-white/[0.04] animate-fade-in-up">
          {/* Header bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-white/[0.04]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[11px] text-text-muted overflow-hidden">
              <span className="truncate"><span className="text-text-muted/50">{dict.from}:</span> {decodeMIME(msg.from || '')}</span>
              <span className="truncate"><span className="text-text-muted/50">{dict.receivedAt}:</span> {new Date(msg.receivedAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Open full page link */}
              <Link
                href={`/${locale}/dashboard/mail/${msg.id}?mb=${mailboxPublicId}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-2.5 py-1 text-[10px] text-text-muted hover:text-brand bg-white/[0.04] hover:bg-brand/10 rounded-lg transition-all"
              >
                <ExternalLink className="w-3 h-3" />{dict.viewFull}
              </Link>
              {/* View mode toggle */}
              {hasHtml && hasText && (
                <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewMode('html'); }}
                    className={`px-2 py-0.5 text-[10px] rounded-md transition-all cursor-pointer ${viewMode === 'html' ? 'bg-brand/20 text-brand font-semibold' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    <Code className="w-3 h-3 inline mr-0.5" />{dict.htmlView}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setViewMode('text'); }}
                    className={`px-2 py-0.5 text-[10px] rounded-md transition-all cursor-pointer ${viewMode === 'text' ? 'bg-brand/20 text-brand font-semibold' : 'text-text-muted hover:text-text-secondary'}`}
                  >
                    <FileText className="w-3 h-3 inline mr-0.5" />{dict.textPlain}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Body content */}
          <div className="p-4">
            {msgDetail.isLoading ? (
              <div className="flex items-center gap-2 text-xs text-text-muted py-8 justify-center">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {dict.loadingBody}
              </div>
            ) : viewMode === 'html' && hasHtml ? (
              <div className="bg-white rounded-lg overflow-hidden" style={{ minHeight: '120px' }}>
                <iframe
                  srcDoc={htmlContent}
                  className="w-full border-0"
                  style={{ minHeight: '200px', height: '400px' }}
                  sandbox="allow-same-origin"
                  title="Email content"
                  onLoad={(e) => {
                    const iframe = e.target as HTMLIFrameElement;
                    if (iframe.contentDocument?.body) {
                      const h = iframe.contentDocument.body.scrollHeight + 20;
                      iframe.style.height = `${Math.min(h, 600)}px`;
                    }
                  }}
                />
              </div>
            ) : hasText ? (
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                {textContent}
              </pre>
            ) : (
              <p className="text-xs text-text-muted/50 italic py-4 text-center">No content</p>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                <p className="text-[10px] font-semibold text-text-muted mb-1.5">{dict.attachments} ({attachments.length})</p>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att: any) => (
                    <AttachmentButton key={att.id} att={att} mailboxPublicId={mailboxPublicId} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Inbox Panel ──────────────────────────────────────────────
function InboxPanel({
  mailboxPublicId,
  address,
  dict,
  locale,
}: {
  mailboxPublicId: string;
  address: string;
  dict: Record<string, string>;
  locale: string;
}) {
  const [copied, setCopied] = useState(false);

  const messages = trpc.mailbox.getMessages.useQuery(
    { mailboxId: mailboxPublicId },
    { refetchInterval: 15_000, staleTime: 10_000 }
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard may fail silently */ }
  }, [address]);

  const msgList = messages.data ?? [];

  return (
    <div className="bg-white/[0.015] border-t border-white/[0.05] animate-fade-in-up">
      {/* Inbox header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand/25 to-brand/10 flex items-center justify-center ring-2 ring-brand/15">
            <MailOpen className="w-4.5 h-4.5 text-brand" />
          </div>
          <span className="text-sm font-bold text-text-primary">{dict.inbox}</span>
          <span className="text-[11px] font-medium text-text-muted/50 bg-white/[0.05] px-2 py-0.5 rounded-full tabular-nums">{msgList.length}</span>
          {messages.isFetching && !messages.isLoading && (
            <RefreshCw className="w-3.5 h-3.5 text-brand/40 animate-spin" />
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer hover:bg-brand/10 text-text-muted hover:text-brand border border-transparent hover:border-brand/20"
          title={dict.copyEmail}
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">{dict.copied}</span></>
          ) : (
            <><Copy className="w-3.5 h-3.5" />{dict.copyEmail}</>
          )}
        </button>
      </div>

      {/* Messages list */}
      {messages.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-text-muted py-8 justify-center">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          {dict.loadingMessages}
        </div>
      ) : msgList.length === 0 ? (
        <div className="py-10 text-center">
          <Mail className="w-8 h-8 text-text-muted/20 mx-auto mb-2" />
          <p className="text-xs text-text-muted/40">{dict.noMessages}</p>
        </div>
      ) : (
        <div>
          {msgList.map((msg: any) => (
            <MessageRow
              key={msg.id}
              msg={msg}
              mailboxPublicId={mailboxPublicId}
              dict={dict}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mailbox Row with Copy Button ─────────────────────────────────────
function MailboxRow({
  mb,
  isExpanded,
  onToggle,
  onExtend,
  onDelete,
  dict,
  ui,
  tips,
}: {
  mb: any;
  isExpanded: boolean;
  onToggle: () => void;
  onExtend: () => void;
  onDelete: () => void;
  dict: Record<string, string>;
  ui: Record<string, string>;
  tips: Record<string, string>;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(mb.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [mb.address]);

  return (
    <div className={`px-3 sm:px-5 py-3 sm:py-4 transition-all group ${isExpanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Chevron */}
        <button
          onClick={onToggle}
          className="mt-2.5 text-text-muted/40 shrink-0 transition-transform duration-200 cursor-pointer"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Icon */}
        <button
          onClick={onToggle}
          className={`w-9 h-9 sm:w-10 sm:h-10 mt-0.5 rounded-xl flex items-center justify-center shrink-0 cursor-pointer ${isExpanded ? 'bg-gradient-to-br from-brand/25 to-brand/10 ring-2 ring-brand/15' : 'bg-brand/10'} transition-all`}
        >
          <Mail className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${isExpanded ? 'text-brand' : 'text-brand/70'}`} />
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Row 1: address + badge */}
          <button
            onClick={onToggle}
            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <p className="text-[13px] sm:text-sm font-semibold text-text-primary group-hover:text-brand transition-colors font-mono truncate">
              {mb.address}
            </p>
            <StatusBadge status={mb.status} />
          </button>

          {/* Row 2: stats + inline actions */}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-text-muted">
              <span>{mb.messageCount ?? 0} {dict.messagesCount}</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {mb.expiresAt ? formatDate(mb.expiresAt) : '—'}
              </span>
            </div>

            {/* Compact action buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Tooltip text={tips.copyEmail} position="bottom">
              <button
                onClick={handleCopy}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  copied
                    ? 'text-green-400 bg-green-400/10'
                    : 'text-text-muted/50 hover:text-brand hover:bg-brand/10'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              </Tooltip>
              <Tooltip text={tips.extendTtl} position="bottom">
              <button
                onClick={onExtend}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/50 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer"
              >
                <Timer className="w-3.5 h-3.5" />
              </button>
              </Tooltip>
              <Tooltip text={tips.deleteMailbox} position="bottom">
              <button
                onClick={onDelete}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted/30 hover:text-danger hover:bg-danger/10 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
export function MailboxList({ dict }: MailboxListProps) {
  const d = dict.mailboxes;
  const ui = dict.ui;
  const tips = dict.tooltips ?? {};
  const toast = useToast();
  const params = useParams();
  const locale = (params.locale as string) || 'en';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDelete, setShowDelete] = useState<string | null>(null);
  const [showExtend, setShowExtend] = useState<string | null>(null);
  const [createUsername, setCreateUsername] = useState('');

  // RFC 5321/5322 username validation
  const usernameError = useMemo(() => {
    const v = createUsername;
    if (!v) return ''; // optional — empty means random
    if (v.length > 30) return d.usernameMaxLength || 'Must be 30 characters or less';
    if (!/^[a-z0-9._-]+$/.test(v)) return d.usernameInvalidChars || 'Only letters, numbers, dots, hyphens and underscores';
    if (/^[._-]/.test(v)) return d.usernameStartEnd || 'Must start and end with a letter or number';
    if (/[._-]$/.test(v)) return d.usernameStartEnd || 'Must start and end with a letter or number';
    if (/\.{2,}/.test(v)) return d.usernameConsecutiveDots || 'Consecutive dots not allowed';
    if (/[-_]{2,}/.test(v)) return d.usernameConsecutiveSpecial || 'Consecutive hyphens/underscores not allowed';
    return '';
  }, [createUsername, d]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [domainDropdownOpen, setDomainDropdownOpen] = useState(false);
  const domainDropdownRef = useRef<HTMLDivElement>(null);
  const [extendHours, setExtendHours] = useState(24);
  const [expandedMailbox, setExpandedMailbox] = useState<string | null>(null);

  // Close domain dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (domainDropdownRef.current && !domainDropdownRef.current.contains(e.target as Node)) {
        setDomainDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const mailboxes = trpc.mailbox.list.useQuery({ page, pageSize: 20 });
  const domains = trpc.tempmail.listDomains.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const customDomains = trpc.domain.list.useQuery();

  const createMailbox = trpc.mailbox.create.useMutation({
    onSuccess: () => {
      toast.success(d.createSuccess);
      setShowCreate(false);
      setCreateUsername('');
      setSelectedDomainId('');
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

  const publicDomains = domains.data ?? [];
  const verifiedCustomDomains = (customDomains.data ?? []).filter((d: any) => d.status === 'VERIFIED' || d.status === 'ACTIVE');
  
  // Combine public domains and the user's verified custom domains
  const domainList = [
    ...publicDomains.map((d: any) => ({ ...d, isCustom: false })),
    ...verifiedCustomDomains.map((d: any) => ({ 
      id: d.id, 
      domainName: d.name, 
      isPublic: false, 
      isCustom: true 
    }))
  ];

  const activeDomainId = selectedDomainId || (domainList.length > 0 ? domainList[0].id : '');
  const activeDomainName = domainList.find((d: any) => d.id === activeDomainId)?.domainName ?? '';

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1 text-text-primary">{d.title}</h1>
          <p className="text-xs sm:text-sm text-text-muted">{d.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip text={tips.createMailbox} position="bottom">
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 transition-all duration-300 flex items-center gap-2 cursor-pointer"
            id="create-mailbox-btn"
          >
            <Plus className="w-4 h-4" />
            {d.create}
          </button>
          </Tooltip>
        </div>
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

      {/* Mailbox List */}
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
          <div>
            {filtered.map((mb: any) => {
              const isExpanded = expandedMailbox === mb.id;
              return (
                <div key={mb.id} className="border-b border-white/[0.04] last:border-b-0">
                  {/* Mailbox row */}
                  <MailboxRow
                    mb={mb}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedMailbox(isExpanded ? null : mb.id)}
                    onExtend={() => setShowExtend(mb.id)}
                    onDelete={() => setShowDelete(mb.id)}
                    dict={d}
                    ui={ui}
                    tips={tips}
                  />

                  {/* Inline Inbox Panel */}
                  {isExpanded && (
                    <InboxPanel
                      mailboxPublicId={mb.id}
                      address={mb.address}
                      dict={d}
                      locale={locale}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(mailboxes.data?.total ?? 0) > 20 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Tooltip text={tips.prevPage} position="top">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.prev}</button>
          </Tooltip>
          <span className="text-xs text-text-muted">{ui.page} {page}</span>
          <Tooltip text={tips.nextPage} position="top">
          <button disabled={filtered.length < 20} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-xs font-medium text-text-muted border border-border-subtle rounded-lg hover:bg-white/[0.04] disabled:opacity-30 cursor-pointer">{ui.next}</button>
          </Tooltip>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={d.createTitle}>
        <div className="space-y-5">
          {/* Username input */}
          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">{d.username || 'Email Address'}</label>
            <div className="flex items-center gap-0">
              <input
                type="text"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30))}
                className={`flex-1 bg-white/[0.04] border rounded-l-xl text-text-primary text-sm py-3 px-4 outline-none focus:ring-2 transition-all placeholder:text-text-muted/40 font-mono ${usernameError ? 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/10' : 'border-border-subtle focus:border-brand/40 focus:ring-brand/10'}`}
                placeholder={d.usernamePlaceholder || 'username'}
                maxLength={30}
              />
              <span className="bg-white/[0.06] border-y border-border-subtle text-text-muted text-sm py-3 px-2.5 select-none font-mono font-bold">@</span>
              {/* Custom domain dropdown */}
              <div className="relative min-w-[160px]" ref={domainDropdownRef}>
                <button
                  type="button"
                  onClick={() => setDomainDropdownOpen(!domainDropdownOpen)}
                  className="w-full bg-white/[0.04] border border-border-subtle rounded-r-xl text-text-primary text-sm py-3 px-3 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all cursor-pointer font-mono flex items-center justify-between gap-2"
                  id="domain-select"
                >
                  <span className="truncate">
                    {domains.isLoading || customDomains.isLoading
                      ? (ui.loading || 'Loading...')
                      : activeDomainName || (d.noDomains || 'No domains')}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-text-muted/60 shrink-0 transition-transform duration-200 ${domainDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {domainDropdownOpen && domainList.length > 0 && (
                  <div className="absolute top-full right-0 mt-1.5 w-full min-w-[200px] bg-bg-primary/95 backdrop-blur-xl border border-border-subtle rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-fade-in-up">
                    <div className="max-h-[240px] overflow-y-auto py-1">
                      {publicDomains.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted/40">
                            {d.publicDomain || 'Public'}
                          </div>
                          {publicDomains.map((dom: any) => (
                            <button
                              key={dom.id}
                              type="button"
                              onClick={() => { setSelectedDomainId(dom.id); setDomainDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm font-mono transition-all cursor-pointer flex items-center gap-2 ${
                                activeDomainId === dom.id
                                  ? 'bg-brand/10 text-brand font-semibold'
                                  : 'text-text-primary hover:bg-white/[0.06]'
                              }`}
                            >
                              <Globe className="w-3 h-3 shrink-0 text-text-muted/50" />
                              <span className="truncate">{dom.domainName}</span>
                              {activeDomainId === dom.id && <Check className="w-3 h-3 ml-auto shrink-0 text-brand" />}
                            </button>
                          ))}
                        </>
                      )}
                      {verifiedCustomDomains.length > 0 && (
                        <>
                          {publicDomains.length > 0 && <div className="border-t border-border-subtle my-1" />}
                          <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-text-muted/40">
                            {d.customDomain || 'Custom'}
                          </div>
                          {verifiedCustomDomains.map((dom: any) => (
                            <button
                              key={dom.id}
                              type="button"
                              onClick={() => { setSelectedDomainId(dom.id); setDomainDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-sm font-mono transition-all cursor-pointer flex items-center gap-2 ${
                                activeDomainId === dom.id
                                  ? 'bg-brand/10 text-brand font-semibold'
                                  : 'text-text-primary hover:bg-white/[0.06]'
                              }`}
                            >
                              <ShieldCheck className="w-3 h-3 shrink-0 text-emerald-400/70" />
                              <span className="truncate">{dom.name}</span>
                              {activeDomainId === dom.id && <Check className="w-3 h-3 ml-auto shrink-0 text-brand" />}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Validation feedback + character counter */}
            <div className="flex items-center justify-between mt-1.5 min-h-[18px]">
              {usernameError ? (
                <p className="text-[11px] text-red-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {usernameError}
                </p>
              ) : createUsername ? (
                <p className="text-[11px] text-emerald-400/70 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3 shrink-0" />
                  Valid
                </p>
              ) : <span />}
              {createUsername && (
                <span className={`text-[11px] font-mono ${createUsername.length > 25 ? 'text-amber-400' : 'text-text-muted/50'}`}>
                  {createUsername.length}/30
                </span>
              )}
            </div>
          </div>

          {/* Preview address */}
          {activeDomainName && (
            <div className="bg-white/[0.025] border border-border-subtle rounded-xl p-3.5">
              <p className="text-[10px] font-semibold text-text-muted/60 mb-1 uppercase tracking-wider">{d.previewAddress}</p>
              <p className="text-sm font-mono font-bold text-brand tracking-wide">
                {createUsername || '(random)'}@{activeDomainName}
              </p>
            </div>
          )}

          {/* Domain status badge */}
          {activeDomainName && (
            <div className="flex items-center gap-3 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-400">{d.emailApproved}</span>
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <p className="text-[10px] text-text-muted mt-0.5">{d.domainReady}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => createMailbox.mutate({
              username: createUsername || undefined,
              domainId: activeDomainId || undefined,
            } as any)}
            disabled={createMailbox.isPending || domainList.length === 0 || !!usernameError}
            className="w-full py-3 text-sm font-bold text-white bg-gradient-to-r from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
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
