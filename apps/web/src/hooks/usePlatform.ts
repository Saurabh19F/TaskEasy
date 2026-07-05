import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  platformAuthApi,
  platformDashboardApi,
  platformCompaniesApi,
  platformPlansApi,
  platformSubscriptionsApi,
  platformBillingApi,
  platformSupportApi,
  platformAuditApi,
  platformUsersApi,
  platformRolesApi,
  platformNotificationsApi,
  platformReportsApi,
  platformSecurityApi,
  platformBackupsApi,
  platformSettingsApi,
} from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

export function usePlatformLogin() {
  const router = useRouter();
  const { setAccessToken, setUser } = usePlatformAuthStore();

  return useMutation({
    mutationFn: ({ email, password, totpCode }: { email: string; password: string; totpCode?: string }) =>
      platformAuthApi.login(email, password, totpCode),
    onSuccess: ({ accessToken, user }) => {
      setAccessToken(accessToken);
      setUser(user);
      toast.success(`Welcome back, ${user.name}!`);
      router.push('/platform/dashboard');
    },
    onError: (err) => toast.error(getPlatformApiError(err)),
  });
}

export function usePlatformLogout() {
  const router = useRouter();
  const { logout } = usePlatformAuthStore();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: platformAuthApi.logout,
    onSettled: () => {
      logout();
      qc.clear();
      router.push('/login?access=platform');
    },
  });
}

export function usePlatformChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      platformAuthApi.changePassword(currentPassword, newPassword),
  });
}

export function usePlatformMe() {
  const { isAuthenticated, setUser } = usePlatformAuthStore();
  return useQuery({
    queryKey: ['platform', 'me'],
    queryFn: async () => {
      const user = await platformAuthApi.me();
      setUser(user);
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

export function usePlatformDashboard() {
  return useQuery({
    queryKey: ['platform', 'dashboard'],
    queryFn: platformDashboardApi.get,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

export function usePlatformCompanies(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['platform', 'companies', params ?? {}],
    queryFn: () => platformCompaniesApi.findAll(params),
    staleTime: 60_000,
  });
}

export function usePlatformCompany(id: string) {
  return useQuery({
    queryKey: ['platform', 'company', id],
    queryFn: () => platformCompaniesApi.findOne(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function usePlatformPlans() {
  return useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: platformPlansApi.findAll,
  });
}

export function usePlatformSubscriptions() {
  return useQuery({
    queryKey: ['platform', 'subscriptions'],
    queryFn: platformSubscriptionsApi.findAll,
  });
}

export function usePlatformBilling() {
  return useQuery({
    queryKey: ['platform', 'billing'],
    queryFn: async () => ({
      invoices: await platformBillingApi.invoices.findAll(),
      revenueSummary: await platformBillingApi.revenueSummary(),
      payments: await platformBillingApi.payments(),
    }),
  });
}

export function usePlatformTickets() {
  return useQuery({
    queryKey: ['platform', 'tickets'],
    queryFn: async () => ({
      tickets: await platformSupportApi.tickets.findAll(),
      stats: await platformSupportApi.stats(),
    }),
  });
}

export function usePlatformAuditLogs(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['platform', 'audit-logs', params ?? {}],
    queryFn: () => platformAuditApi.findAll(params),
  });
}

export function usePlatformUsers() {
  return useQuery({
    queryKey: ['platform', 'users'],
    queryFn: platformUsersApi.findAll,
  });
}

export function usePlatformRoles() {
  return useQuery({
    queryKey: ['platform', 'roles'],
    queryFn: platformRolesApi.findAll,
  });
}

export function usePlatformNotifications() {
  return useQuery({
    queryKey: ['platform', 'notifications'],
    queryFn: platformNotificationsApi.findAll,
  });
}

export function usePlatformReports(type: 'revenue' | 'companies' | 'subscriptions' | 'users', params?: Record<string, any>) {
  return useQuery({
    queryKey: ['platform', 'reports', type, params ?? {}],
    queryFn: () => platformReportsApi[type](params),
  });
}

export function usePlatformSecurityCenter() {
  return useQuery({
    queryKey: ['platform', 'security-center'],
    queryFn: platformSecurityApi.get,
  });
}

export function usePlatformBackups() {
  return useQuery({
    queryKey: ['platform', 'backups'],
    queryFn: platformBackupsApi.findAll,
  });
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform', 'settings'],
    queryFn: platformSettingsApi.get,
  });
}
