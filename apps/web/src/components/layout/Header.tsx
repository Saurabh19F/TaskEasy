'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu, RefreshCw, Bell, ChevronDown, User, Key, LogOut,
  Plus, Search, Briefcase, FolderKanban, Users, ListTodo, Sparkles,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationStore } from '@/store/notification.store';
import { useLogout } from '@/hooks/useAuth';
import { NotificationDrawer } from '@/components/notifications/NotificationDrawer';

interface HeaderProps {
  onToggleSidebar: () => void;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  delegation: 'Delegation',
  'work-requests': 'Work Requests',
  checklist: 'Checklists',
  fms: 'FMS System',
  approvals: 'Approve / Review',
  mis: 'MIS',
  reports: 'Reports',
  projects: 'Projects',
  users: 'Users',
  notifications: 'Notifications',
  automation: 'Automation',
  'audit-logs': 'Audit Logs',
  hierarchy: 'Set Hierarchy',
  settings: 'Settings',
  admin: 'Admin Panel',
  calendar: 'Calendar',
  kanban: 'Kanban',
};

const QUICK_ACTIONS = [
  { label: 'Add Task', href: '/delegation', icon: ListTodo },
  { label: 'Create Project', href: '/projects', icon: FolderKanban },
  { label: 'Add Employee', href: '/users', icon: Users },
  { label: 'Open Reports', href: '/reports', icon: Briefcase },
];

function deriveCrumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  return parts.map((part, index) => ({
    label: ROUTE_LABELS[part] ?? part.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    href: `/${parts.slice(0, index + 1).join('/')}`,
  }));
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { mutate: logout } = useLogout();

  const unreadCount = useNotificationStore((s) => s.unreadCount);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (quickRef.current && !quickRef.current.contains(target)) {
        setQuickOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const crumbs = useMemo(() => deriveCrumbs(pathname), [pathname]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries();
    setTimeout(() => setRefreshing(false), 800);
  };

  const iconBtn =
    'inline-flex items-center justify-center rounded-xl border border-border bg-surface px-3 py-2.5 text-muted-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/5 hover:text-primary hover:shadow-[0_4px_16px_-4px_rgba(37,99,235,0.22)]';

  const dropdownPanel =
    'absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_54px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(37,99,235,0.08)]';

  const dropdownHeader =
    'border-b border-border bg-gradient-to-r from-primary/5 to-accent/5 px-4 py-3';

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-[64px] flex-shrink-0 items-center gap-3 border-b border-border/60 bg-[rgba(255,255,255,0.88)] px-4 py-3 backdrop-blur-xl"
        style={{ boxShadow: '0 1px 0 rgba(226,232,240,0.9), 0 2px 12px -4px rgba(15,23,42,0.06)' }}
      >
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <button onClick={onToggleSidebar} className={iconBtn} aria-label="Toggle sidebar">
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="hidden min-w-0 flex-col lg:flex">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary/70" />
              <span className="section-label">Workspace</span>
            </div>
            <nav className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
              <Link href="/dashboard" className="font-semibold text-foreground/80 hover:text-primary transition-colors">
                Home
              </Link>
              {crumbs.length > 0 && (
                <>
                  <span className="text-border">/</span>
                  {crumbs.map((crumb, index) => (
                    <div key={crumb.href} className="flex items-center gap-1.5">
                      <Link
                        href={crumb.href}
                        className={cn(
                          'truncate font-medium transition-colors hover:text-primary',
                          index === crumbs.length - 1 ? 'text-primary font-semibold' : 'text-muted-foreground',
                        )}
                      >
                        {crumb.label}
                      </Link>
                      {index < crumbs.length - 1 && <span className="text-border">/</span>}
                    </div>
                  ))}
                </>
              )}
            </nav>
          </div>

          {/* Search */}
          <div className="hidden flex-1 max-w-xl lg:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchValue.trim()) {
                    router.push('/reports');
                  }
                }}
                placeholder="Search tasks, people, projects…"
                className="w-full rounded-xl border border-border bg-surface/85 py-2.5 pl-10 pr-4 text-sm text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/45 focus:bg-surface focus:ring-2 focus:ring-primary/10 hover:border-primary/25"
              />
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Quick add */}
          <div ref={quickRef} className="relative">
            <button
              onClick={() => setQuickOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2 text-sm font-medium text-primary shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/12 hover:shadow-[0_4px_16px_-4px_rgba(37,99,235,0.28)]"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Quick add</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>

            <AnimatePresence>
              {quickOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className={dropdownPanel}
                >
                  <div className={dropdownHeader}>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Quick actions</p>
                  </div>
                  <div className="p-1.5">
                    {QUICK_ACTIONS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setQuickOpen(false)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground/80 transition-all hover:bg-primary/6 hover:text-primary"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </span>
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button onClick={handleRefresh} className={iconBtn} aria-label="Refresh data">
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>

          {/* Notifications */}
            <button
              onClick={() => setDrawerOpen(true)}
              className={cn(iconBtn, 'relative')}
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span
              className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-contrast shadow-[0_2px_8px_-2px_rgba(37,99,235,0.45)]"
                style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-2.5 py-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_4px_16px_-4px_rgba(37,99,235,0.20)]"
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-contrast shadow-[0_4px_12px_-4px_rgba(37,99,235,0.45)]"
                style={{ background: 'linear-gradient(135deg, #2563EB 0%, #10B981 100%)' }}
              >
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <span className="hidden max-w-[110px] truncate text-sm font-medium text-foreground/85 sm:block">
                {user?.name}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground/60 sm:block" />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className={dropdownPanel}
                >
                  <div className={dropdownHeader}>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold text-contrast shadow-[0_4px_12px_-4px_rgba(37,99,235,0.45)]"
                        style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}
                      >
                        {user?.name?.[0]?.toUpperCase() ?? 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <span className="mt-2.5 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      {user?.role}
                    </span>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); router.push('/settings/profile'); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground/80 transition-all hover:bg-primary/6 hover:text-primary"
                    >
                      <User className="h-4 w-4" /> Profile
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); router.push('/settings/security'); }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground/80 transition-all hover:bg-primary/6 hover:text-primary"
                    >
                      <Key className="h-4 w-4" /> Change Password
                    </button>
                    <div className="mt-1 border-t border-border pt-1">
                      <button
                        onClick={() => logout()}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger transition-all hover:bg-danger/8"
                      >
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <NotificationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
