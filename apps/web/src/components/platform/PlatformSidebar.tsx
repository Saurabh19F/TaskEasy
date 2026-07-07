'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Layers3,
  ReceiptText,
  ToggleLeft,
  Users2,
  ShieldCheck,
  LifeBuoy,
  ScrollText,
  BellRing,
  BarChart3,
  ShieldAlert,
  DatabaseZap,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { LogoIcon } from '@/components/layout/Logo';

type NavItem = {
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/platform/dashboard', icon: LayoutDashboard },
  { label: 'Companies', href: '/platform/companies', icon: Building2 },
  { label: 'Plans', href: '/platform/plans', icon: Layers3 },
  { label: 'Subscriptions', href: '/platform/subscriptions', icon: ReceiptText },
  { label: 'Billing', href: '/platform/billing', icon: ReceiptText },
  { label: 'Feature Control', href: '/platform/feature-control', icon: ToggleLeft },
  { label: 'Platform Users', href: '/platform/platform-users', icon: Users2 },
  { label: 'Roles & Permissions', href: '/platform/roles-permissions', icon: ShieldCheck },
  { label: 'Support Tickets', href: '/platform/support-tickets', icon: LifeBuoy },
  { label: 'Audit Logs', href: '/platform/audit-logs', icon: ScrollText },
  { label: 'Notifications', href: '/platform/notifications', icon: BellRing },
  { label: 'Reports', href: '/platform/reports', icon: BarChart3 },
  { label: 'Security Center', href: '/platform/security-center', icon: ShieldAlert },
  { label: 'Backups', href: '/platform/backups', icon: DatabaseZap },
  { label: 'System Settings', href: '/platform/system-settings', icon: Settings },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const { user } = usePlatformAuthStore();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-white/8 bg-[#0f172a]">
      <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-4">
        <LogoIcon className="h-7 w-7 flex-shrink-0 text-blue-400" />
        <div>
          <p className="text-sm font-semibold tracking-tight text-contrast">TaskEasy</p>
          <p className="text-[11px] text-contrast-55">Platform</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="mb-3 rounded-md border border-white/8 bg-white/5 px-3 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-contrast-45">Signed in as</p>
          <p className="mt-1.5 text-sm font-medium text-contrast">{user?.name ?? 'Platform Admin'}</p>
          <p className="text-xs text-contrast-55">{user?.email ?? 'platform@taskeasy.com'}</p>
          <span className="mt-2 inline-flex rounded bg-white/10 px-2 py-0.5 text-[11px] font-medium text-contrast-70">
            {user?.role ?? 'PLATFORM_ADMIN'}
          </span>
        </div>

        <div className="space-y-px">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100',
                  active
                    ? 'bg-white/12 text-contrast'
                    : 'text-contrast-55 hover:bg-white/8 hover:text-contrast-80',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
