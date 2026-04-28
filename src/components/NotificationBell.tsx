'use client';

/**
 * Notification bell + dropdown.
 *
 * Polls notification.unreadCount every 30s. Click opens a dropdown listing the
 * 10 most recent notifications; clicking a notification marks it read. A
 * "Mark all read" button + a link to the full /dashboard/notifications page.
 */
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface Props {
  locale: string;
  labels?: {
    title?: string;
    empty?: string;
    markAllRead?: string;
    seeAll?: string;
  };
}

export function NotificationBell({ locale, labels }: Props) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unread = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const list = trpc.notification.list.useQuery(
    { limit: 10, unreadOnly: false },
    { enabled: open }
  );

  const utils = trpc.useUtils();
  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.unreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const count = unread.data?.count ?? 0;
  const items = list.data?.items ?? [];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-brand/5 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-text-secondary" />
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[480px] overflow-hidden rounded-xl border border-white/10 bg-bg-elevated shadow-2xl backdrop-blur-xl z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-text-primary">
              {labels?.title ?? 'Notifications'}
            </h3>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={count === 0 || markAllRead.isPending}
                className="p-1.5 rounded hover:bg-brand/5 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={labels?.markAllRead ?? 'Mark all as read'}
              >
                <CheckCheck className="w-4 h-4 text-text-secondary" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-brand/5"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {list.isLoading ? (
              <div className="p-6 text-center text-sm text-text-secondary">…</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-secondary">
                {labels?.empty ?? 'No notifications yet'}
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.readAt) markRead.mutate({ id: n.id });
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-brand/5 transition-colors ${
                        n.readAt ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.readAt && (
                          <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-brand flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                              {n.body}
                            </p>
                          )}
                          <p className="text-[10px] text-text-tertiary mt-1">
                            {new Date(n.createdAt).toLocaleString(locale)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href={`/${locale}/dashboard/notifications`}
            className="block px-4 py-2.5 text-center text-xs font-medium text-brand hover:bg-brand/5 border-t border-white/5"
            onClick={() => setOpen(false)}
          >
            {labels?.seeAll ?? 'View all notifications'}
          </Link>
        </div>
      )}
    </div>
  );
}
