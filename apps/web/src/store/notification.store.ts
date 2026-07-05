import { create } from 'zustand';

export interface WsNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  refId?: string;
  refType?: string;
  createdAt: string;
  isRead: boolean;
}

interface NotificationState {
  /** Live notifications pushed via WebSocket (most recent first, capped at 50) */
  liveItems: WsNotification[];
  unreadCount: number;

  setUnreadCount: (count: number) => void;
  addLiveNotification: (n: WsNotification) => void;
  markLiveRead: (id: string) => void;
  markAllLiveRead: () => void;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  liveItems: [],
  unreadCount: 0,

  setUnreadCount: (count) => set({ unreadCount: count }),

  addLiveNotification: (n) =>
    set((s) => ({
      liveItems: [n, ...s.liveItems].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    })),

  markLiveRead: (id) =>
    set((s) => ({
      liveItems: s.liveItems.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
      unreadCount: Math.max(0, s.unreadCount - (s.liveItems.find((n) => n.id === id && !n.isRead) ? 1 : 0)),
    })),

  markAllLiveRead: () =>
    set((s) => ({
      liveItems: s.liveItems.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    })),

  increment: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
  decrement: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
  reset: () => set({ liveItems: [], unreadCount: 0 }),
}));
