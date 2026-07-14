'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { HeroSection } from '@/components/public/HeroSection';
import { FeaturesSection } from '@/components/public/FeaturesSection';
import { TestimonialsSection } from '@/components/public/TestimonialsSection';
import { CTASection } from '@/components/public/CTASection';
import { PublicFooter } from '@/components/public/PublicFooter';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { isAuthenticated: isPlatformAuthenticated } = usePlatformAuthStore();

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
    if (isPlatformAuthenticated) router.replace('/platform/dashboard');
  }, [isAuthenticated, isPlatformAuthenticated, router]);

  return (
    <div className="bg-white min-h-screen">
      <PublicNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <TestimonialsSection />
        <CTASection />
      </main>
      <PublicFooter />
    </div>
  );
}
