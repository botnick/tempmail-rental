'use client';

import { useState } from 'react';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface Props {
  locale: string;
  dict: any;
}

export function NotificationsContent({ locale, dict }: Props) {
  const t = dict.notifications;
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const list = trpc.notification.list.useQuery({ limit: 50, cursor, unreadOnly: false });
  const utils = trpc.useUtils();

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });
  const dismiss = trpc.notification.dismiss.useMutation({
    onSuccess: () => {
      utils.notification.list.invalidate();
      utils.notification.unreadCount.invalidate();
    },
  });

  const items = list.data?.items ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Bell className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t.title}</h1>
            <p className="text-sm text-text-secondary">{t.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || items.every((n) => n.readAt)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-brand/5 hover:bg-brand/10 disabled:opacity-40 disabled:cursor-not-allowed text-text-primary"
        >
          <CheckCheck className="w-4 h-4" />
          {t.markAllRead}
        </button>
      </div>

      {list.isLoading ? (
        <div className="rounded-xl border border-white/5 p-12 text-center text-text-secondary">
          {t.loading}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/5 p-12 text-center">
          <Bell className="w-12 h-12 text-text-tertiary mx-auto mb-3 opacity-30" />
          <p className="text-text-secondary">{t.empty}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`group rounded-xl border p-4 flex items-start gap-3 transition-colors ${
                n.readAt
                  ? 'border-white/5 bg-bg-elevated/40'
                  : 'border-brand/20 bg-brand/5'
              }`}
            >
              {!n.readAt && (
                <span className="w-2 h-2 mt-1.5 rounded-full bg-brand flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.readAt ? 'text-text-secondary' : 'text-text-primary font-medium'}`}>
                  {n.title}
                </p>
                {n.body && (
                  <p className="text-xs text-text-tertiary mt-1">{n.body}</p>
                )}
                <p className="text-[10px] text-text-tertiary mt-1.5">
                  {new Date(n.createdAt).toLocaleString(locale)}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!n.readAt && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate({ id: n.id })}
                    className="p-1.5 rounded hover:bg-brand/10"
                    aria-label={t.markRead}
                  >
                    <CheckCheck className="w-4 h-4 text-text-secondary" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => dismiss.mutate({ id: n.id })}
                  className="p-1.5 rounded hover:bg-red-500/10"
                  aria-label={t.delete}
                >
                  <Trash2 className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {list.data?.nextCursor && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setCursor(list.data!.nextCursor)}
            className="px-4 py-2 rounded-lg bg-brand/5 hover:bg-brand/10 text-sm text-text-primary"
          >
            {t.loadMore}
          </button>
        </div>
      )}
    </div>
  );
}
