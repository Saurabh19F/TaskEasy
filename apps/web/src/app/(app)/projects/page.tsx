'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FolderKanban, Plus } from 'lucide-react';
import { useProjects, useCreateProject, useToggleProjectStatus } from '@/hooks/useProjects';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { projectSchema, type ProjectFormValues } from '@/lib/schemas';
import type { Project } from '@/types';

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER'].includes(user?.role ?? '');

  const { data, isLoading, isError, refetch } = useProjects();
  const { mutate: create, isPending: creating } = useCreateProject();
  const { mutate: toggleStatus } = useToggleProjectStatus();

  const [createModal, setCreateModal] = useState(false);
  const {
    register, handleSubmit, reset,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: '', description: '', color: '#6366f1' },
  });

  useEffect(() => {
    if (!createModal) reset();
  }, [createModal, reset]);

  const onCreate = (values: ProjectFormValues) => {
    create(values, { onSuccess: () => { setCreateModal(false); reset(); } });
  };

  const columns: Column<Project>[] = [
    {
      key: 'name',
      header: 'Project',
      sortable: true,
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.color ?? '#6366f1' }} />
          <span className="font-medium text-slate-800 dark:text-slate-200">{v}</span>
        </div>
      ),
    },
    { key: 'description', header: 'Description', render: (v) => v ?? '—' },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'createdAt', header: 'Created', sortable: true, render: (v) => formatDate(v) },
    ...(isAdmin
      ? [{
          key: 'id' as keyof Project,
          header: 'Actions',
          render: (_: any, row: Project) => (
            <Button size="xs" variant="outline" onClick={() => toggleStatus(row.id)}>
              {row.status === 'ACTIVE' ? 'Pause' : 'Activate'}
            </Button>
          ),
        }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Projects</h1>
        </div>
        {isAdmin && (
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateModal(true)}>
            New Project
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        error={isError}
        onRetry={refetch}
        exportFilename="projects"
        exportTitle="Projects"
        rowKey={(r) => r.id}
        emptyMessage="No projects found"
      />

      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="New Project"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onCreate)} loading={creating}>
              Create
            </Button>
          </>
        }
      >
        {/* LE-16 fix: removed onSubmit — footer button already calls handleSubmit(onCreate).
            Having both <form onSubmit> and button onClick caused double submission. */}
        <form className="space-y-4">
          <Input label="Project Name *" error={errors.name?.message} {...register('name')} />
          <Textarea label="Description" {...register('description')} />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Colour</label>
            <input type="color" {...register('color')}
              className="h-9 w-16 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer" />
          </div>
        </form>
      </Modal>
    </div>
  );
}
