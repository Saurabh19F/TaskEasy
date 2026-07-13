'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Check, CreditCard, Users, GitBranch, Loader2,
  Clock, CheckCircle, XCircle, Send,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { subscriptionsApi, type Plan } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

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

const STATUS_STYLES: Record<string, { icon: any; color: string; label: string }> = {
  PENDING: { icon: Clock, label: 'Pending Review', color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30' },
  APPROVED: { icon: CheckCircle, label: 'Approved', color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' },
  REJECTED: { icon: XCircle, label: 'Rejected', color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30' },
  CANCELLED: { icon: XCircle, label: 'Cancelled', color: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800' },
};

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const [reasonPlanId, setReasonPlanId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: subscriptionsApi.listPlans,
  });

  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: subscriptionsApi.getMy,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['my-plan-requests'],
    queryFn: subscriptionsApi.listRequests,
  });

  const requestMutation = useMutation({
    mutationFn: ({ planId, reason: r }: { planId: string; reason?: string }) =>
      subscriptionsApi.requestChange(planId, r),
    onSuccess: () => {
      toast.success('Plan change request submitted. Waiting for Platform Admin approval.');
      setReasonPlanId(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
      qc.invalidateQueries({ queryKey: ['my-plan-requests'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to submit request');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => subscriptionsApi.cancelRequest(requestId),
    onSuccess: () => {
      toast.success('Request cancelled');
      qc.invalidateQueries({ queryKey: ['my-subscription'] });
      qc.invalidateQueries({ queryKey: ['my-plan-requests'] });
    },
  });

  const currentPlanId = myData?.subscription?.planId;
  const usage = myData?.usage;
  const subscription = myData?.subscription;
  const pendingRequest = myData?.pendingRequest;

  const sortedPlans = [...plans].sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99),
  );

  const isLoading = plansLoading || myLoading;

  const isUpgrade = (plan: Plan) => {
    if (!subscription?.plan) return true;
    return (TIER_ORDER[plan.tier] ?? 99) > (TIER_ORDER[subscription.plan.tier] ?? 99);
  };

  const handleRequestClick = (planId: string) => {
    if (pendingRequest) {
      toast.error('You already have a pending request. Cancel it first to request a different plan.');
      return;
    }
    setReasonPlanId(planId);
  };

  const submitRequest = () => {
    if (!reasonPlanId) return;
    requestMutation.mutate({ planId: reasonPlanId, reason: reason || undefined });
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

      {/* Current plan & usage */}
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
          <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
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

      {/* Pending request banner */}
      {pendingRequest && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-foreground">Pending Plan Change Request</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Request to switch from <strong>{pendingRequest.currentPlan?.name}</strong> to{' '}
              <strong>{pendingRequest.requestedPlan?.name}</strong>
              {pendingRequest.reason && <> — "{pendingRequest.reason}"</>}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Submitted {formatDate(pendingRequest.createdAt)} · Awaiting Platform Admin approval
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => cancelMutation.mutate(pendingRequest.id)}
            loading={cancelMutation.isPending}
          >
            Cancel Request
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Choose a plan and submit a request. Platform Admin will review and approve your plan change.
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
            const isPendingForThis = pendingRequest?.requestedPlanId === plan.id;
            const recommended = plan.tier === 'PRO';
            const features = planFeatures(plan);
            const price = plan.monthlyPrice ?? plan.price ?? 0;

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
                  variant={isCurrent ? 'outline' : isPendingForThis ? 'outline' : recommended ? 'primary' : 'outline'}
                  size="sm"
                  disabled={isCurrent || isPendingForThis || !!pendingRequest}
                  onClick={() => handleRequestClick(plan.id)}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : isPendingForThis
                      ? 'Request Pending...'
                      : isUpgrade(plan)
                        ? 'Request Upgrade'
                        : 'Request Downgrade'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Reason modal */}
      {reasonPlanId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 space-y-4 shadow-xl">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Request Plan Change
            </h3>
            <p className="text-sm text-muted-foreground">
              Your request will be sent to the Platform Admin for review. Optionally provide a reason.
            </p>
            <textarea
              placeholder="Reason for plan change (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setReasonPlanId(null); setReason(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitRequest} loading={requestMutation.isPending}>
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request history */}
      {requests.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <h2 className="font-semibold text-foreground">Request History</h2>
          <div className="space-y-2">
            {requests.map((req) => {
              const style = STATUS_STYLES[req.status] ?? STATUS_STYLES.PENDING;
              const Icon = style.icon;
              return (
                <div key={req.id} className="flex items-center justify-between rounded-lg bg-surface-muted px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {req.currentPlan?.name} &rarr; {req.requestedPlan?.name}
                      </span>
                      <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', style.color)}>
                        <Icon className="h-3 w-3" />
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(req.createdAt)}
                      {req.reason && <> · {req.reason}</>}
                      {req.reviewNote && <> · Admin: "{req.reviewNote}"</>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
