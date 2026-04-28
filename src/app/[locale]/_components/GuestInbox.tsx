'use client';

/**
 * Anonymous inbox — landing-page hero.
 *
 * On mount, calls /api/guest/bootstrap which (1) reads/issues the signed
 * `guest_token` cookie, and (2) returns either an existing active mailbox
 * or a freshly minted one. Cannot bootstrap server-side from the page
 * because Next 16 forbids cookie mutation outside Route Handlers.
 *
 * Once we have a mailbox:
 *   - Show address + copy
 *   - Poll messages every 10s + subscribe via SSE for real-time pushes
 *   - Click message → expand
 *   - "ลบและสร้างใหม่" → delete + auto-create new
 *   - "ยืดเวลา" → extendTTL +24h
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
      // Re-bootstrap after delete so a new mailbox + cookie roll happens
      // through the route handler, keeping the cookie list in sync.
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

  // ── SSE wiring (only after we have a mailbox) ──────────
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!mailbox?.publicId) return;
    const url = `/api/tempmail/sse?mailboxId=${encodeURIComponent(mailbox.publicId)}`;
    const es = new EventSource(url, { withCredentials: true });
    sseRef.current = es;
    es.addEventListener('new_message', () => {
      utils.mailbox.getMessages.invalidate({ mailboxId: mailbox.publicId });
    });
    es.onerror = () => {
      // Browser auto-reconnects; nothing else to do.
    };
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

  const onCopy = async () => {
    if (!mailbox?.address) return;
    try {
      await navigator.clipboard.writeText(mailbox.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const t = dict.home ?? {};
  const items = messages.data ?? [];

  // ── Loading / error states ────────────────────────────
  if (bootstrapError) {
    return (
      <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 mt-8">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-sm text-amber-300">
          ระบบเมลกำลังปรับปรุงชั่วคราว ลองรีเฟรชอีกครั้ง — {bootstrapError}
        </div>
      </section>
    );
  }
  if (!mailbox) {
    return (
      <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 mt-8">
        <div className="rounded-2xl border border-brand/20 bg-bg-elevated/60 p-6 text-center text-text-secondary">
          กำลังเตรียมกล่องจดหมาย…
        </div>
      </section>
    );
  }

  return (
    <section className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 mt-8">
      {/* Address card */}
      <div className="rounded-2xl border border-brand/20 bg-bg-elevated/60 backdrop-blur-xl p-5 sm:p-6 shadow-2xl shadow-brand/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest font-bold text-text-secondary">
            {t.youremail ?? 'อีเมลชั่วคราวของคุณ'}
          </span>
          {minutesLeft !== null && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
              <Clock className="w-3 h-3" />
              {t.expiresIn ?? 'หมดอายุใน'} {minutesLeft} {t.minutes ?? 'นาที'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-base sm:text-lg text-text-primary truncate select-all">
            {mailbox.address}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand text-white text-sm font-bold hover:shadow-lg hover:shadow-brand/20 active:scale-95 transition-all"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? (t.copied ?? 'คัดลอกแล้ว') : (t.copy ?? 'คัดลอก')}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mt-4 text-xs">
          <button
            type="button"
            onClick={() => extendTTL.mutate({ mailboxId: mailbox.publicId, hours: 24 })}
            disabled={extendTTL.isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.extend ?? 'ยืดเวลา 24 ชม.'}
          </button>
          <button
            type="button"
            onClick={() => deleteMailbox.mutate({ mailboxId: mailbox.publicId })}
            disabled={deleteMailbox.isPending || createMailbox.isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-text-secondary hover:text-red-400 disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t.regenerate ?? 'สร้างใหม่'}
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-text-primary">
            {t.inbox ?? 'กล่องจดหมาย'} ({items.length})
          </h2>
          <button
            type="button"
            onClick={() => utils.mailbox.getMessages.invalidate({ mailboxId: mailbox.publicId })}
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${messages.isFetching ? 'animate-spin' : ''}`} />
            {t.refresh ?? 'รีเฟรช'}
          </button>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-bg-elevated/30 p-10 text-center">
            <Mail className="w-10 h-10 text-text-tertiary mx-auto mb-3 opacity-30" />
            <p className="text-text-secondary text-sm">
              {t.waitingEmail ?? 'กำลังรอรับอีเมล...'}
            </p>
            <p className="text-text-tertiary text-xs mt-1">
              {t.waitingHint ?? 'ส่งอีเมลมาที่ที่อยู่ด้านบนเพื่อเริ่มใช้งาน'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-white/5 bg-bg-elevated/30 hover:bg-bg-elevated/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setSelectedMessageId((s) => (s === m.id ? null : m.id))}
                  className="w-full text-left px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-text-secondary truncate">{m.from}</span>
                    <span className="text-[10px] text-text-tertiary flex-shrink-0">
                      {new Date(m.receivedAt).toLocaleString(locale)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text-primary truncate mt-0.5">
                    {m.subject || t.noSubject || '(ไม่มีหัวเรื่อง)'}
                  </p>
                </button>
                {selectedMessageId === m.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/5">
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-text-primary"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            {a.filename}
                            <span className="text-text-tertiary">
                              ({(a.size / 1024).toFixed(1)} KB)
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
