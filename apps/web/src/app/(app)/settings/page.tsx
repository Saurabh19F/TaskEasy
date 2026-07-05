'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Settings, Building2, Shield } from 'lucide-react';
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
        <Settings className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Settings</h1>
      </div>

      <div className="space-y-3">
        {SETTING_SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group"
          >
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors">
              <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
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
