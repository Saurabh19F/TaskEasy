'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import {
  Eye, EyeOff, Lock, Mail, Shield, ArrowLeft, Crown,
} from 'lucide-react';
import { usePlatformLogin } from '@/hooks/usePlatform';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { LogoIcon } from '@/components/layout/Logo';
import { getApiBaseUrl } from '@/lib/runtime-config';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export default function PlatformLoginPage() {
  const router = useRouter();
  const { isAuthenticated: isPlatformAuthenticated } = usePlatformAuthStore();
  const { isAuthenticated } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { onBlur: emailOnBlur, ...emailInputProps } = register('email');
  const { onBlur: passwordOnBlur, ...passwordInputProps } = register('password');
  const apiBase = getApiBaseUrl();

  const { mutate: platformLoginMutate, isPending } = usePlatformLogin();

  useEffect(() => {
    if (isPlatformAuthenticated) router.replace('/platform/dashboard');
    if (isAuthenticated) router.replace('/dashboard');
  }, [isPlatformAuthenticated, isAuthenticated, router]);

  const handleLoginError = (error: any) => {
    const data = error?.response?.data;
    const status = error?.response?.status;
    const isTotpRequired =
      data?.code === 'TOTP_REQUIRED' ||
      (status === 401 &&
        (data?.message?.includes('2FA') ||
          data?.message?.includes('TOTP') ||
          data?.message?.includes('otp')));
    if (isTotpRequired) {
      setTotpRequired(true);
    }
  };

  const onSubmit = (values: FormValues) => {
    platformLoginMutate(
      { ...values, totpCode: totpCode || undefined },
      { onError: handleLoginError },
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden p-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      {/* Ambient glow effects */}
      <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full opacity-30 blur-[120px]" style={{ background: 'rgba(168, 85, 247, 0.4)' }} />
      <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full opacity-20 blur-[120px]" style={{ background: 'rgba(236, 72, 153, 0.4)' }} />

      <div className="relative mx-auto max-w-lg">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-white/5">
            <ArrowLeft className="h-5 w-5" style={{ color: '#94a3b8' }} />
            <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>Back</span>
          </Link>
        </div>

        {/* Sign-in card */}
        <div
          className="w-full rounded-2xl p-7 shadow-2xl sm:p-8"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(24px)',
          }}
        >
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(168, 85, 247, 0.15)' }}>
              <div style={{ color: '#d8b4fe' }}>
                <Crown className="h-6 w-6" />
              </div>
            </div>
            <div>
              <p className="text-xl font-semibold" style={{ color: '#f8fafc' }}>TaskEasy</p>
              <p className="text-xs" style={{ color: 'rgba(148, 163, 184, 0.6)' }}>Platform Admin</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(203, 213, 225, 0.8)' }}>Email address</label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="admin@taskeasy.app"
                  className="w-full rounded-lg py-2.5 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-[rgba(148,163,184,0.4)]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f1f5f9',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)'; }}
                  onBlur={(e) => {
                    emailOnBlur(e);
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  {...emailInputProps}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs" style={{ color: '#f87171' }}>{errors.email.message}</p>}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium" style={{ color: 'rgba(203, 213, 225, 0.8)' }}>Password</label>
                <a href="/forgot-password" className="text-xs font-medium transition-colors hover:underline" style={{ color: '#d8b4fe' }}>
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="w-full rounded-lg py-2.5 pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-[rgba(148,163,184,0.4)]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f1f5f9',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)'; }}
                  onBlur={(e) => {
                    passwordOnBlur(e);
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  {...passwordInputProps}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(148, 163, 184, 0.5)' }}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs" style={{ color: '#f87171' }}>{errors.password.message}</p>}
            </div>

            {totpRequired && (
              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: 'rgba(203, 213, 225, 0.8)' }}>Authentication code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full rounded-lg py-2.5 px-3 text-sm text-center tracking-[0.3em] outline-none transition-colors placeholder:text-[rgba(148,163,184,0.4)]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f1f5f9',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending} loading={isPending} style={{ background: 'rgba(168, 85, 247, 0.9)', borderColor: 'rgba(168, 85, 247, 0.5)' }}>
              {totpRequired ? 'Verify & Sign In' : 'Sign In as Admin'}
            </Button>
          </form>

          <div className="mt-6 rounded-lg p-3 flex items-start gap-2" style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
            <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#d8b4fe' }} />
            <p className="text-xs" style={{ color: 'rgba(216, 180, 254, 0.9)' }}>
              Platform admin access is restricted to authorized personnel. All actions are logged and audited.
            </p>
          </div>
        </div>

        {/* Footer link */}
        <div className="mt-6 text-center text-sm" style={{ color: 'rgba(148, 163, 184, 0.8)' }}>
          Looking for workspace? <Link href="/login/company" className="font-medium transition-colors hover:text-white" style={{ color: '#d8b4fe' }}>Sign in here</Link>
        </div>
      </div>
    </div>
  );
}
