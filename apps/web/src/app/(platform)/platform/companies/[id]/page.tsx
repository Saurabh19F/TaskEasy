'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { BarChart3, FileText, ShieldCheck, Wallet, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { usePlatformCompany } from '@/hooks/usePlatform';
import { platformCompaniesApi } from '@/lib/platform-api';
import { getPlatformApiError } from '@/lib/platform-axios';
import { formatDate, formatFileSize, formatNumber } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { usePlatformAuthStore } from '@/store/platform-auth.store';

export default function PlatformCompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = usePlatformCompany(id);

  const modules = useMemo(() => data?.enabledModules ?? [], [data?.enabledModules]);

  return (
    <PlatformPageFrame
      title={data?.profile.companyName ?? 'Company Detail'}
      description="Inspect subscription, modules, usage, tickets, invoices, and audit history for one tenant."
      actions={
        <Button variant="outline" onClick={async () => {
          try {
            const res = await platformCompaniesApi.impersonate(id, 'Support review');
            usePlatformAuthStore.getState().setImpersonation({
              sessionId: res.sessionId,
              companyId: id,
              companyName: data?.profile.companyName ?? 'Company',
              targetUser: res.targetUser,
              banner: res.banner,
              accessToken: res.accessToken,
              refreshToken: res.refreshToken,
            });
            toast.success(`Now impersonating ${res.targetUser?.name ?? 'admin'}`);
            qc.invalidateQueries({ queryKey: ['platform', 'company', id] });
          } catch (error) {
            toast.error(getPlatformApiError(error));
          }
        }}>Login as Admin</Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={data?.counts.users ?? 0} icon={BarChart3} color="indigo" />
        <StatCard label="Employees" value={data?.counts.employees ?? 0} icon={ShieldCheck} color="green" />
        <StatCard label="Storage" value={formatFileSize(data?.counts.storageUsedBytes ?? 0)} icon={Wallet} color="blue" />
        <StatCard label="API Usage" value={formatNumber(data?.counts.apiUsageCount ?? 0)} icon={Zap} color="purple" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div><span className="text-muted-foreground">Owner</span><div className="font-medium text-foreground">{data?.profile.ownerName ?? '—'}</div></div>
            <div><span className="text-muted-foreground">Email</span><div className="font-medium text-foreground">{data?.profile.ownerEmail ?? '—'}</div></div>
            <div><span className="text-muted-foreground">Industry</span><div className="font-medium text-foreground">{data?.profile.industry ?? '—'}</div></div>
            <div><span className="text-muted-foreground">Status</span><div><StatusBadge status={data?.profile.status} /></div></div>
            <div><span className="text-muted-foreground">Created</span><div className="font-medium text-foreground">{formatDate(data?.profile.createdAt ?? '')}</div></div>
            <div><span className="text-muted-foreground">Last Login</span><div className="font-medium text-foreground">{data?.profile.lastLoginAt ? formatDate(data.profile.lastLoginAt) : '—'}</div></div>
            <div><span className="text-muted-foreground">Database URI</span><div className="font-medium text-foreground truncate" title={data?.profile.dbUri ?? ''}>{data?.profile.dbUri ?? '—'}</div></div>
            <div><span className="text-muted-foreground">Database Name</span><div className="font-medium text-foreground">{data?.profile.dbName ?? '—'}</div></div>
          </div>
        </div>

        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold text-foreground">Subscription</h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between"><span>Plan</span><Badge className="bg-slate-800 text-slate-200">{data?.subscription?.plan?.name ?? '—'}</Badge></div>
            <div className="flex items-center justify-between"><span>Status</span><StatusBadge status={data?.subscription?.status} /></div>
            <div className="flex items-center justify-between"><span>Period Start</span><span>{formatDate(data?.subscription?.currentPeriodStart ?? '')}</span></div>
            <div className="flex items-center justify-between"><span>Period End</span><span>{formatDate(data?.subscription?.currentPeriodEnd ?? '')}</span></div>
            <div className="flex items-center justify-between"><span>Auto Renew</span><span>{String(data?.subscription?.autoRenew ?? false)}</span></div>
          </div>
        </div>
      </div>

      <div className="panel-strong p-5">
        <h2 className="text-sm font-semibold text-foreground">Enabled Modules</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.length > 0 ? modules.map((module: any) => (
            <div key={module.id ?? module.feature} className="rounded-xl border border-border bg-surface-muted p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">{module.feature}</p>
                <StatusBadge status={module.enabled ? 'ACTIVE' : 'INACTIVE'} />
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground dark:text-slate-400">No module overrides configured.</p>}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold text-foreground">Users</h2>
          <DataTable
            data={data?.users ?? []}
            loading={isLoading}
            error={isError}
            onRetry={refetch}
            searchable={false}
            exportFilename={`${data?.profile.companyName ?? 'company'}-users`}
            rowKey={(row) => row.id}
            columns={[
              { key: 'name', header: 'Name', sortable: true },
              { key: 'email', header: 'Email' },
              { key: 'role', header: 'Role', render: (value) => <Badge>{value}</Badge> },
              { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
              { key: 'lastLoginAt', header: 'Last Login', render: (value) => (value ? formatDate(value) : '—') },
            ]}
          />
        </div>

        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold text-foreground">Billing & Tickets</h2>
          <div className="mt-4 space-y-6">
            <DataTable
              data={data?.paymentHistory ?? []}
              loading={isLoading}
              error={isError}
              onRetry={refetch}
              searchable={false}
              exportFilename={`${data?.profile.companyName ?? 'company'}-invoices`}
              rowKey={(row) => row.id}
              columns={[
                { key: 'invoiceNumber', header: 'Invoice' },
                { key: 'planName', header: 'Plan' },
                { key: 'paymentStatus', header: 'Status', render: (value) => <StatusBadge status={value} /> },
                { key: 'totalAmount', header: 'Total', render: (value) => `$${formatNumber(Number(value ?? 0))}` },
              ]}
            />
            <DataTable
              data={data?.tickets ?? []}
              loading={isLoading}
              error={isError}
              onRetry={refetch}
              searchable={false}
              exportFilename={`${data?.profile.companyName ?? 'company'}-tickets`}
              rowKey={(row) => row.id}
              columns={[
                { key: 'ticketId', header: 'Ticket' },
                { key: 'subject', header: 'Subject' },
                { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
                { key: 'priority', header: 'Priority', render: (value) => <Badge>{value}</Badge> },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="panel-strong p-5">
        <h2 className="text-sm font-semibold text-foreground">Audit Logs</h2>
        <DataTable
          data={data?.auditLogs ?? []}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          searchable={false}
          exportFilename={`${data?.profile.companyName ?? 'company'}-audit-logs`}
          rowKey={(row) => row.id}
          columns={[
            { key: 'action', header: 'Action', sortable: true },
            { key: 'actorRole', header: 'Role' },
            { key: 'createdAt', header: 'Time', render: (value) => formatDate(value) },
          ]}
        />
      </div>
    </PlatformPageFrame>
  );
}
