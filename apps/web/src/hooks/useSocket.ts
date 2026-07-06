'use client';

import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore, WsNotification } from '@/store/notification.store';
import { getWsBaseUrl } from '@/lib/runtime-config';

const WS_URL = getWsBaseUrl();

// FE-05 fix: module-level singleton, BUT we check token staleness before reusing it.
// On token refresh the old socket is disconnected and a new one is created with the new token.
let socketInstance: Socket | null = null;
let socketToken: string | null = null; // tracks which token the current socketInstance used

/**
 * Manages a single shared Socket.IO connection tied to the user session.
 * Call this once inside the app shell layout — it's safe to call multiple
 * times (subsequent calls are no-ops while connected).
 *
 * Events handled:
 *   notification:new  → adds to notification store, increments unread count
 *   task:updated      → can be extended to invalidate TanStack Query caches
 */
export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addLiveNotification = useNotificationStore((s) => s.addLiveNotification);
  // FE-05 fix: use state (not ref) so components re-render when connection status changes
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Disconnect and clean up when logged out
    if (!isAuthenticated || !accessToken) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        socketToken = null;
        setIsConnected(false);
      }
      return;
    }

    // FE-05 fix: if accessToken changed (refresh), disconnect old socket and reconnect with new token
    if (socketInstance?.connected && socketToken === accessToken) return;
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
      socketToken = null;
    }

    socketInstance = io(`${WS_URL}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketToken = accessToken;

    socketInstance.on('connect', () => {
      setIsConnected(true);
      if (process.env.NODE_ENV === 'development') {
        console.log('[Socket] Connected:', socketInstance?.id);
      }
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      if (process.env.NODE_ENV === 'development') {
        console.log('[Socket] Disconnected:', reason);
      }
    });

    socketInstance.on('connect_error', (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Socket] Connection error:', err.message);
      }
    });

    // ── Event handlers ──────────────────────────────────────────────────────

    socketInstance.on('notification:new', (payload: WsNotification) => {
      addLiveNotification({
        ...payload,
        isRead: false,
        createdAt: payload.createdAt ?? new Date().toISOString(),
      });
    });

    // task:updated is emitted but UI can subscribe separately via useTaskSocket
    socketInstance.on('error', (data: { message: string }) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Socket] Server error:', data.message);
      }
    });

    return () => {
      // Keep the socket alive across route changes; only disconnect on logout
      // (handled above when isAuthenticated becomes false)
    };
  }, [isAuthenticated, accessToken, addLiveNotification]);

  return {
    isConnected,
    socket: socketInstance,
  };
}

/**
 * Subscribe to task:updated events for a specific task ID.
 * Useful inside task detail pages to get live status changes.
 *
 * FE-06 fix: onUpdate is stored in a ref so inline arrow functions from the parent
 * don't cause the effect to re-run (and re-register the listener) on every render.
 */
export function useTaskSocket(taskId: string | undefined, onUpdate: (payload: any) => void) {
  // Always hold the latest callback without re-subscribing
  const onUpdateRef = useRef(onUpdate);
  useLayoutEffect(() => { onUpdateRef.current = onUpdate; });

  useEffect(() => {
    if (!taskId || !socketInstance) return;

    const handler = (payload: any) => {
      if (payload.taskId === taskId) onUpdateRef.current(payload);
    };

    socketInstance.on('task:updated', handler);
    return () => { socketInstance?.off('task:updated', handler); };
    // onUpdate deliberately excluded from deps — ref keeps it current
  }, [taskId]);
}
