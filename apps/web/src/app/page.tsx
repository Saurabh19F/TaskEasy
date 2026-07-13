'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { PublicNavbar } from '@/components/public/PublicNavbar';
import { HeroSection } from '@/components/public/HeroSection';

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

        {/* TODO: Add more sections */}
        {/* - Live Product Proof Strip */}
        {/* - Problem-to-Solution Section */}
        {/* - Core Modules Ecosystem */}
        {/* - Interactive Workflow Demo */}
        {/* - Role-Based Experience Tabs */}
        {/* - Automation Section */}
        {/* - Analytics Preview */}
        {/* - Security Section */}
        {/* - Testimonials */}
        {/* - Pricing Preview */}
        {/* - Final CTA */}
        {/* - Footer */}

        {/* Placeholder for remaining sections */}
        <section className="py-24 px-4 text-center">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              More sections coming soon
            </h2>
            <p className="text-muted-foreground text-lg">
              We're building additional landing page sections to showcase TaskEasy's full capabilities.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
