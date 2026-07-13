'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu, Bell, ChevronDown, User, Key, LogOut,
  Plus, Search, Briefcase, FolderKanban, Users, ListTodo, Sun, Moon,
} from 'lucide-react';
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

  const [searchValue, setSearchValue] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const quickRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const { mutate: logout } = useLogout();

  const unreadCount = useNotificationStore((s) => s.unreadCount);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(prefersDark);
    document.documentElement.classList.toggle('dark', prefersDark);
    document.documentElement.classList.toggle('light', !prefersDark);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.classList.toggle('light', !next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

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

  const iconBtn =
    'inline-flex items-center justify-center rounded-md border border-border bg-surface p-2 text-muted-foreground transition-colors duration-100 hover:bg-surface-muted hover:text-foreground';

  const dropdownPanel =
    'absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-lg';

  const dropdownHeader =
    'border-b border-border bg-surface-muted px-4 py-3';

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur-sm">
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <button onClick={onToggleSidebar} className={iconBtn} aria-label="Toggle sidebar">
            <Menu className="h-5 w-5" />
          </button>

          {/* Breadcrumb */}
          <div className="hidden min-w-0 flex-col lg:flex">
            <nav className="flex flex-wrap items-center gap-1.5 text-sm">
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
                    router.push(`/reports?q=${encodeURIComponent(searchValue)}`);
                  }
                }}
                placeholder="Search tasks, people, projects…"
                className="w-full rounded-md border border-border bg-surface-muted py-1.5 pl-9 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-surface focus:ring-1 focus:ring-primary/10"
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
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-contrast transition-colors duration-100 hover:bg-primary/90"
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
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick actions</p>
                  </div>
                  <div className="p-1.5">
                    {QUICK_ACTIONS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setQuickOpen(false)}
                          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <button onClick={toggleTheme} className={iconBtn} aria-label="Toggle dark mode">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Notifications */}
            <button
              onClick={() => setDrawerOpen(true)}
              className={cn(iconBtn, 'relative')}
            aria-label="Open notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-contrast">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 transition-colors duration-100 hover:bg-surface-muted"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-contrast">
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
              )}
              <span className="hidden max-w-[110px] truncate text-sm font-medium text-foreground sm:block">
                {user?.name}
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
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
                    <div className="flex items-center gap-2.5">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-contrast">
                          {user?.name?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <span className="mt-2 inline-flex items-center rounded bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground border border-border">
                      {user?.role}
                    </span>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { setProfileOpen(false); router.push('/settings/profile'); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
                    >
                      <User className="h-4 w-4 text-muted-foreground" /> Profile
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); router.push('/settings/security'); }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
                    >
                      <Key className="h-4 w-4 text-muted-foreground" /> Change Password
                    </button>
                    <div className="mt-1 border-t border-border pt-1">
                      <button
                        onClick={() => logout()}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/5"
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
