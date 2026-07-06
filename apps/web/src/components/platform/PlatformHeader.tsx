'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Command, Eye, EyeOff, LogOut, LockKeyhole, RefreshCw, Search, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { usePlatformChangePassword, usePlatformLogout } from '@/hooks/usePlatform';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { platformNotificationsApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import toast from 'react-hot-toast';

export function PlatformHeader() {
  const [refreshing, setRefreshing] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const qc = useQueryClient();
  const { user } = usePlatformAuthStore();
  const router = useRouter();
  const { mutate: logout } = usePlatformLogout();
  const { mutateAsync: changePassword, isPending: isChangingPassword } = usePlatformChangePassword();

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['platform'] });
    setTimeout(() => setRefreshing(false), 700);
  };

  const submitPasswordChange = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordError(null);

    try {
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed. Please sign in again.');
      setPasswordOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      logout();
    } catch (error) {
      setPasswordError(getPlatformApiError(error));
    }
  };

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b border-border bg-[rgba(255,255,255,0.88)] px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex md:min-w-[340px] md:items-center md:gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm text-muted-foreground shadow-[0_14px_30px_-22px_rgba(15,23,42,0.12)] transition-colors hover:bg-surface-muted"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <span>Search companies, plans, invoices...</span>
            <kbd className="ml-auto rounded border border-border bg-surface-muted px-1.5 py-0.5 text-xs text-muted-foreground">⌘K</kbd>
          </button>
          <Button variant="outline" size="sm" leftIcon={<Command className="h-4 w-4" />} onClick={() => setPaletteOpen(true)}>
            Command
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="rounded-xl border border-border bg-surface p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="Refresh platform data"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>

          <button
            onClick={async () => {
              await platformNotificationsApi.findAll().catch(() => void 0);
            }}
            className="relative rounded-xl border border-border bg-surface p-2 text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_0_4px_rgba(37,99,235,0.12)]" />
          </button>

          <div className="ml-2 flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2 shadow-[0_14px_30px_-22px_rgba(15,23,42,0.12)]">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-contrast shadow-[0_12px_24px_-18px_rgba(37,99,235,0.24)]">
              {user?.name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user?.name ?? 'Platform Admin'}</p>
              <p className="text-xs text-muted-foreground">{user?.role ?? 'PLATFORM_ADMIN'}</p>
            </div>
            <button
              onClick={() => setPasswordOpen(true)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-warning/15 hover:text-warning-foreground"
              aria-label="Change platform password"
            >
              <LockKeyhole className="h-4 w-4" />
            </button>
            <button
              onClick={() => logout()}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <Modal
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        title="Command Palette"
        size="md"
      >
        <div className="space-y-3">
          {[
            { label: 'Open Dashboard', href: '/platform/dashboard' },
            { label: 'Manage Companies', href: '/platform/companies' },
            { label: 'Review Billing', href: '/platform/billing' },
            { label: 'Plans', href: '/platform/plans' },
            { label: 'Subscriptions', href: '/platform/subscriptions' },
            { label: 'Platform Users', href: '/platform/platform-users' },
            { label: 'Support Tickets', href: '/platform/support-tickets' },
            { label: 'Security Center', href: '/platform/security-center' },
            { label: 'Audit Logs', href: '/platform/audit-logs' },
            { label: 'System Settings', href: '/platform/system-settings' },
          ].map((item) => (
            <button
              key={item.href}
              onClick={() => { setPaletteOpen(false); router.push(item.href); }}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:bg-surface-muted"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.href}</p>
              </div>
              <Zap className="h-4 w-4 text-accent" />
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Change Platform Password"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setPasswordOpen(false)} disabled={isChangingPassword}>
              Cancel
            </Button>
            <Button onClick={submitPasswordChange} loading={isChangingPassword} leftIcon={<ShieldCheck className="h-4 w-4" />}>
              Update Password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Changing your password will revoke active refresh tokens and require sign-in again.
          </p>

          <Input
            label="Current password"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((v) => ({ ...v, currentPassword: e.target.value }))}
          />
          <Input
            label="New password"
            type={showNewPassword ? 'text' : 'password'}
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((v) => ({ ...v, newPassword: e.target.value }))}
            rightElement={
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Toggle new password visibility"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <Input
            label="Confirm new password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm((v) => ({ ...v, confirmPassword: e.target.value }))}
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Toggle confirmation visibility"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          {passwordError && (
            <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {passwordError}
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
