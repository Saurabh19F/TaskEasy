'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { authApi, notificationsApi, securitySettingsApi } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useNotificationStore } from '@/store/notification.store';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { AiAssistantWidget } from '@/components/ai/AiAssistantWidget';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileNavOpen((o) => !o);
    } else {
      setSidebarCollapsed((c) => !c);
    }
  };
  const router = useRouter();
  const { accessToken, isAuthenticated, hasHydrated, user, setAccessToken, setUser, logout } = useAuthStore();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  // FE-03 fix: ensure refresh is attempted at most once per page load.
  // Without this guard, setting accessToken inside the effect re-triggers the
  // effect (accessToken is a dep), causing a second unnecessary refresh call.
  const hasAttemptedRefresh = useRef(false);

  useSocket();

  useEffect(() => {
    if (!hasHydrated) return;

    // Already have a valid token — nothing to do
    if (accessToken) {
      setIsCheckingSession(false);
      return;
    }

    // Only attempt refresh once per mount
    if (hasAttemptedRefresh.current) return;
    hasAttemptedRefresh.current = true;

    let cancelled = false;
    setIsCheckingSession(true);
    authApi
      .refresh()
      .then(({ accessToken: newToken }) => {
        if (cancelled) return;
        setAccessToken(newToken);
        return authApi.me();
      })
      .then((userData) => {
        if (userData) setUser(userData);
      })
      .catch(() => {
        if (cancelled) return;
        logout();
        router.replace('/login');
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // accessToken intentionally excluded — hasAttemptedRefresh guards re-entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, router, setAccessToken, setUser, logout]);

  useEffect(() => {
    if (!hasHydrated || isCheckingSession) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [hasHydrated, isCheckingSession, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    notificationsApi.getUnreadCount()
      .then((count) => setUnreadCount(count))
      .catch(() => {/* non-critical */});
  }, [isAuthenticated, setUnreadCount]);

  const { data: secSettings } = useQuery({
    queryKey: ['security-settings'],
    queryFn: securitySettingsApi.get,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  useIdleTimeout(
    secSettings?.sessionTimeoutMinutes ?? 30,
    !!(secSettings?.sessionTimeoutEnabled && isAuthenticated),
    () => {
      logout();
      router.replace('/login?reason=timeout');
    },
  );

  if (!hasHydrated || isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="rounded-lg border border-border bg-surface px-5 py-4 text-sm text-muted-foreground">
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onToggleSidebar={handleToggleSidebar} />
        <main id="main-content" className="relative flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <AiAssistantWidget />
    </div>
  );
}
