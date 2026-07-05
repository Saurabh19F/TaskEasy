import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export function useDashboard(view: 'team' | 'my' = 'team') {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  const enabled = hasHydrated && isAuthenticated && !!user?.tenantId;

  return useQuery({
    queryKey: ['dashboard', view],
    queryFn: () => dashboardApi.get(view),
    enabled,
    staleTime: 2 * 60_000, // 2 min — dashboard changes frequently
    refetchInterval: 5 * 60_000, // auto-refresh every 5 min
  });
}

export function useNotificationCounts() {
  const { hasHydrated, isAuthenticated, user } = useAuthStore();
  const enabled = hasHydrated && isAuthenticated && !!user?.tenantId;

  return useQuery({
    queryKey: ['dashboard', 'notification-counts'],
    queryFn: dashboardApi.notificationCounts,
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
    meta: { silent: true }, // sidebar badge — fails quietly, no toast spam
  });
}
