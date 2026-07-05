'use client';

import { BarChart3, Building2, CircleDollarSign, CreditCard, Database, LineChart, ShieldAlert, Users2 } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { TrendChart, ModuleBarChart } from '@/components/charts/TrendChart';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { usePlatformDashboard } from '@/hooks/usePlatform';
import { formatDate, formatFileSize, formatNumber } from '@/lib/utils';

export default function PlatformDashboardPage() {
  const { data, isLoading, isError, refetch } = usePlatformDashboard();

  const revenueData = data?.charts.revenueGrowth ?? [];
  const companyData = data?.charts.companyGrowth ?? [];
  const activityData = data?.charts.loginActivity ?? [];
  const moduleData = data?.charts.moduleUsage ?? [];

  return (
    <PlatformPageFrame
      title="Dashboard"
      description="Platform-wide health, revenue, company growth, billing, support, and security at a glance."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Companies', value: data?.stats.totalCompanies ?? 0, icon: Building2, color: 'indigo' as const },
          { label: 'Active Companies', value: data?.stats.activeCompanies ?? 0, icon: ShieldAlert, color: 'green' as const },
          { label: 'Trial Companies', value: data?.stats.trialCompanies ?? 0, icon: LineChart, color: 'yellow' as const },
          { label: 'Suspended Companies', value: data?.stats.suspendedCompanies ?? 0, icon: CreditCard, color: 'red' as const },
          { label: 'Platform Users', value: data?.stats.totalPlatformUsers ?? 0, icon: Users2, color: 'indigo' as const },
          { label: 'Employees', value: data?.stats.totalEmployees ?? 0, icon: Users2, color: 'blue' as const },
          { label: 'MRR', value: `$${formatNumber(Math.round(data?.stats.monthlyRecurringRevenue ?? 0))}`, icon: CircleDollarSign, color: 'green' as const },
          { label: 'System Health', value: `${data?.stats.systemHealth.score ?? 0}/100`, icon: Database, color: 'purple' as const },
        ].map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} icon={item.icon} color={item.color} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart title="Revenue Growth" data={revenueData.map((row) => ({ label: row.label, completed: row.value, pending: 0, delayed: 0 }))} />
        <TrendChart title="Company Growth" data={companyData.map((row) => ({ label: row.label, completed: row.value, pending: 0, delayed: 0 }))} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ModuleBarChart
          title="Module Usage"
          data={(data?.charts.moduleUsage ?? []).map((row) => ({
            module: row.label,
            total: row.value,
            done: row.value,
            pending: 0,
            delayed: 0,
          }))}
        />
        <TrendChart
          title="Login Activity"
          data={activityData.map((row) => ({ label: row.label, completed: row.value, pending: 0, delayed: 0 }))}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Recent Companies</h2>
          <DataTable
            data={data?.tables.recentlyOnboardedCompanies ?? []}
            loading={isLoading}
            error={isError}
            onRetry={refetch}
            searchable={false}
            exportFilename="recent-companies"
            rowKey={(row) => row.id}
            columns={[
              { key: 'companyName', header: 'Company', sortable: true },
              { key: 'ownerName', header: 'Owner', render: (value) => value ?? '—' },
              { key: 'plan', header: 'Plan' },
              { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
              { key: 'createdDate', header: 'Created', render: (value) => formatDate(value) },
            ]}
          />
        </div>

        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Recent Billing</h2>
          <DataTable
            data={data?.tables.recentPayments ?? []}
            loading={isLoading}
            error={isError}
            onRetry={refetch}
            searchable={false}
            exportFilename="recent-payments"
            rowKey={(row) => row.id}
            columns={[
              { key: 'tenantName', header: 'Company', sortable: true },
              { key: 'method', header: 'Method' },
              { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
              { key: 'amount', header: 'Amount', render: (value) => `$${formatNumber(Number(value ?? 0))}` },
              { key: 'createdAt', header: 'Created', render: (value) => formatDate(value) },
            ]}
          />
        </div>
      </div>

      <div className="panel-strong p-5">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Churn Risk Companies</h2>
        <DataTable
          data={data?.charts.churnRiskCompanies ?? []}
          loading={isLoading}
          error={isError}
          onRetry={refetch}
          searchable={false}
          exportFilename="churn-risk-companies"
          rowKey={(row) => row.id}
          columns={[
            { key: 'companyName', header: 'Company', sortable: true },
            { key: 'plan', header: 'Plan' },
            { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
            { key: 'totalUsers', header: 'Users' },
            { key: 'paymentStatus', header: 'Payment', render: (value) => <StatusBadge status={value} /> },
            { key: 'lastActivityAt', header: 'Last Activity', render: (value) => formatDate(value) },
          ]}
        />
      </div>
    </PlatformPageFrame>
  );
}
