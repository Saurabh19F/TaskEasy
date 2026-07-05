'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Bell, X, CheckCheck, ExternalLink, Info, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNotificationStore, WsNotification } from '@/store/notification.store';
import { useNotifications, useMarkAllRead } from '@/hooks/useNotifications';
import { notificationsApi } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  TASK_ASSIGNED:         { icon: <Clock className="h-4 w-4" />,        color: 'text-primary bg-primary/10' },
  APPROVAL_PENDING:      { icon: <AlertCircle className="h-4 w-4" />,  color: 'text-warning-foreground bg-warning/25' },
  TASK_COMPLETED:        { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-success-foreground bg-success/22' },
  REWORK_REQUESTED:      { icon: <AlertCircle className="h-4 w-4" />,  color: 'text-brand bg-brand/10' },
  REWORK_RESUBMITTED:    { icon: <Clock className="h-4 w-4" />,        color: 'text-accent bg-accent/12' },
  WORK_REQUEST_ASSIGNED: { icon: <Info className="h-4 w-4" />,         color: 'text-primary bg-primary/10' },
  CHECKLIST_ASSIGNED:    { icon: <Info className="h-4 w-4" />,         color: 'text-accent bg-accent/12' },
  FMS_STEP_ASSIGNED:     { icon: <Info className="h-4 w-4" />,         color: 'text-accent bg-accent/12' },
  DEFAULT:               { icon: <Bell className="h-4 w-4" />,         color: 'text-foreground bg-surface-muted' },
};

function typeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.DEFAULT;
}

function buildLink(refType?: string, refId?: string) {
  if (!refType || !refId) return null;
  const map: Record<string, string> = {
    DELEGATION:   '/delegation?id=' + refId,
    WORK_REQUEST: '/work-requests?id=' + refId,
    CHECKLIST:    '/checklist?id=' + refId,
    FMS:          '/fms?id=' + refId,
  };
  return map[refType] ?? null;
}

function NotifRow({ n, onRead }: { n: WsNotification; onRead: (id: string) => void }) {
  const { icon, color } = typeConfig(n.type);
  const link = buildLink(n.refType, n.refId);
  return (
    <div className={cn('flex gap-3 border-b border-border px-4 py-3 transition-colors', !n.isRead && 'bg-primary/5', 'hover:bg-surface-muted/70')}>
      <div className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full', color)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', !n.isRead ? 'font-semibold text-foreground' : 'text-foreground/80')}>
          {n.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
        </p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {!n.isRead && (
          <button onClick={() => onRead(n.id)} className="mt-1 h-2 w-2 rounded-full bg-primary" title="Mark as read" />
        )}
        {link && (
          <a href={link} className="mt-1 text-muted-foreground hover:text-primary" title="Open">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const liveItems = useNotificationStore((s) => s.liveItems);
  const markLiveRead = useNotificationStore((s) => s.markLiveRead);
  const markAllLiveRead = useNotificationStore((s) => s.markAllLiveRead);
  const { mutate: markAllRead } = useMarkAllRead();
  const qc = useQueryClient();

  // Fetch historical notifications from API when drawer opens
  const { data: apiData, isLoading } = useNotifications({ limit: 20 });

  // Merge live (WebSocket) and historical, deduplicate by id, sort newest first
  const items = useMemo<WsNotification[]>(() => {
    const apiItems: WsNotification[] = (apiData?.data ?? []).map((n: any) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      refType: n.refType,
      refId: n.refId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
    const seen = new Set<string>();
    return [...liveItems, ...apiItems]
      .filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [liveItems, apiData]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleMarkRead = async (id: string) => {
    markLiveRead(id);
    await notificationsApi.markRead(id);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const handleMarkAll = () => {
    markAllLiveRead();
    markAllRead();
  };

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ background: 'rgba(2,6,23,0.35)', backdropFilter: 'blur(2px)' }} onClick={onClose} />}
      <div
        ref={drawerRef}
        className={cn('fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-border bg-surface shadow-[0_40px_100px_-56px_rgba(15,23,42,0.85)] transition-transform duration-300 ease-in-out', open ? 'translate-x-0' : 'translate-x-full')}
      >
        <div className="flex items-center justify-between border-b border-border bg-surface-strong px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Notifications</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-contrast">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={handleMarkAll} className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-accent">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
            <button onClick={onClose} className="rounded-xl p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="mb-3 h-8 w-8 animate-spin opacity-40" />
              <p className="text-sm">Loading…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-muted-foreground">
              <Bell className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            items.map((n) => <NotifRow key={n.id} n={n} onRead={handleMarkRead} />)
          )}
        </div>

        <div className="border-t border-border bg-surface-strong px-4 py-3">
          <a href="/notifications" className="block w-full text-center text-sm font-semibold text-primary hover:text-accent" onClick={onClose}>
            View all notifications →
          </a>
        </div>
      </div>
    </>
  );
}
