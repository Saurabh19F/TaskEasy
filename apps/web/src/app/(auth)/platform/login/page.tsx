'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, ArrowRight, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { usePlatformLogin } from '@/hooks/usePlatform';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { useAuthStore } from '@/store/auth.store';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function PlatformLoginPage() {
  const router = useRouter();
  const { isAuthenticated: isPlatformAuthenticated } = usePlatformAuthStore();
  const { isAuthenticated } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { mutate: platformLoginMutate, isPending } = usePlatformLogin();

  useEffect(() => {
    if (isPlatformAuthenticated) router.replace('/platform/dashboard');
    if (isAuthenticated) router.replace('/dashboard');
  }, [isPlatformAuthenticated, isAuthenticated, router]);

  const handleLoginError = (error: any) => {
    const data = error?.response?.data;
    const status = error?.response?.status;

    if (status === 403) {
      setError('Access denied. Administrator credentials required.');
    } else if (status === 401) {
      setError('Invalid credentials. Please check your email and password.');
      const isTotpRequired =
        data?.code === 'TOTP_REQUIRED' ||
        (data?.message?.includes('2FA') ||
          data?.message?.includes('TOTP') ||
          data?.message?.includes('otp'));
      if (isTotpRequired) {
        setTotpRequired(true);
        setError('');
      }
    } else {
      setError('Authentication failed. Please try again.');
    }
  };

  const onSubmit = (values: FormValues) => {
    setError('');
    platformLoginMutate(
      { ...values, totpCode: totpCode || undefined },
      { onError: handleLoginError },
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#2563EB]" />
            <span className="text-lg font-bold text-white">TaskEasy</span>
            <span className="text-xs text-slate-400 font-mono ml-1">Admin</span>
          </div>
          <Link
            href="/"
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            Back to website
          </Link>
        </div>
      </nav>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#2563EB] flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-1">
                {totpRequired ? 'Verify MFA' : 'Platform Access'}
              </h1>
              <p className="text-sm text-slate-400">
                {totpRequired
                  ? 'Enter your authenticator code'
                  : 'Restricted to authorized administrators'}
              </p>
            </div>

            {/* Warning */}
            <div className="mb-6 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80">
                This portal is restricted to authorized TaskEasy platform personnel. All authentication attempts are logged.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {!totpRequired ? (
                <>
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Administrator Email
                    </label>
                    <input
                      type="email"
                      placeholder="admin@taskeasy.app"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-all text-sm"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-all text-sm"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    MFA Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800 text-center text-lg tracking-widest text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-all"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending || isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isPending || isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {totpRequired ? 'Verify Access' : 'Authenticate'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Security info */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Encrypted
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Monitored
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Logged
              </span>
            </div>
          </div>

          {/* Company link */}
          <p className="mt-6 text-center text-sm text-slate-500">
            Looking for workspace access?{' '}
            <Link href="/company/login" className="font-medium text-[#2563EB] hover:text-blue-400">
              Go to company login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
