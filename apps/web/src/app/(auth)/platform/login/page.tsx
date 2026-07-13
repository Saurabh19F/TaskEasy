'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye, EyeOff, Lock, Mail, ArrowLeft, Shield, AlertCircle,
} from 'lucide-react';
import { usePlatformLogin } from '@/hooks/usePlatform';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';

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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, 0.05) 25%, rgba(6, 182, 212, 0.05) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, 0.05) 75%, rgba(6, 182, 212, 0.05) 76%, transparent 77%, transparent),
              linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, 0.05) 25%, rgba(6, 182, 212, 0.05) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, 0.05) 75%, rgba(6, 182, 212, 0.05) 76%, transparent 77%, transparent)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* Navigation */}
      <div className="relative z-20 border-b border-cyan-900/30 bg-slate-950/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg border border-cyan-500/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="font-bold text-slate-100">TaskEasy</div>
              <div className="text-xs text-cyan-400 font-mono">Admin Console</div>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors font-mono"
          >
            <ArrowLeft className="h-4 w-4" />
            Exit Portal
          </button>
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center pt-16 pb-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          {/* Security Badge */}
          <div className="mb-8 flex items-center justify-center gap-2 text-xs text-cyan-400 font-mono border-b border-cyan-900/30 pb-4">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Secure Administrative Access
          </div>

          {/* Login Card */}
          <div className="rounded-lg border border-cyan-900/50 bg-slate-900/50 backdrop-blur-xl p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-100 mb-2 font-mono">
                {totpRequired ? 'Verify MFA' : 'Platform Access'}
              </h1>
              <p className="text-xs text-cyan-300/70 font-mono">
                {totpRequired
                  ? 'Enter your authenticator code'
                  : 'Restricted to TaskEasy administrators'}
              </p>
            </div>

            {/* Warning Message */}
            <div className="mb-6 p-3 rounded-lg border border-amber-900/30 bg-amber-900/10 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                This portal is restricted to authorized TaskEasy platform personnel. All authentication attempts are logged.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {!totpRequired ? (
                <>
                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2 font-mono uppercase tracking-wide">
                      Administrator Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-cyan-400/50" />
                      <input
                        type="email"
                        placeholder="admin@taskeasy.app"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-cyan-900/30 bg-slate-800/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-mono text-sm"
                        {...register('email')}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-xs text-amber-400 font-mono">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-2 font-mono uppercase tracking-wide">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-cyan-400/50" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-cyan-900/30 bg-slate-800/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-mono text-sm"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-cyan-400/50 hover:text-cyan-400 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-amber-400 font-mono">{errors.password.message}</p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-2 font-mono uppercase tracking-wide">
                    MFA Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full px-4 py-2.5 rounded-lg border border-cyan-900/30 bg-slate-800/50 text-center text-2xl tracking-widest text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all font-mono"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg border border-red-900/30 bg-red-900/10 text-xs text-red-400 font-mono">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full mt-6 bg-cyan-600 hover:bg-cyan-700 text-white font-mono uppercase text-xs tracking-wide"
                disabled={isPending || isSubmitting}
                loading={isPending || isSubmitting}
              >
                {totpRequired ? 'Verify Access' : 'Authenticate'}
              </Button>
            </form>

            {/* Security Info */}
            <div className="mt-6 pt-4 border-t border-cyan-900/30 space-y-2 text-xs text-cyan-300/60 font-mono">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-cyan-400" />
                Encrypted communication
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-cyan-400" />
                Session monitoring active
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-cyan-400" />
                All attempts logged
              </div>
            </div>
          </div>

          {/* Company Access Link */}
          <div className="mt-8 text-center text-xs text-slate-400">
            <p>
              Looking for workspace access?{' '}
              <Link
                href="/company/login"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Go to company login
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
