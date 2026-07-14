'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth.store';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

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
    }
  };

  const onSubmit = (values: FormValues) => {
    loginMutate(
      { ...values, totpCode: totpCode || undefined },
      { onError: handleLoginError },
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-[#2563EB]">
            TaskEasy
          </Link>
          <div className="hidden sm:flex items-center gap-6">
            <a href="/#features" className="text-sm text-gray-600 hover:text-gray-900">Features</a>
            <a href="/#solutions" className="text-sm text-gray-600 hover:text-gray-900">Solutions</a>
            <a href="/#pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
            <Link href="/company/login" className="text-sm font-medium text-[#2563EB]">Log In</Link>
          </div>
        </div>
      </nav>

      {/* Login form */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-[#2563EB] flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {totpRequired ? 'Verify Your Account' : 'Welcome back'}
              </h1>
              <p className="text-sm text-gray-500">
                {totpRequired
                  ? 'Enter the code from your authenticator app'
                  : 'Log in to your TaskEasy account'}
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {!totpRequired ? (
                <>
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="name@company.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all text-sm"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <Link href="/forgot-password" className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all text-sm"
                        {...register('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Authentication Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 bg-white text-center text-lg tracking-widest text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  />
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
                    {totpRequired ? 'Verify & Sign In' : 'Log In'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Sign up link */}
            <p className="mt-6 text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link href="/company/login" className="font-medium text-[#2563EB] hover:text-[#1D4ED8]">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
            <span className="font-medium text-[#2563EB]">TaskEasy</span>{' '}
            &copy; {new Date().getFullYear()} TaskEasy Productivity. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-400 hover:text-gray-600">Privacy Policy</a>
            <a href="#" className="text-sm text-gray-400 hover:text-gray-600">Terms of Service</a>
            <a href="#" className="text-sm text-gray-400 hover:text-gray-600">Help Center</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
