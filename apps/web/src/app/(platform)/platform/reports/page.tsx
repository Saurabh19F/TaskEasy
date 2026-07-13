'use client';

import { BarChart3 } from 'lucide-react';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { usePlatformReports } from '@/hooks/usePlatform';
import { formatNumber } from '@/lib/utils';

export default function PlatformReportsPage() {
  const { data: revenue = [], isLoading: loadingRevenue, isError: revenueError } = usePlatformReports('revenue');
  const { data: companies = [], isLoading: loadingCompanies, isError: companiesError, refetch: refetchCompanies } = usePlatformReports('companies');

  const revenueObj = revenue as any;
  const totalRevenue = Number(revenueObj?.totalRevenue ?? 0);
  const paidRevenue = Number(revenueObj?.paidRevenue ?? 0);
  const pendingRevenue = Number(revenueObj?.pendingRevenue ?? 0);
  const invoiceCount = revenueObj?.invoiceCount ?? revenueObj?.length ?? 0;

  return (
    <PlatformPageFrame
      title="Reports"
      description="Export revenue, company growth, subscription, and user reports."
    >
      {loadingRevenue ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : revenueError ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-red-600 dark:text-red-400">
          Failed to load revenue data.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Total Revenue" value={`$${formatNumber(totalRevenue)}`} icon={BarChart3} color="green" />
          <StatCard label="Paid Revenue" value={`$${formatNumber(paidRevenue)}`} icon={BarChart3} color="blue" />
          <StatCard label="Pending Revenue" value={`$${formatNumber(pendingRevenue)}`} icon={BarChart3} color="yellow" />
          <StatCard label="Invoice Count" value={invoiceCount} icon={BarChart3} color="indigo" />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold text-foreground">Revenue Summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            {[
              { label: 'Total Revenue', value: `$${formatNumber(totalRevenue)}` },
              { label: 'Paid Revenue', value: `$${formatNumber(paidRevenue)}` },
              { label: 'Pending Revenue', value: `$${formatNumber(pendingRevenue)}` },
              { label: 'Invoices', value: String(invoiceCount) },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-border bg-surface-muted px-4 py-3">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel-strong p-5">
          <h2 className="text-sm font-semibold text-foreground">Company Report</h2>
          <DataTable
            data={companies}
            loading={loadingCompanies}
            error={companiesError}
            onRetry={refetchCompanies}
            searchable={false}
            exportFilename="platform-company-report"
            rowKey={(row) => row.id}
            columns={[
              { key: 'companyName', header: 'Company' },
              { key: 'plan', header: 'Plan' },
              { key: 'status', header: 'Status', render: (value) => <StatusBadge status={value} /> },
              { key: 'totalUsers', header: 'Users' },
            ]}
          />
        </div>
      </div>
    </PlatformPageFrame>
  );
}
