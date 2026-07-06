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
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

type NavItem = {
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  color: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/platform/dashboard', icon: LayoutDashboard, color: 'text-blue-400' },
  { label: 'Companies', href: '/platform/companies', icon: Building2, color: 'text-violet-400' },
  { label: 'Plans', href: '/platform/plans', icon: Layers3, color: 'text-amber-400' },
  { label: 'Subscriptions', href: '/platform/subscriptions', icon: ReceiptText, color: 'text-emerald-400' },
  { label: 'Billing', href: '/platform/billing', icon: ReceiptText, color: 'text-green-400' },
  { label: 'Feature Control', href: '/platform/feature-control', icon: ToggleLeft, color: 'text-cyan-400' },
  { label: 'Platform Users', href: '/platform/platform-users', icon: Users2, color: 'text-sky-400' },
  { label: 'Roles & Permissions', href: '/platform/roles-permissions', icon: ShieldCheck, color: 'text-indigo-400' },
  { label: 'Support Tickets', href: '/platform/support-tickets', icon: LifeBuoy, color: 'text-rose-400' },
  { label: 'Audit Logs', href: '/platform/audit-logs', icon: ScrollText, color: 'text-orange-400' },
  { label: 'Notifications', href: '/platform/notifications', icon: BellRing, color: 'text-yellow-400' },
  { label: 'Reports', href: '/platform/reports', icon: BarChart3, color: 'text-teal-400' },
  { label: 'Security Center', href: '/platform/security-center', icon: ShieldAlert, color: 'text-red-400' },
  { label: 'Backups', href: '/platform/backups', icon: DatabaseZap, color: 'text-purple-400' },
  { label: 'System Settings', href: '/platform/system-settings', icon: Settings, color: 'text-slate-400' },
];

export function PlatformSidebar() {
  const pathname = usePathname();
  const { user } = usePlatformAuthStore();

  return (
    <aside className="flex h-full w-72 flex-col border-r border-white/10 bg-[linear-gradient(180deg,_rgba(10,17,33,0.98)_0%,_rgba(15,23,42,0.98)_100%)] text-contrast shadow-[28px_0_80px_-64px_rgba(15,23,42,0.7)] backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-brand to-accent shadow-[0_18px_34px_-20px_rgba(37,99,235,0.35)]">
          <Crown className="h-5 w-5 text-contrast" />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-contrast">TaskEasy</p>
          <p className="text-xs text-contrast-60">Platform command center</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-4 rounded-[1.25rem] border border-white/10 bg-white/5 p-4 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-contrast-45">Signed in as</p>
          <p className="mt-2 text-sm font-semibold text-contrast">{user?.name ?? 'Platform Admin'}</p>
          <p className="text-xs text-contrast-60">{user?.email ?? 'platform@taskeasy.com'}</p>
          <div className="mt-3 inline-flex rounded-full bg-success/20 px-2.5 py-1 text-[11px] font-medium text-success-foreground ring-1 ring-inset ring-success/25">
            {user?.role ?? 'PLATFORM_ADMIN'}
          </div>
        </div>

        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200',
                  active
                    ? 'bg-gradient-to-r from-primary/22 to-accent/12 text-contrast ring-1 ring-inset ring-primary/20'
                    : 'text-contrast-65 hover:bg-[rgba(255,255,255,0.1)] hover:text-contrast',
                )}
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0 transition-colors', item.color)} />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
