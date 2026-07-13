'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, Building2, Shield, Users, FolderKanban, CreditCard } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

const SETTING_SECTIONS = [
  {
    href: '/settings/company',
    icon: Building2,
    title: 'Company Settings',
    description: 'Working days, holidays, timezone, and company profile.',
  },
  {
    href: '/settings/security',
    icon: Shield,
    title: 'Security',
    description: 'Password policy, two-factor authentication, and active sessions.',
  },
  {
    href: '/settings/subscriptions',
    icon: CreditCard,
    title: 'Subscriptions',
    description: 'Manage your plan, user limits, and FMS limits.',
  },
  {
    href: '/admin',
    icon: Users,
    title: 'Admin Panel',
    description: 'Manage users, projects, roles, and employee accounts.',
  },
];

const ALLOWED_ROLES = ['ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER'];

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  // SEC-09 fix: only admins may access company settings
  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      <div className="space-y-3">
        {SETTING_SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted transition-colors group"
          >
            <div className="h-9 w-9 rounded-md bg-surface-muted flex items-center justify-center flex-shrink-0 group-hover:bg-surface transition-colors border border-border">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-200">{title}</p>
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
