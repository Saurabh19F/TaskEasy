import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { getApiError } from '@/lib/axios';

export function useLogin() {
  const router = useRouter();
  const { setAccessToken, setUser } = useAuthStore();

  return useMutation({
    mutationFn: ({ email, password, totpCode }: {
      email: string;
      password: string;
      totpCode?: string;
    }) => authApi.login(email, password, totpCode),

    onSuccess: ({ accessToken, user }) => {
      setAccessToken(accessToken);
      setUser(user);
      toast.success(`Welcome back, ${user.name}!`);
      router.push('/dashboard');
    },

    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      logout();
      qc.clear();
      router.push('/login');
    },
  });
}

export function useMe() {
  const { isAuthenticated, setUser } = useAuthStore();

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const user = await authApi.me();
      setUser(user);
      return user;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: {
      currentPassword: string;
      newPassword: string;
    }) => authApi.changePassword(currentPassword, newPassword),
    onSuccess: () => toast.success('Password changed successfully'),
    onError: (err) => toast.error(getApiError(err)),
  });
}
