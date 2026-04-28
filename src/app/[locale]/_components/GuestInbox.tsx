'use client';

/**
 * Anonymous inbox — landing-page hero.
 *
 * Calls /api/guest/bootstrap on mount: that route handler reads/issues the
 * signed `guest_token` cookie (RSC pages can't write cookies in Next 16)
 * and returns the guest's active mailbox. Subsequent updates use SSE +
 * tRPC polling.
 *
 * Visual: gradient-frame glassmorphism matching the landing theme
 * (from-brand to-amber border + bg-surface inner card, same as the hero
 * CTA cards below).
 */
import { useEffect, useRef, useState } from 'react';
import {
  Copy, Check, Clock, RefreshCw, Trash2, Plus, Mail, Paperclip,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface InitialMailbox {
  publicId: string;
  address: string;
  expiresAt: string | null;
  status: string;
}

interface Props {
  locale: string;
  dict: any;
}

export function GuestInbox({ locale, dict }: Props) {
  const [mailbox, setMailbox] = useState<InitialMailbox | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Bootstrap once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/guest/bootstrap', {
      method: 'GET',
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setMailbox({
          publicId: data.mailbox.publicId,
          address: data.mailbox.address,
          expiresAt: data.mailbox.expiresAt,
          status: data.mailbox.status,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setBootstrapError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const messages = trpc.mailbox.getMessages.useQuery(
    { mailboxId: mailbox?.publicId ?? '' },
    {
      enabled: !!mailbox?.publicId,
      refetchInterval: 10_000,
      staleTime: 8_000,
    }
  );

  const createMailbox = trpc.mailbox.create.useMutation({
    onSuccess: (m) => {
      setMailbox({
        publicId: m.id,
        address: m.address,
        expiresAt: m.expiresAt ? new Date(m.expiresAt as any).toISOString() : null,
        status: m.status,
      });
      utils.mailbox.list.invalidate();
    },
  });

  const deleteMailbox = trpc.mailbox.delete.useMutation({
    onSuccess: () => {
      // Re-bootstrap so the route handler issues a fresh mailbox + updates the cookie.
      fetch('/api/guest/bootstrap', { method: 'POST', credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => {
          if (data?.mailbox) {
            setMailbox({
              publicId: data.mailbox.publicId,
              address: data.mailbox.address,
              expiresAt: data.mailbox.expiresAt,
              status: data.mailbox.status,
            });
          }
        });
    },
  });

  const extendTTL = trpc.mailbox.extendTTL.useMutation({
    onSuccess: (r) => {
      if (r.expiresAt && mailbox) {
        setMailbox({
          ...mailbox,
          expiresAt: new Date(r.expiresAt as any).toISOString(),
        });
      }
    },
  });

  // SSE wiring (only after we have a mailbox)
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!mailbox?.publicId) return;
    const url = `/api/tempmail/sse?mailboxId=${encodeURIComponent(mailbox.publicId)}`;
    const es = new EventSource(url, { withCredentials: true });
    sseRef.current = es;
    es.addEventListener('new_message', () => {
      utils.mailbox.getMessages.invalidate({ mailboxId: mailbox.publicId });
    });
    es.onerror = () => {};
    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [mailbox?.publicId, utils]);

  // Countdown
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const minutesLeft = mailbox?.expiresAt
    ? Math.max(0, Math.round((new Date(mailbox.expiresAt).getTime() - now) / 60_000))
    : null;
  const hoursLeft = minutesLeft !== null ? Math.floor(minutesLeft / 60) : null;
  const ttlLabel =
    hoursLeft !== null && hoursLeft >= 1
      ? `${hoursLeft} ชม.`
      : minutesLeft !== null
        ? `${minutesLeft} นาที`
        : null;

  const onCopy = async () => {
    if (!mailbox?.address) return;
    try {
      await navigator.clipboard.writeText(mailbox.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const t = dict.home ?? {};
  const items = messages.data ?? [];

  // ── Frame: gradient border + bg-surface inner, matching hero CTA card ──
  const Frame = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`relative p-[1px] rounded-2xl bg-gradient-to-br from-brand/50 via-amber/30 to-brand-glow/15 ${className}`}>
      <div className="bg-surface rounded-2xl">{children}</div>
    </div>
  );

  // ── Loading ──────────────────────────────────────
  if (!mailbox && !bootstrapError) {
    return (
      <div className="w-full max-w-xl mx-auto">
        <Frame>
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand/30 to-amber/20 flex items-center justify-center animate-pulse">
              <Mail className="w-5 h-5 text-brand" />
            </div>
            <div>
              <p className="text-sm text-text-primary font-semibold">กำลังเตรียมกล่องจดหมาย…</p>
              <p className="text-xs text-text-muted">รอสักครู่</p>
            </div>
          </div>
        </Frame>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────
  if (bootstrapError) {
    return (
      <div className="w-full max-w-xl mx-auto">
        <Frame className="from-amber-500/40 via-amber-500/20 to-amber-500/10">
          <div className="p-6">
            <p className="text-sm font-bold text-amber-300">ระบบเมลกำลังปรับปรุง</p>
            <p className="text-xs text-text-muted mt-1">{bootstrapError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-brand border border-brand/30 hover:bg-brand/10 transition-all"
            >
              <RefreshCw className="w-3 h-3" />
              ลองใหม่
            </button>
          </div>
        </Frame>
      </div>
    );
  }

  // ── Active inbox ────────────────────────────────
  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Address card */}
      <Frame>
        <div className="p-6">
          {/* Top row */}
          <div className="flex items-center justify-between mb-4 text-[11px]">
            <span className="inline-flex items-center gap-2 text-text-muted">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span>{t.waitingEmail ?? 'กำลังรอรับอีเมล'}</span>
            </span>
            {ttlLabel && (
              <span className="inline-flex items-center gap-1 text-amber font-medium">
                <Clock className="w-3 h-3" />
                หมดอายุใน {ttlLabel}
              </span>
            )}
          </div>

          {/* Address + copy */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand/50" />
              <input
                type="text"
                readOnly
                value={mailbox!.address}
                className="w-full bg-white/[0.03] border border-brand/10 rounded-xl text-text-primary text-sm py-3 pl-11 pr-4 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 select-all font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>
            <button
              type="button"
              onClick={onCopy}
              className="px-5 py-3 text-sm font-bold text-white bg-gradient-to-br from-brand to-amber rounded-xl hover:shadow-lg hover:shadow-brand/25 active:scale-95 transition-all duration-300 whitespace-nowrap inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'คัดลอกแล้ว' : (t.copy ?? 'คัดลอก')}</span>
            </button>
          </div>

          {/* Quick actions */}
          <div className="flex items-center justify-between mt-4 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => extendTTL.mutate({ mailboxId: mailbox!.publicId, hours: 24 })}
                disabled={extendTTL.isPending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-brand/10 hover:text-brand transition-colors disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
                ยืดเวลา 24 ชม.
              </button>
              <button
                type="button"
                onClick={() => deleteMailbox.mutate({ mailboxId: mailbox!.publicId })}
                disabled={deleteMailbox.isPending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                <RefreshCw className="w-3 h-3" />
                สร้างใหม่
              </button>
            </div>
            <span className="text-text-muted/60">
              {items.length} {t.messages ?? 'ข้อความ'}
            </span>
          </div>
        </div>
      </Frame>

      {/* Inbox list */}
      {items.length > 0 && (
        <Frame>
          <div className="p-2">
            <ul className="divide-y divide-border-subtle">
              {items.map((m) => {
                const isOpen = selectedMessageId === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedMessageId((s) => (s === m.id ? null : m.id))}
                      className="w-full text-left px-4 py-3 hover:bg-brand/5 rounded-xl transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[11px] font-mono text-text-muted truncate">{m.from}</span>
                        <span className="text-[10px] text-text-muted/60 flex-shrink-0">
                          {new Date(m.receivedAt).toLocaleTimeString(locale, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {m.subject || '(ไม่มีหัวเรื่อง)'}
                      </p>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-2 text-sm border-t border-border-subtle">
                        {m.bodyHtml ? (
                          <div
                            className="prose prose-invert prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: m.bodyHtml }}
                          />
                        ) : (
                          <pre className="whitespace-pre-wrap text-xs text-text-secondary font-mono">
                            {m.bodyText || '(empty)'}
                          </pre>
                        )}
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {m.attachments.map((a: any) => (
                              <a
                                key={a.id}
                                href={`/api/attachments/${a.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-brand/10 hover:border-brand/30 hover:bg-brand/5 text-xs text-text-primary transition-colors"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-brand" />
                                {a.filename}
                                <span className="text-text-muted">
                                  ({(a.size / 1024).toFixed(1)} KB)
                                </span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </Frame>
      )}
    </div>
  );
}
