'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield, ArrowLeft, LogOut, Smartphone, Clock, Activity, Globe,
  Plus, Trash2, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiDelete } from '@/lib/axios';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi, securitySettingsApi, type SecuritySettings } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

export default function SecuritySettingsPage() {
  const qc = useQueryClient();
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [newIp, setNewIp] = useState('');

  const { data: secSettings, isLoading } = useQuery({
    queryKey: ['security-settings'],
    queryFn: securitySettingsApi.get,
  });

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => apiGet<any[]>('/auth/sessions'),
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<SecuritySettings>) => securitySettingsApi.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['security-settings'] }),
  });

  const { data: qrData, mutate: setup2fa } = useMutation({
    mutationFn: () => authApi.setup2fa(),
    onSuccess: () => setShow2faSetup(true),
    onError: () => { setShow2faSetup(false); toast.error('Failed to setup 2FA'); },
  });

  const verify2faMutation = useMutation({
    mutationFn: () => authApi.verify2fa(totpCode),
    onSuccess: () => {
      toast.success('2FA enabled');
      setShow2faSetup(false);
      setTotpCode('');
      updateSettingsMutation.mutate({ enforce2fa: true });
    },
    onError: () => toast.error('Invalid code'),
  });

  const changePwMutation = useMutation({
    mutationFn: () => authApi.changePassword(pwForm.current, pwForm.next),
    onSuccess: () => { toast.success('Password changed'); setPwForm({ current: '', next: '', confirm: '' }); },
    onError: () => toast.error('Could not change password'),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => apiDelete(`/auth/sessions/${sessionId}`),
    onSuccess: () => { toast.success('Session revoked'); refetchSessions(); },
  });

  const handleChangePw = () => {
    if (pwForm.next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return; }
    changePwMutation.mutate();
  };

  const handleToggle = (key: string) => {
    if (!secSettings) return;
    switch (key) {
      case '2fa':
        if (!secSettings.enforce2fa) {
          setShow2faSetup(true);
          setup2fa();
        } else {
          updateSettingsMutation.mutate({ enforce2fa: false });
          toast.success('2FA enforcement disabled');
        }
        break;
      case 'session-timeout':
        updateSettingsMutation.mutate({
          sessionTimeoutEnabled: !secSettings.sessionTimeoutEnabled,
        });
        toast.success(secSettings.sessionTimeoutEnabled ? 'Session timeout disabled' : 'Session timeout enabled');
        break;
      case 'audit-logs':
        updateSettingsMutation.mutate({
          auditLogsEnabled: !secSettings.auditLogsEnabled,
        });
        toast.success(secSettings.auditLogsEnabled ? 'Audit logs paused' : 'Audit logs enabled');
        break;
      case 'ip-whitelist':
        updateSettingsMutation.mutate({
          ipWhitelistEnabled: !secSettings.ipWhitelistEnabled,
        });
        toast.success(secSettings.ipWhitelistEnabled ? 'IP whitelist disabled' : 'IP whitelist enabled');
        break;
    }
  };

  const addIp = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(trimmed)) {
      toast.error('Enter a valid IP address or CIDR range (e.g. 192.168.1.0/24)');
      return;
    }
    const current = secSettings?.whitelistedIps ?? [];
    if (current.includes(trimmed)) {
      toast.error('IP already whitelisted');
      return;
    }
    updateSettingsMutation.mutate({ whitelistedIps: [...current, trimmed] });
    setNewIp('');
    toast.success('IP added to whitelist');
  };

  const removeIp = (ip: string) => {
    const current = secSettings?.whitelistedIps ?? [];
    updateSettingsMutation.mutate({ whitelistedIps: current.filter((i) => i !== ip) });
    toast.success('IP removed from whitelist');
  };

  const features = [
    {
      key: '2fa',
      title: 'Two-Factor Authentication (2FA)',
      description: 'Add an extra layer of security using an authenticator app.',
      icon: Shield,
      status: secSettings?.enforce2fa ? 'Enabled' : 'Disabled',
      enabled: secSettings?.enforce2fa ?? false,
    },
    {
      key: 'session-timeout',
      title: 'Session Timeout',
      description: 'Automatically sign out inactive users after a set period.',
      icon: Clock,
      status: secSettings?.sessionTimeoutEnabled ? 'Enabled' : 'Disabled',
      enabled: secSettings?.sessionTimeoutEnabled ?? false,
    },
    {
      key: 'audit-logs',
      title: 'Audit Logs',
      description: 'Track all user actions — logins, changes, deletions — with timestamps and IPs.',
      icon: Activity,
      status: secSettings?.auditLogsEnabled ? 'Enabled' : 'Paused',
      enabled: secSettings?.auditLogsEnabled ?? true,
    },
    {
      key: 'ip-whitelist',
      title: 'IP Whitelist',
      description: 'Restrict access to specific IP addresses or CIDR ranges.',
      icon: Globe,
      status: secSettings?.ipWhitelistEnabled ? 'Enabled' : 'Inactive',
      enabled: secSettings?.ipWhitelistEnabled ?? false,
    },
  ];

  const statusColor = (status: string) => {
    switch (status) {
      case 'Enabled': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'Paused': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      default: return 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <Shield className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Security</h1>
      </div>

      {/* Security Feature Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
      <div className="space-y-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <div
              key={feature.key}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted flex-shrink-0">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', statusColor(feature.status))}>
                    {feature.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{feature.description}</p>
                {feature.key === '2fa' && !secSettings?.enforce2fa && !show2faSetup && (
                  <button
                    onClick={() => { setShow2faSetup(true); setup2fa(); }}
                    className="mt-2 text-sm font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <Shield className="h-3.5 w-3.5" /> Set up 2FA now &rarr;
                  </button>
                )}
              </div>
              <button
                onClick={() => handleToggle(feature.key)}
                disabled={updateSettingsMutation.isPending}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors flex-shrink-0',
                  feature.enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    feature.enabled && 'translate-x-5',
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
      )}

      {/* Session Timeout Config */}
      {secSettings?.sessionTimeoutEnabled && (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Session Timeout Duration
          </h2>
          <p className="text-sm text-muted-foreground">
            Users will be automatically signed out after this period of inactivity.
          </p>
          <div className="flex items-center gap-3">
            <select
              value={secSettings.sessionTimeoutMinutes}
              onChange={(e) => {
                updateSettingsMutation.mutate({ sessionTimeoutMinutes: parseInt(e.target.value, 10) });
                toast.success('Timeout duration updated');
              }}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
            </select>
          </div>
        </div>
      )}

      {/* IP Whitelist Management */}
      {secSettings?.ipWhitelistEnabled && (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> Whitelisted IP Addresses
          </h2>
          <p className="text-sm text-muted-foreground">
            Only requests from these IPs will be allowed. Leave empty to allow all.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. 192.168.1.0/24 or 10.0.0.1"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addIp()}
              className="flex-1"
            />
            <Button size="sm" onClick={addIp} leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Add
            </Button>
          </div>
          {(secSettings.whitelistedIps ?? []).length > 0 ? (
            <div className="space-y-1.5">
              {secSettings.whitelistedIps.map((ip) => (
                <div key={ip} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
                  <code className="text-sm font-mono text-foreground">{ip}</code>
                  <button
                    onClick={() => removeIp(ip)}
                    className="rounded p-1 text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No IPs whitelisted yet. All IPs are currently allowed.</p>
          )}
        </div>
      )}

      {/* 2FA Setup */}
      {show2faSetup && (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Setup Two-Factor Authentication</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app, then enter the 6-digit code below.
          </p>
          {qrData ? (
            <img
              src={(qrData as any).qrCode ?? (qrData as any).qrCodeUrl ?? (qrData as any).otpauth}
              alt="2FA QR Code"
              className="w-40 h-40 border border-border rounded-lg"
            />
          ) : (
            <div className="flex items-center justify-center h-40 w-40 border border-border rounded-lg bg-surface-muted">
              <span className="text-sm text-muted-foreground">Generating QR code...</span>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="6-digit code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              maxLength={6}
              className="max-w-40"
            />
            <Button onClick={() => verify2faMutation.mutate()} loading={verify2faMutation.isPending} disabled={totpCode.length !== 6}>
              Verify
            </Button>
            <Button variant="outline" onClick={() => setShow2faSetup(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Change Password</h2>
        <Input
          type="password"
          label="Current Password"
          value={pwForm.current}
          onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
        />
        <Input
          type="password"
          label="New Password"
          value={pwForm.next}
          onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
        />
        <Input
          type="password"
          label="Confirm New Password"
          value={pwForm.confirm}
          onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
        />
        <div className="flex justify-end">
          <Button
            onClick={handleChangePw}
            loading={changePwMutation.isPending}
            disabled={!pwForm.current || !pwForm.next || !pwForm.confirm}
          >
            Change Password
          </Button>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        <h2 className="font-semibold text-foreground">Active Sessions</h2>
        <div className="space-y-2">
          {sessions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {s.userAgent ?? 'Unknown device'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.ipAddress} · Last active {formatDate(s.lastUsedAt ?? s.createdAt)}
                  {s.isCurrent && <span className="ml-2 text-green-600 dark:text-green-400 font-medium">· Current</span>}
                </p>
              </div>
              {!s.isCurrent && (
                <Button
                  size="xs"
                  variant="outline"
                  leftIcon={<LogOut className="h-3 w-3" />}
                  onClick={() => revokeSessionMutation.mutate(s.id)}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No active sessions found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
