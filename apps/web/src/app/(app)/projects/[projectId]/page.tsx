'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => projectsApi.findOne(projectId),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!project) return <div className="text-center py-20 text-slate-500">Project not found.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <FolderKanban className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Project Detail</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="h-5 w-5 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.color ?? '#6366f1' }}
            />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{project.name}</h2>
          </div>
          <StatusBadge status={project.status} />
        </div>

        {project.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{project.description}</p>
        )}

        <div className="text-sm text-slate-500">
          Created: <span className="text-slate-700 dark:text-slate-300 font-medium">{formatDate(project.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
