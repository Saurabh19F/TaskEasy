'use client';

import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications, useMarkAllRead, useMarkRead } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/Button';
import { timeAgo, cn } from '@/lib/utils';

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications({ limit: 50 });
  const { mutate: markAllRead, isPending: markingAll } = useMarkAllRead();
  const { mutate: markRead } = useMarkRead();

  const notifications = data?.data ?? [];
  const unread = notifications.filter((n) => !n.isRead);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
          {unread.length > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">
              {unread.length} unread
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <Button variant="ghost" size="sm" leftIcon={<CheckCheck className="h-4 w-4" />}
            loading={markingAll} onClick={() => markAllRead()}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 space-y-2">
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-1/2" />
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markRead(n.id)}
              className={cn(
                'px-5 py-4 transition-colors cursor-pointer',
                !n.isRead
                  ? 'bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
              )}
            >
              <div className="flex items-start gap-3">
                {!n.isRead && (
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0" />
                )}
                <div className={cn('flex-1', n.isRead && 'ml-5')}>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{n.body}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
