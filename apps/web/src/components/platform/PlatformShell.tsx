'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformSidebar } from './PlatformSidebar';
import { PlatformHeader } from './PlatformHeader';
import { ImpersonationBanner } from './ImpersonationBanner';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { platformAuthApi } from '@/lib/platform-api';

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const { accessToken, isAuthenticated, hasHydrated, setAccessToken, setUser, logout } = usePlatformAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (accessToken) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    platformAuthApi
      .refresh()
      .then(({ accessToken }) => {
        if (cancelled) return;
        setAccessToken(accessToken);
        return platformAuthApi.me();
      })
      .then((user) => {
        if (!cancelled && user) setUser(user);
      })
      .catch(() => {
        if (cancelled) return;
        logout();
        router.replace('/login?access=platform');
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, hasHydrated, logout, router, setAccessToken, setUser]);

  useEffect(() => {
    if (!hasHydrated || checking) return;
    if (!isAuthenticated) {
      router.replace('/login?access=platform');
    }
  }, [checking, hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center shell-gradient text-foreground">
        <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-muted-foreground backdrop-blur-xl shadow-[0_18px_48px_-34px_rgba(15,23,42,0.18)]">
          Loading platform console...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden shell-gradient text-foreground">
      <PlatformSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PlatformHeader />
        <ImpersonationBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
