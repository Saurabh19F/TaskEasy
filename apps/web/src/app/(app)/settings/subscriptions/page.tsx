'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CreditCard, Users, GitBranch, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { subscriptionsApi, type Plan } from '@/lib/api';
import { cn } from '@/lib/utils';

const TIER_ORDER: Record<string, number> = { STARTER: 0, PRO: 1, ENTERPRISE: 2 };

function planFeatures(plan: Plan): string[] {
  if (plan.features?.length) return plan.features;
  const f: string[] = [];
  f.push(`Up to ${plan.maxUsers} users`);
  f.push(`${plan.maxFmsWorkflows} FMS workflows`);
  if (plan.maxProjects > 0) f.push(`${plan.maxProjects} projects`);
  if (plan.tier === 'ENTERPRISE') {
    f.push('All modules included', 'Audit logs & compliance', 'Custom roles & permissions', 'Dedicated support', 'API access');
  } else if (plan.tier === 'PRO') {
    f.push('Advanced delegation', 'Work requests & checklists', 'MIS & analytics', 'Priority support');
  } else {
    f.push('Task delegation', 'Basic reports', 'Email support');
  }
  return f;
}

export default function SubscriptionsPage() {
  const qc = useQueryClient();

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: subscriptionsApi.listPlans,
  });

  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: subscriptionsApi.getMy,
  });

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => subscriptionsApi.changePlan(planId),
    onSuccess: () => {
      toast.success('Plan changed successfully');
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to change plan');
    },
  });

  const currentPlanId = myData?.subscription?.planId;
  const usage = myData?.usage;
  const subscription = myData?.subscription;

  const sortedPlans = [...plans].sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99),
  );

  const isLoading = plansLoading || myLoading;

  const isUpgrade = (plan: Plan) => {
    if (!subscription?.plan) return true;
    return (TIER_ORDER[plan.tier] ?? 99) > (TIER_ORDER[subscription.plan.tier] ?? 99);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <CreditCard className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold text-foreground">Subscriptions</h1>
      </div>

      {/* Current usage */}
      {subscription && usage && (
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-2">
          <h2 className="font-semibold text-foreground">
            Current Plan: <span className="text-primary">{subscription.plan?.name ?? 'Unknown'}</span>
            <span className={cn(
              'ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              subscription.status === 'ACTIVE'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            )}>
              {subscription.status}
            </span>
          </h2>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">{usage.users}</span>
              / {subscription.plan?.maxUsers ?? '?'} users
            </div>
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground">{usage.fmsWorkflows}</span>
              / {subscription.plan?.maxFmsWorkflows ?? '?'} FMS
            </div>
            <div>
              Period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} – {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Choose the plan that best fits your organization. Upgrade or downgrade anytime.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sortedPlans.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-muted-foreground">No plans available. Contact your administrator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedPlans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const recommended = plan.tier === 'PRO';
            const features = planFeatures(plan);
            const price = plan.monthlyPrice ?? plan.price;

            return (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-5 transition-all',
                  recommended
                    ? 'border-primary shadow-[0_0_0_1px_rgb(var(--primary)),0_8px_24px_-8px_rgb(var(--primary)/0.2)]'
                    : 'border-border bg-surface hover:border-primary/30',
                  isCurrent && 'ring-2 ring-primary/20',
                )}
              >
                {recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-bold text-contrast">
                    RECOMMENDED
                  </span>
                )}

                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{plan.description ?? plan.tier}</p>

                <div className="mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-foreground">
                      {plan.currency === 'INR' ? '₹' : '$'}{price.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-semibold text-foreground">{plan.maxUsers}</span>
                    Users
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span className="font-semibold text-foreground">{plan.maxFmsWorkflows}</span>
                    FMS
                  </div>
                </div>

                <ul className="mt-4 flex-1 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-5 w-full"
                  variant={isCurrent ? 'outline' : recommended ? 'primary' : 'outline'}
                  size="sm"
                  disabled={isCurrent || changePlanMutation.isPending}
                  loading={changePlanMutation.isPending && changePlanMutation.variables === plan.id}
                  onClick={() => {
                    if (!isCurrent) changePlanMutation.mutate(plan.id);
                  }}
                >
                  {isCurrent ? 'Current Plan' : isUpgrade(plan) ? 'Upgrade' : 'Downgrade'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
