import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { useNotificationStore } from '@/store/notification.store';

export function useNotifications(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['notifications', params],
    queryFn: () => notificationsApi.findAll(params),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsApi.getUnreadCount,
    staleTime: 30_000,
    refetchInterval: 60_000,
    meta: { silent: true }, // header bell badge — fails quietly, no toast spam
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      useNotificationStore.getState().markLiveRead(id);
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      useNotificationStore.getState().markAllLiveRead();
    },
  });
}
