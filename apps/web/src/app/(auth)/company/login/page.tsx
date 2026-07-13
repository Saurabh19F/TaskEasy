'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye, EyeOff, Lock, Mail, ArrowLeft, Loader2, CheckCircle2,
} from 'lucide-react';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { Button } from '@/components/ui/Button';
import { motion } from 'framer-motion';
import { LogoIcon } from '@/components/layout/Logo';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function CompanyLoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { isAuthenticated: isPlatformAuthenticated } = usePlatformAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { mutate: loginMutate, isPending } = useLogin();

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
    if (isPlatformAuthenticated) router.replace('/platform/dashboard');
  }, [isAuthenticated, isPlatformAuthenticated, router]);

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
      setSuccessMessage('');
    }
  };

  const onSubmit = (values: FormValues) => {
    setSuccessMessage('');
    loginMutate(
      { ...values, totpCode: totpCode || undefined },
      { onError: handleLoginError },
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-surface to-background">
      {/* Navigation */}
      <div className="fixed top-0 left-0 right-0 z-40 border-b border-border/50 bg-surface/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <LogoIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-foreground">TaskEasy</span>
          </Link>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to website
          </button>
        </div>
      </div>

      <div className="min-h-screen flex items-center justify-center pt-16 pb-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Login Card */}
          <div className="rounded-2xl border border-border bg-surface-container/50 backdrop-blur-sm p-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {totpRequired ? 'Verify Your Account' : 'Welcome Back'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {totpRequired
                  ? 'Enter the code from your authenticator app'
                  : 'Sign in to access your workspace'}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {!totpRequired ? (
                <>
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Work Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <input
                        type="email"
                        placeholder="you@company.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        {...register('email')}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-xs text-error">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-foreground">
                        Password
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-error">{errors.password.message}</p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Authentication Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-center text-lg tracking-widest text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 flex items-start gap-2 text-sm text-secondary">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full mt-6"
                disabled={isPending || isSubmitting}
                loading={isPending || isSubmitting}
              >
                {totpRequired ? 'Verify & Sign In' : 'Sign In to Workspace'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-surface-container">Or continue with</span>
              </div>
            </div>

            {/* SSO Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="py-2.5 rounded-lg border border-border hover:bg-surface-muted transition-colors text-sm font-medium"
              >
                Google
              </button>
              <button
                type="button"
                className="py-2.5 rounded-lg border border-border hover:bg-surface-muted transition-colors text-sm font-medium"
              >
                Microsoft
              </button>
            </div>

            {/* Platform Link */}
            <div className="mt-8 p-4 rounded-lg border border-border/50 bg-surface-muted/50">
              <p className="text-xs text-muted-foreground text-center">
                TaskEasy Platform Administrator?{' '}
                <Link
                  href="/platform/login"
                  className="text-primary font-medium hover:underline"
                >
                  Access secure admin portal
                </Link>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-muted-foreground">
            <p>
              No account?{' '}
              <button className="text-primary font-medium hover:underline">
                Request access
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
