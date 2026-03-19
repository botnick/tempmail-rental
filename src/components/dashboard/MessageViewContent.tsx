'use client';

import { trpc } from '@/lib/trpc';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  ArrowLeft, Mail, Paperclip, Copy, Check, Download,
  FileText, Code, Clock, MoreVertical,
  Printer, Trash2, FileDown,
} from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { decodeMIME, looksLikeHtml, tryDecodeBase64 } from '@/utils/emailHelpers';

dayjs.extend(relativeTime);

// ─── Actions Dropdown Menu ───────────────────────────────────────────
function ActionsMenu({
  htmlContent,
  textContent,
  subject,
  onDelete,
}: {
  htmlContent: string;
  textContent: string;
  subject: string;
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const safeName = (subject || 'email').replace(/[^a-zA-Z0-9\u0E00-\u0E7F ]/g, '_').substring(0, 60);

  const handleDownload = () => {
    const content = htmlContent || textContent;
    const type = htmlContent ? 'text/html' : 'text/plain';
    const ext = htmlContent ? 'html' : 'txt';
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const handleSource = () => {
    const content = htmlContent || textContent || 'No content';
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<pre style="white-space:pre-wrap;word-break:break-all;font-family:monospace;padding:20px;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
      w.document.close();
    }
    setOpen(false);
  };

  const handlePrint = () => {
    const content = htmlContent || `<pre style="font-family:monospace;white-space:pre-wrap;">${textContent}</pre>`;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html><head><title>${safeName}</title></head><body>${content}</body></html>`);
      printWindow.document.close();
      printWindow.print();
    }
    setOpen(false);
  };

  return (
    <div className="relative z-50" ref={menuRef}>
      <Tooltip text="Actions" position="left">
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted/50 hover:text-text-primary hover:bg-white/[0.06] transition-all cursor-pointer border border-transparent hover:border-white/[0.06]"
        title="Actions"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl shadow-black/50 py-1.5 z-50 animate-fade-in-up">
          <button
            onClick={handleDownload}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-text-muted/60" />
            Download
          </button>
          <button
            onClick={handleSource}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <Code className="w-4 h-4 text-text-muted/60" />
            Source
          </button>
          <button
            onClick={handlePrint}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-text-muted/60" />
            Print
          </button>
          {onDelete && (
            <>
              <div className="my-1.5 border-t border-white/[0.06]" />
              <button
                onClick={() => { onDelete(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-danger hover:bg-danger/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── File Type Info ──────────────────────────────────────────────────
function getFileTypeInfo(contentType: string, filename: string): { color: string; label: string } {
  if (contentType?.startsWith('image/')) return { color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', label: 'IMG' };
  if (contentType?.includes('pdf')) return { color: 'text-red-400 bg-red-400/10 border-red-400/20', label: 'PDF' };
  if (contentType?.includes('zip') || contentType?.includes('rar') || contentType?.includes('tar'))
    return { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'ZIP' };
  if (contentType?.includes('word') || filename?.endsWith('.doc') || filename?.endsWith('.docx'))
    return { color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', label: 'DOC' };
  if (contentType?.includes('sheet') || filename?.endsWith('.xls') || filename?.endsWith('.xlsx'))
    return { color: 'text-green-400 bg-green-400/10 border-green-400/20', label: 'XLS' };
  return { color: 'text-text-muted bg-white/[0.04] border-white/[0.06]', label: 'FILE' };
}

// ─── Attachment Card ─────────────────────────────────────────────────
function AttachmentDownload({ att, mailboxPublicId }: { att: any; mailboxPublicId: string }) {
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();
  const fileInfo = getFileTypeInfo(att.contentType, att.filename);

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
    ? `${(att.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : att.sizeBytes ? `${(att.sizeBytes / 1024).toFixed(0)} KB` : '';

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-text-secondary hover:bg-white/[0.06] hover:border-brand/20 transition-all cursor-pointer disabled:opacity-50 group w-full"
    >
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center shrink-0 ${fileInfo.color}`}>
        <span className="text-[10px] font-black tracking-wider">{fileInfo.label}</span>
      </div>
      <div className="min-w-0 text-left flex-1">
        <p className="text-xs sm:text-sm font-medium text-text-primary truncate">{att.filename}</p>
        {sizeLabel && <p className="text-[10px] sm:text-[11px] text-text-muted/50 mt-0.5">{sizeLabel}</p>}
      </div>
      <Download className="w-4 h-4 text-text-muted/20 group-hover:text-brand transition-colors shrink-0" />
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
interface MessageViewContentProps {
  messageId: string;
  dict: {
    mailboxes: Record<string, string>;
    ui: Record<string, string>;
    tooltips: Record<string, string>;
  };
  locale: string;
}

export function MessageViewContent({ messageId, dict, locale }: MessageViewContentProps) {
  const d = dict.mailboxes;
  const tips = dict.tooltips ?? {};
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailboxId = searchParams.get('mb') || '';

  const [viewMode, setViewMode] = useState<'html' | 'text'>('html');
  const [copied, setCopied] = useState(false);

  const msgDetail = trpc.tempmail.getMessage.useQuery(
    { messageId, mailboxPublicId: mailboxId },
    { enabled: !!mailboxId, staleTime: 60_000 }
  );

  const deleteMsg = trpc.tempmail.deleteMessage.useMutation({
    onSuccess: () => {
      router.push(`/${locale}/dashboard/mailboxes`);
    },
  });

  const detail = msgDetail.data;

  // Smart content detection
  const rawHtml = tryDecodeBase64(detail?.htmlBody || '');
  const rawText = tryDecodeBase64(detail?.textBody || '');
  const htmlContent = (rawHtml || (looksLikeHtml(rawText) ? rawText : ''))
    .replace(/<script[\s\S]*?<\/script>/gi, '') // Strip script tags to silence console warnings
    .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '') // Strip inline event handlers like onload=""
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')       // Strip inline event handlers without quotes
    .replace(/src=["']cid:[^"']+["']/gi, 'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"');
  const textContent = rawHtml ? rawText : (looksLikeHtml(rawText) ? '' : rawText);
  const hasHtml = !!htmlContent;
  const hasText = !!textContent;
  const attachments = detail?.attachments ?? [];

  const handleCopyFrom = useCallback(async () => {
    if (!detail?.from) return;
    try {
      await navigator.clipboard.writeText(detail.from);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [detail?.from]);

  const handleDelete = useCallback(() => {
    if (!confirm('Delete this message?')) return;
    deleteMsg.mutate({ messageId, mailboxPublicId: mailboxId });
  }, [messageId, mailboxId, deleteMsg]);

  /** Auto-resize srcdoc iframe to fit content */
  const handleIframeLoad = useCallback((e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.target as HTMLIFrameElement;
    try {
      if (iframe.contentDocument?.body) {
        const h = iframe.contentDocument.body.scrollHeight + 40;
        iframe.style.height = `${Math.min(h, 2000)}px`;
      }
    } catch { /* cross-origin */ }
  }, []);

  if (!mailboxId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-text-muted">Missing mailbox reference</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in-up">
      {/* Back button */}
      <Tooltip text={tips.backToInbox} position="right">
      <Link
        href={`/${locale}/dashboard/mailboxes`}
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-4 sm:mb-6 lg:mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        {d.backToInbox}
      </Link>
      </Tooltip>

      {msgDetail.isLoading ? (
        <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-10">
          <SkeletonTable rows={10} />
        </div>
      ) : !detail ? (
        <div className="bg-white/[0.025] backdrop-blur-xl border border-border-subtle rounded-xl sm:rounded-2xl p-10 sm:p-16 lg:p-20 text-center">
          <Mail className="w-12 h-12 sm:w-14 sm:h-14 text-text-muted/15 mx-auto mb-4" />
          <p className="text-sm sm:text-base text-text-muted">Message not found</p>
        </div>
      ) : (
        <div className="bg-white/[0.02] backdrop-blur-xl border border-border-subtle rounded-xl sm:rounded-2xl overflow-hidden shadow-xl shadow-black/5">
          {/* ── Gradient accent stripe ── */}
          <div className="h-1 bg-gradient-to-r from-brand via-amber-500/80 to-brand/60" />

          {/* ── Header ── */}
          <div className="px-4 pt-5 pb-4 sm:px-6 sm:pt-7 sm:pb-5 lg:px-8 lg:pt-8 lg:pb-6">
            {/* Top bar: subject + actions menu */}
            <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6 relative z-50">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-text-primary leading-snug tracking-tight break-words flex-1">
                {decodeMIME(detail.subject) || d.noSubject}
              </h1>
              <ActionsMenu
                htmlContent={htmlContent}
                textContent={textContent}
                subject={decodeMIME(detail.subject) || 'email'}
                onDelete={handleDelete}
              />
            </div>

            {/* Sender card */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 bg-white/[0.025] border border-white/[0.05] rounded-xl px-4 py-3.5 flex-1">
                {/* Avatar */}
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-brand/30 to-amber-500/20 flex items-center justify-center shrink-0 ring-2 ring-brand/15 shadow-lg shadow-brand/5">
                  <span className="text-sm sm:text-base font-black text-brand drop-shadow-sm">
                    {(detail.from || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Sender email + copy */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider">From</span>
                    <p className="text-sm sm:text-[15px] font-bold text-text-primary truncate max-w-[240px] sm:max-w-none">{decodeMIME(detail.from || '')}</p>
                    <Tooltip text={tips.copySender} position="top">
                    <button
                      onClick={handleCopyFrom}
                      className="shrink-0 p-1 rounded-md text-text-muted/30 hover:text-brand hover:bg-brand/10 transition-all cursor-pointer"
                      title={d.copyEmail}
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    </Tooltip>
                  </div>
                  {/* Date */}
                  <div className="flex items-center gap-1.5 text-xs text-text-muted/60">
                    <Clock className="w-3 h-3 text-text-muted/35" />
                    <span>{dayjs(detail.receivedAt).format('YYYY-MM-DD HH:mm')}</span>
                    <span className="text-text-muted/30">·</span>
                    <span className="text-text-muted/40">{dayjs(detail.receivedAt).fromNow()}</span>
                  </div>
                  {/* Recipient */}
                  {detail.to && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider">To</span>
                      <p className="text-[12px] font-mono text-text-muted/60 truncate">{detail.to}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* View mode toggle */}
              {hasHtml && hasText && (
                <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-1 shrink-0 border border-white/[0.04] self-start">
                  <Tooltip text={tips.viewHtml} position="bottom">
                  <button
                    onClick={() => setViewMode('html')}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 font-medium ${viewMode === 'html' ? 'bg-brand/20 text-brand font-bold shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'}`}
                  >
                    <Code className="w-3.5 h-3.5" />{d.htmlView}
                  </button>
                  </Tooltip>
                  <Tooltip text={tips.viewText} position="bottom">
                  <button
                    onClick={() => setViewMode('text')}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all cursor-pointer flex items-center gap-1.5 font-medium ${viewMode === 'text' ? 'bg-brand/20 text-brand font-bold shadow-sm' : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'}`}
                  >
                    <FileText className="w-3.5 h-3.5" />{d.textPlain}
                  </button>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="mx-4 sm:mx-6 lg:mx-8 border-t border-white/[0.04]" />

          {/* ── Body ── */}
          <div className="p-3 sm:p-5 lg:p-8">
            {viewMode === 'html' && hasHtml ? (
              <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5">
                <iframe
                  srcDoc={htmlContent}
                  className="w-full border-0"
                  style={{ minHeight: '300px', height: '600px' }}
                  sandbox="allow-same-origin allow-popups"
                  title="Email content"
                  onLoad={handleIframeLoad}
                />
              </div>
            ) : hasText ? (
              <pre className="text-xs sm:text-sm text-text-secondary whitespace-pre-wrap font-mono leading-relaxed max-h-[600px] sm:max-h-[800px] lg:max-h-[1000px] overflow-y-auto p-4 sm:p-6 bg-white/[0.02] rounded-xl sm:rounded-2xl border border-white/[0.05]">
                {textContent}
              </pre>
            ) : hasHtml ? (
              <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-md ring-1 ring-black/5">
                <iframe
                  srcDoc={htmlContent}
                  className="w-full border-0"
                  style={{ minHeight: '300px', height: '600px' }}
                  sandbox="allow-same-origin allow-popups"
                  title="Email content"
                  onLoad={handleIframeLoad}
                />
              </div>
            ) : (
              <div className="py-12 sm:py-16 text-center">
                <Mail className="w-10 h-10 text-text-muted/15 mx-auto mb-3" />
                <p className="text-sm text-text-muted/40">No content</p>
              </div>
            )}
          </div>

          {/* ── Attachments ── */}
          {attachments.length > 0 && (
            <div className="px-3 pb-4 sm:px-5 sm:pb-6 lg:px-8 lg:pb-8">
              <div className="border-t border-white/[0.05] pt-4 sm:pt-6">
                <p className="text-sm font-bold text-text-secondary mb-3 sm:mb-4 flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-text-muted/50" />
                  {d.attachments}
                  <span className="text-xs font-medium text-text-muted/40 bg-white/[0.04] px-2 py-0.5 rounded-full">{attachments.length}</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                  {attachments.map((att: any) => (
                    <AttachmentDownload key={att.id} att={att} mailboxPublicId={mailboxId} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
