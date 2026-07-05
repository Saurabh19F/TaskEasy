import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PlatformAuthUser, PlatformRole } from '@/types';

export interface PlatformImpersonationState {
  sessionId: string;
  companyId: string;
  companyName: string;
  targetUser?: { id: string; name: string; email: string; role: string } | null;
  banner: string;
  accessToken?: string;
  refreshToken?: string;
}

interface PlatformAuthState {
  accessToken: string | null;
  user: PlatformAuthUser | null;
  impersonation: PlatformImpersonationState | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;

  setAccessToken: (token: string) => void;
  setUser: (user: PlatformAuthUser) => void;
  setImpersonation: (state: PlatformImpersonationState | null) => void;
  clearImpersonation: () => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;

  hasRole: (...roles: PlatformRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  isPlatformAdmin: () => boolean;
}

export const usePlatformAuthStore = create<PlatformAuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      impersonation: null,
      isAuthenticated: false,
      hasHydrated: false,

      setAccessToken: (token) => set({ accessToken: token, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      setImpersonation: (impersonation) => set({ impersonation }),
      clearImpersonation: () => set({ impersonation: null }),
      logout: () => set({ accessToken: null, user: null, impersonation: null, isAuthenticated: false }),
      setHasHydrated: (value) => set({ hasHydrated: value }),

      hasRole: (...roles) => {
        const role = get().user?.role;
        return role ? roles.includes(role as PlatformRole) : false;
      },

      hasPermission: (permission) => {
        const perms = get().user?.permissions ?? [];
        return perms.includes(permission);
      },

      isPlatformAdmin: () => String(get().user?.role ?? '').toUpperCase() === 'PLATFORM_ADMIN',
    }),
    {
      name: 'taskeasy-platform-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        impersonation: state.impersonation
          ? { ...state.impersonation, accessToken: undefined, refreshToken: undefined }
          : null,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
