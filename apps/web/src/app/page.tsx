'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { usePlatformAuthStore } from '@/store/platform-auth.store';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Building2,
  Crown,
  Sparkles,
  Workflow,
  Shield,
  CheckCircle2,
  LayoutDashboard,
  ShieldCheck,
} from 'lucide-react';
import { LogoIcon } from '@/components/layout/Logo';
import { Button } from '@/components/ui/Button';

const features = [
  { icon: Workflow, label: 'Workflow Engine', desc: 'Delegation, requests, checklists, and FMS' },
  { icon: ShieldCheck, label: 'Approvals & MIS', desc: 'Multi-level review and real-time reports' },
  { icon: Building2, label: 'Platform Admin', desc: 'Company management, plans, and billing' },
  { icon: Sparkles, label: 'Unified Experience', desc: 'Consistent design across every module' },
];

const stats = [
  { value: '22', unit: 'Modules', desc: 'Fully integrated' },
  { value: '3', unit: 'Roles', desc: 'Clear access levels' },
  { value: '0', unit: 'Clutter', desc: 'Signal over noise' },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { isAuthenticated: isPlatformAuthenticated } = usePlatformAuthStore();

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard');
    if (isPlatformAuthenticated) router.push('/platform/dashboard');
  }, [isAuthenticated, isPlatformAuthenticated, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface via-surface-container to-surface-dim">
      {/* Header */}
      <header className="border-b border-border bg-surface/40 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon className="h-8 w-8" />
            <span className="text-lg font-bold text-foreground">TaskEasy</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link href="/login/platform">
              <Button size="sm">Platform Admin</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
          Enterprise-grade <span className="text-primary">Workflow Management</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Streamline delegation, approvals, MIS reporting, and workflow automation in one unified platform. Built for teams that demand clarity and control.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Workspace Login <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/login/platform">
            <Button size="lg" variant="outline" className="gap-2">
              <Crown className="h-5 w-5" /> Platform Admin
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mb-16">
          {stats.map((stat) => (
            <div key={stat.unit} className="text-center">
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm font-medium text-foreground">{stat.unit}</div>
              <div className="text-xs text-muted-foreground">{stat.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-foreground text-center mb-12">Powerful Features</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.label} className="rounded-2xl border border-border bg-surface-container p-6 hover:border-primary/30 transition-colors">
                <Icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold text-foreground mb-2">{feature.label}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="rounded-3xl border border-border bg-gradient-to-r from-primary/10 to-primary/5 p-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to transform your workflows?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join teams worldwide using TaskEasy to streamline their operations.
          </p>
          <Link href="/login">
            <Button size="lg">Get Started Now</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface-container/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2026 TaskEasy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
