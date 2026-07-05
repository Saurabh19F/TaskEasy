'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Shield, ArrowLeft, LogOut, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { apiGet, apiPost, apiDelete } from '@/lib/axios';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function SecuritySettingsPage() {
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['auth-sessions'],
    queryFn: () => apiGet<any[]>('/auth/sessions'),
  });

  const { data: qrData, mutate: setup2fa, isPending: setting2fa } = useMutation({
    mutationFn: () => authApi.setup2fa(),
    onSuccess: () => setShow2faSetup(true),
    onError: () => { setShow2faSetup(false); toast.error('Failed to setup 2FA'); },
  });

  const verify2faMutation = useMutation({
    mutationFn: () => authApi.verify2fa(totpCode),
    onSuccess: () => { toast.success('2FA enabled'); setShow2faSetup(false); setTotpCode(''); },
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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <Shield className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Security</h1>
      </div>

      {/* Change Password */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">Change Password</h2>
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

      {/* Two-Factor Auth */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-indigo-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Two-Factor Authentication</h2>
          </div>
          {!show2faSetup && (
            <Button size="sm" variant="outline" onClick={() => { setShow2faSetup(true); setup2fa(); }} loading={setting2fa}>
              Setup 2FA
            </Button>
          )}
        </div>

        {show2faSetup && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Scan this QR code with your authenticator app, then enter the 6-digit code below.
            </p>
            {qrData ? (
              <img
                src={(qrData as any).qrCode ?? (qrData as any).qrCodeUrl ?? (qrData as any).otpauth}
                alt="2FA QR Code"
                className="w-40 h-40 border rounded-lg"
              />
            ) : (
              <div className="flex items-center justify-center h-40 w-40 border rounded-lg bg-slate-50 dark:bg-slate-800">
                <span className="text-sm text-gray-500">Generating QR code...</span>
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
            </div>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800 dark:text-slate-200">Active Sessions</h2>
        <div className="space-y-2">
          {sessions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {s.userAgent ?? 'Unknown device'}
                </p>
                <p className="text-xs text-slate-500">
                  {s.ipAddress} · Last active {formatDate(s.lastUsedAt ?? s.createdAt)}
                  {s.isCurrent && <span className="ml-2 text-green-600 font-medium">· Current</span>}
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
            <p className="text-sm text-slate-500 text-center py-4">No active sessions found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
