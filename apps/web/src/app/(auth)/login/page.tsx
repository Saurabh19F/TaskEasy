'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  LayoutDashboard,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import { useLogin } from '@/hooks/useAuth';
import { usePlatformLogin } from '@/hooks/usePlatform';
import { useAuthStore } from '@/store/auth.store';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;
type AccessArea = 'workspace' | 'platform';

const accessAreas: {
  key: AccessArea;
  label: string;
  helper: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    key: 'workspace',
    label: 'Workspace',
    helper: 'Tasks, approvals, MIS, FMS',
    icon: LayoutDashboard,
  },
  {
    key: 'platform',
    label: 'Platform Admin',
    helper: 'Companies, billing, security',
    icon: Crown,
  },
];

const features = [
  { icon: Workflow, label: 'Workflow Engine', desc: 'Delegation, requests, checklists, and FMS in one place' },
  { icon: ShieldCheck, label: 'Approvals & MIS', desc: 'Multi-level review, scoring, and real-time reports' },
  { icon: Building2, label: 'Platform Admin', desc: 'Company management, plans, billing, and support' },
  { icon: Sparkles, label: 'Unified Experience', desc: 'Consistent design language across every module' },
];

const stats = [
  { value: '22', unit: 'Modules', desc: 'Fully integrated' },
  { value: '3', unit: 'Roles', desc: 'Clear access levels' },
  { value: '0', unit: 'Clutter', desc: 'Signal over noise' },
];

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { isAuthenticated: isPlatformAuthenticated } = usePlatformAuthStore();
  const [accessArea, setAccessArea] = useState<AccessArea>('workspace');
  const [showPassword, setShowPassword] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  const { mutate: loginMutate, isPending } = useLogin();
  const { mutate: platformLoginMutate, isPending: isPlatformPending } = usePlatformLogin();
  const submitting = isPending || isPlatformPending;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('access') === 'platform' || params.get('mode') === 'platform') {
      setAccessArea('platform');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
    if (isPlatformAuthenticated) router.replace('/platform/dashboard');
  }, [isAuthenticated, isPlatformAuthenticated, router]);

  useEffect(() => {
    setTotpRequired(false);
    setTotpCode('');
  }, [accessArea]);

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

  const login = (values: FormValues) =>
    loginMutate(
      { ...values, totpCode: totpCode || undefined },
      { onError: handleLoginError },
    );

  const platformLogin = (values: FormValues) =>
    platformLoginMutate(
      { ...values, totpCode: totpCode || undefined },
      { onError: handleLoginError },
    );

  const onSubmit = (values: FormValues) => {
    if (accessArea === 'platform') {
      platformLogin(values);
      return;
    }
    login(values);
  };

  const startSso = (provider: 'google' | 'microsoft') => {
    window.location.href = `${apiBase}/auth/sso/${provider}/start`;
  };

  return (
    <div className="relative min-h-screen overflow-hidden p-4 text-foreground" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      {/* Ambient glow effects */}
      <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full opacity-30 blur-[120px]" style={{ background: 'rgba(37, 99, 235, 0.4)' }} />
      <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full opacity-20 blur-[120px]" style={{ background: 'rgba(6, 182, 212, 0.4)' }} />

      <div className="relative mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left — Branding & Features */}
        <section className="py-8 lg:py-12">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide uppercase" style={{ background: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.3)', color: 'rgba(147, 197, 253, 1)' }}>
            <Shield className="h-3.5 w-3.5" />
            Enterprise-grade workflow platform
          </div>

          <h1 className="mt-8 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl" style={{ color: '#ffffff' }}>
            TaskEasy
            <span className="block" style={{ background: 'linear-gradient(135deg, #60a5fa, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Command Center
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7" style={{ color: 'rgba(203, 213, 225, 0.85)' }}>
            One sign-in for workspace modules or platform admin. Clear routing, faster task handling, and a calmer interface for delegation, approvals, reports, FMS, and operations.
          </p>

          {/* Feature grid */}
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {features.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="group rounded-xl p-4 transition-colors"
                  style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'rgba(37, 99, 235, 0.15)' }}>
                      <Icon className="h-4.5 w-4.5" style={{ color: '#60a5fa', width: 18, height: 18 }} />
                    </div>
                    <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>{item.label}</p>
                  </div>
                  <p className="mt-2.5 text-xs leading-5" style={{ color: 'rgba(148, 163, 184, 0.9)' }}>{item.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Stats row */}
          <div className="mt-8 flex items-center gap-6">
            {stats.map((item, i) => (
              <div key={item.unit} className="flex items-center gap-6">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold" style={{ color: '#ffffff' }}>{item.value}</span>
                    <span className="text-sm font-medium" style={{ color: '#60a5fa' }}>{item.unit}</span>
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: 'rgba(148, 163, 184, 0.7)' }}>{item.desc}</p>
                </div>
                {i < stats.length - 1 && (
                  <div className="h-8 w-px" style={{ background: 'rgba(255, 255, 255, 0.1)' }} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Right — Sign-in card */}
        <section className="flex items-center justify-center">
          <div
            className="w-full max-w-[440px] rounded-2xl p-7 shadow-2xl sm:p-8"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div className="mb-7">
              <p className="text-xl font-semibold" style={{ color: '#f8fafc' }}>Sign in</p>
              <p className="mt-1 text-sm" style={{ color: 'rgba(148, 163, 184, 0.8)' }}>Choose workspace or platform access</p>
            </div>

            {/* Access area toggle */}
            <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-xl p-1.5" style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              {accessAreas.map((area) => {
                const Icon = area.icon;
                const active = accessArea === area.key;
                return (
                  <button
                    key={area.key}
                    type="button"
                    onClick={() => setAccessArea(area.key)}
                    className={cn(
                      'rounded-lg px-3 py-2.5 text-left transition-all duration-200',
                    )}
                    style={active ? {
                      background: 'rgba(37, 99, 235, 0.15)',
                      border: '1px solid rgba(37, 99, 235, 0.3)',
                    } : {
                      background: 'transparent',
                      border: '1px solid transparent',
                    }}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium" style={{ color: active ? '#93c5fd' : 'rgba(148, 163, 184, 0.7)' }}>
                      <Icon className="h-4 w-4" />
                      {area.label}
                    </span>
                    <span className="mt-0.5 block text-xs" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>{area.helper}</span>
                  </button>
                );
              })}
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
                    placeholder="you@company.com"
                    className="w-full rounded-lg py-2.5 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-[rgba(148,163,184,0.4)]"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#f1f5f9',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.5)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
                    {...register('email')}
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs" style={{ color: '#f87171' }}>{errors.email.message}</p>}
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-medium" style={{ color: 'rgba(203, 213, 225, 0.8)' }}>Password</label>
                  <a href="/forgot-password" className="text-xs font-medium transition-colors hover:underline" style={{ color: '#60a5fa' }}>
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
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.5)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
                    {...register('password')}
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
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.5)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
                  />
                  <p className="mt-1.5 text-xs" style={{ color: 'rgba(148, 163, 184, 0.6)' }}>Enter the 6-digit code from your authenticator app.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#ffffff',
                  boxShadow: '0 8px 24px -8px rgba(37, 99, 235, 0.4)',
                }}
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </>
                ) : (
                  <>
                    {accessArea === 'platform' ? 'Enter Platform Admin' : 'Enter Workspace'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {accessArea === 'workspace' && (
              <>
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: 'rgba(255, 255, 255, 0.08)' }} />
                  <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'rgba(148, 163, 184, 0.4)' }}>or</span>
                  <div className="h-px flex-1" style={{ background: 'rgba(255, 255, 255, 0.08)' }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(['google', 'microsoft'] as const).map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => startSso(provider)}
                      className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors"
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'rgba(203, 213, 225, 0.9)',
                      }}
                    >
                      {provider === 'google' ? (
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 23 23">
                          <path fill="#f35325" d="M1 1h10v10H1z" />
                          <path fill="#81bc06" d="M12 1h10v10H12z" />
                          <path fill="#05a6f0" d="M1 12h10v10H1z" />
                          <path fill="#ffba08" d="M12 12h10v10H12z" />
                        </svg>
                      )}
                      {provider === 'google' ? 'Google' : 'Microsoft'}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" style={{ color: 'rgba(16, 185, 129, 0.6)' }} />
              <p className="text-xs" style={{ color: 'rgba(148, 163, 184, 0.4)' }}>
                Protected by enterprise-grade security
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs" style={{ color: 'rgba(148, 163, 184, 0.3)' }}>
          &copy; {new Date().getFullYear()} TaskEasy. All rights reserved.
        </p>
      </div>
    </div>
  );
}
