'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CTASection() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E40AF]" />
          <div className="absolute inset-0 opacity-10">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="cta-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cta-grid)" />
            </svg>
          </div>
          <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to boost your productivity?
            </h2>
            <p className="text-lg text-blue-100 max-w-xl mx-auto mb-8">
              Join thousands of professionals who have reclaimed their time with TaskEasy. No credit card required to start.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Link
                href="/company/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white text-[#2563EB] text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                Start Your Free Trial Today
              </Link>
              <Link
                href="/company/login"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
              >
                Contact Sales
              </Link>
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-blue-200">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Free 14-day trial
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                No credit card required
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
