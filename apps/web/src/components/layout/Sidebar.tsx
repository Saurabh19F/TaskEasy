'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, CheckSquare, Briefcase,
  GitBranch, CheckCircle, BarChart3, FileText, Bell,
  Settings, Users, CalendarDays,
  Zap, Shield, FolderKanban, Kanban, X, Sparkles,
  FileSpreadsheet, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useNotificationCounts } from '@/hooks/useDashboard';

interface NavItem {
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  roles?: string[];
  countKey?: keyof import('@/types').NotificationCounts;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Delegation', href: '/delegation', icon: ClipboardList, countKey: 'delegation' },
      { label: 'Kanban', href: '/kanban', icon: Kanban },
      { label: 'Work Requests', href: '/work-requests', icon: Briefcase, countKey: 'workRequest' },
      { label: 'Checklists', href: '/checklist', icon: CheckSquare, countKey: 'checklist' },
      { label: 'FMS System', href: '/fms', icon: GitBranch, countKey: 'fms' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Approve / Review', href: '/approvals', icon: CheckCircle, roles: ['ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE', 'VIEWER'], countKey: 'approval' },
      { label: 'MIS', href: '/mis', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
      { label: 'Predictive AI', href: '/predictive', icon: TrendingUp, roles: ['ADMIN', 'MANAGER'] },
      { label: 'Reports', href: '/reports', icon: FileText, roles: ['ADMIN', 'MANAGER'] },
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Calendar', href: '/calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Projects', href: '/projects', icon: FolderKanban, roles: ['ADMIN', 'MANAGER'] },
      { label: 'Users', href: '/users', icon: Users, roles: ['ADMIN'] },
      { label: 'Automation', href: '/automation', icon: Zap, roles: ['ADMIN'] },
      { label: 'Import / Export', href: '/import-export', icon: FileSpreadsheet, roles: ['ADMIN'] },
      { label: 'Audit Logs', href: '/audit-logs', icon: Shield, roles: ['ADMIN', 'AUDITOR'] },
      { label: 'Set Hierarchy', href: '/hierarchy', icon: Users, roles: ['ADMIN'] },
      { label: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] },
      { label: 'Admin Panel', href: '/admin', icon: Settings, roles: ['ADMIN'] },
    ],
  },
];

const roleMatches = (userRole: string | undefined, allowedRoles?: string[]) => {
  if (!allowedRoles) return true;
  const role = String(userRole ?? '').toUpperCase();
  if (['SAAS_OWNER', 'COMPANY_OWNER'].includes(role)) return true;
  return allowedRoles.includes(role);
};

const approvalLabelForRole = (userRole?: string) => {
  const role = String(userRole ?? '').toUpperCase();
  return ['ADMIN', 'MANAGER', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(role)
    ? 'Approve / Review'
    : 'Track Status';
};

interface SidebarProps {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ collapsed = false, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { data: counts } = useNotificationCounts();

  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => roleMatches(user?.role, item.roles))
        .map((item) => (
          item.href === '/approvals'
            ? { ...item, label: approvalLabelForRole(user?.role) }
            : item
        )),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full flex-col text-sidebar',
          'border-r border-slate-200 bg-white shadow-[4px_0_24px_-8px_rgba(15,23,42,0.08)]',
          'transition-all duration-300 lg:static lg:z-auto',
          collapsed ? 'w-20 lg:w-20' : 'w-[260px] lg:w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 border-b border-slate-200 px-5 py-5',
        )}>
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl shadow-[0_18px_34px_-20px_rgba(37,99,235,0.6)]"
            style={{ background: 'linear-gradient(135deg, #2563EB 0%, #0EA5E9 60%, #10B981 100%)' }}
          >
            <Sparkles className="h-5 w-5 text-contrast" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display, inherit)' }}>
                TaskEasy
              </span>
              <span className="block text-[11px] font-medium text-slate-500">
                Workflow Platform
              </span>
            </div>
          )}
          <button
            onClick={onMobileClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const count = item.countKey ? (counts?.[item.countKey] ?? 0) : 0;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onMobileClose?.()}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-150',
                        isActive
                          ? 'text-contrast shadow-[0_16px_32px_-20px_rgba(37,99,235,0.7)]'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                      style={
                        isActive
                          ? { background: 'linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)', color: 'white' }
                          : undefined
                      }
                    >
                      <div className="relative flex-shrink-0">
                        <Icon className={cn(
                          'h-[18px] w-[18px]',
                          isActive ? 'text-contrast' : 'text-slate-400 group-hover:text-slate-600',
                        )} />
                        {count > 0 && (
                          <span
                            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-contrast"
                            style={{ background: isActive ? 'rgba(255,255,255,0.22)' : 'linear-gradient(135deg,#2563EB,#10B981)' }}
                          >
                            {count > 9 ? '9+' : count}
                          </span>
                        )}
                      </div>
                      {!collapsed && (
                        <span className={cn(
                          'flex-1 text-[13px] font-medium',
                          isActive ? 'text-contrast' : 'text-slate-600 group-hover:text-slate-900',
                        )}>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

      </aside>
    </>
  );
}
