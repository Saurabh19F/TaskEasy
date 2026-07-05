'use client';

import { BarChart3 } from 'lucide-react';
import { PlatformPageFrame } from '@/components/platform/PlatformPageFrame';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { usePlatformReports } from '@/hooks/usePlatform';
import { formatNumber } from '@/lib/utils';

export default function PlatformReportsPage() {
  const { data: revenue = [] } = usePlatformReports('revenue');
  const { data: companies = [], isLoading: loadingCompanies, isError: companiesError, refetch: refetchCompanies } = usePlatformReports('companies');

  return (
    <PlatformPageFrame
      title="Reports"
      description="Export revenue, company growth, subscription, and user reports."
      actions={<BarChart3 className="h-5 w-5 text-amber-300" />}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Revenue Data Points" value={revenue?.invoiceCount ?? revenue?.length ?? 0} icon={BarChart3} color="green" />
        <StatCard label="Companies in Report" value={companies.length} icon={BarChart3} color="indigo" />
        <StatCard label="Revenue Total" value={`$${formatNumber(Number(revenue?.totalRevenue ?? 0))}`} icon={BarChart3} color="purple" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/10 bg-slate-950/70 p-5 shadow-xl">
          <h2 className="text-sm font-semibold text-contrast">Revenue Summary</h2>
          <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-300">{JSON.stringify(revenue, null, 2)}</pre>
        </div>
        <div className="rounded-2xl border border-slate-200/10 bg-slate-950/70 p-5 shadow-xl">
          <h2 className="text-sm font-semibold text-contrast">Company Report</h2>
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
              { key: 'status', header: 'Status', render: (value) => <Badge className="bg-slate-800 text-slate-200">{value}</Badge> },
              { key: 'totalUsers', header: 'Users' },
            ]}
          />
        </div>
      </div>
    </PlatformPageFrame>
  );
}
