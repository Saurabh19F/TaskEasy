import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser, Role } from '@/types';
import { useNotificationStore } from './notification.store';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;

  setAccessToken: (token: string) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;

  // Permission helpers
  hasRole: (...roles: Role[]) => boolean;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      hasHydrated: false,

      setAccessToken: (token) => set({ accessToken: token, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () => {
        // LE-14 fix: reset notification store so previous user's data isn't shown to the next user
        useNotificationStore.getState().reset();
        set({ accessToken: null, user: null, isAuthenticated: false });
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),

      hasRole: (...roles) => {
        const role = get().user?.role;
        return role ? roles.includes(role as Role) : false;
      },

      hasPermission: (permission) => {
        const perms = get().user?.permissions ?? [];
        return perms.includes(permission);
      },

      isAdmin: () => {
        const role = String(get().user?.role ?? '').toUpperCase();
        return ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(role);
      },

      // SEC-10 fix: isSuperAdmin was identical to isAdmin — now correctly checks elevated roles
      isSuperAdmin: () => {
        const role = String(get().user?.role ?? '').toUpperCase();
        return ['SAAS_OWNER', 'COMPANY_OWNER'].includes(role);
      },
    }),
    {
      name: 'taskeasy-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Persist the current session for this browser tab so a hard reload
      // keeps the workspace open. The refresh-token cookie still acts as the
      // long-lived source of truth when the access token expires.
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
