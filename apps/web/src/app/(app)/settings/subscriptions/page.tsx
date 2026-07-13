'use client';

import { useState } from 'react';
import { ArrowLeft, Check, CreditCard, Users, GitBranch } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Plan {
  key: string;
  name: string;
  description: string;
  users: number | 'custom';
  fms: number | 'custom';
  monthlyPrice: number | null;
  features: string[];
  recommended?: boolean;
}

const PLANS: Plan[] = [
  {
    key: 'basic',
    name: 'Basic',
    description: 'For small teams getting started',
    users: 20,
    fms: 2,
    monthlyPrice: 999,
    features: [
      'Up to 20 users',
      '2 FMS workflows',
      'Task delegation',
      'Basic reports',
      'Email support',
    ],
  },
  {
    key: 'standard',
    name: 'Standard',
    description: 'For growing organizations',
    users: 50,
    fms: 5,
    monthlyPrice: 2499,
    features: [
      'Up to 50 users',
      '5 FMS workflows',
      'Advanced delegation',
      'Work requests & checklists',
      'MIS & analytics',
      'Priority support',
    ],
    recommended: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    users: 100,
    fms: 20,
    monthlyPrice: 4999,
    features: [
      'Up to 100 users',
      '20 FMS workflows',
      'All modules included',
      'Audit logs & compliance',
      'Custom roles & permissions',
      'Dedicated support',
      'API access',
    ],
  },
  {
    key: 'custom',
    name: 'Custom',
    description: 'Tailored to your needs',
    users: 'custom',
    fms: 'custom',
    monthlyPrice: null,
    features: [
      'Unlimited users (manual)',
      'Unlimited FMS (manual)',
      'All Enterprise features',
      'Custom integrations',
      'On-premise deployment',
      'SLA guarantee',
      'Dedicated account manager',
    ],
  },
];

export default function SubscriptionsPage() {
  const [activePlan] = useState('basic');

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <CreditCard className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Subscriptions</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Choose the plan that best fits your organization. Upgrade or downgrade anytime.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={cn(
              'relative flex flex-col rounded-2xl border p-5 transition-all',
              plan.recommended
                ? 'border-primary shadow-[0_0_0_1px_rgb(var(--primary)),0_8px_24px_-8px_rgb(var(--primary)/0.2)]'
                : 'border-border bg-surface hover:border-primary/30',
            )}
          >
            {plan.recommended && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-contrast">
                RECOMMENDED
              </span>
            )}

            <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>

            <div className="mt-4">
              {plan.monthlyPrice !== null ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">
                    ₹{plan.monthlyPrice.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>
              ) : (
                <p className="text-2xl font-extrabold text-foreground">Contact Us</p>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">
                  {plan.users === 'custom' ? 'Custom' : plan.users}
                </span>
                Users
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitBranch className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">
                  {plan.fms === 'custom' ? 'Custom' : plan.fms}
                </span>
                FMS
              </div>
            </div>

            <ul className="mt-4 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                  {f}
                </li>
              ))}
            </ul>

            <Button
              className="mt-5 w-full"
              variant={activePlan === plan.key ? 'outline' : plan.recommended ? 'default' : 'outline'}
              size="sm"
              disabled={activePlan === plan.key}
            >
              {activePlan === plan.key ? 'Current Plan' : plan.monthlyPrice !== null ? 'Upgrade' : 'Contact Sales'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
