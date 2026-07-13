'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { HeroSection } from '@/components/public/HeroSection';
import { MetricsStrip } from '@/components/public/MetricsStrip';
import { WorkflowSection } from '@/components/public/WorkflowSection';
import { FeaturesSection } from '@/components/public/FeaturesSection';
import { RoleBasedExperienceSection } from '@/components/public/RoleBasedExperienceSection';
import { SecuritySection } from '@/components/public/SecuritySection';
import { TestimonialsSection } from '@/components/public/TestimonialsSection';
import { PricingSection } from '@/components/public/PricingSection';
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
    <div className="bg-background text-foreground">
      <PublicNavbar />
      <main>
        <HeroSection />
        <MetricsStrip />
        <WorkflowSection />
        <FeaturesSection />
        <RoleBasedExperienceSection />
        <SecuritySection />
        <TestimonialsSection />
        <PricingSection />
        <CTASection />
      </main>
      <PublicFooter />
    </div>
  );
}
