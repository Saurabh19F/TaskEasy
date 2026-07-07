'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, CheckSquare, Briefcase,
  GitBranch, CheckCircle, BarChart3, FileText, Bell,
  Settings, Users, CalendarDays,
  Zap, Shield, FolderKanban, Kanban, X,
  FileSpreadsheet, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { Logo, LogoIcon } from '@/components/layout/Logo';
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
          className="fixed inset-0 z-40 bg-black/30 animate-fade-in lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full flex-col',
          'border-r border-border bg-surface',
          'transition-all duration-200 lg:static lg:z-auto',
          collapsed ? 'w-[68px] lg:w-[68px]' : 'w-[252px] lg:w-[252px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
          {collapsed ? (
            <LogoIcon className="h-8 w-8 flex-shrink-0 text-primary" />
          ) : (
            <Logo size="sm" />
          )}
          <button
            onClick={onMobileClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              <div className="space-y-px">
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
                        'group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <Icon className={cn(
                          'h-4 w-4',
                          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                        )} />
                        {count > 0 && (
                          <span className={cn(
                            'absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-semibold',
                            isActive
                              ? 'bg-primary text-contrast'
                              : 'bg-danger text-contrast',
                          )}>
                            {count > 9 ? '9+' : count}
                          </span>
                        )}
                      </div>
                      {!collapsed && (
                        <span className="flex-1 truncate">
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
