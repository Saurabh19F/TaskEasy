'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings, Plus, Trash2, Pencil, Power } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useToggleUserStatus } from '@/hooks/useUsers';
import { useProjects, useCreateProject, useToggleProjectStatus, useDeleteProject } from '@/hooks/useProjects';
import { UserFormModal, type UserFormValues } from '@/components/users/UserFormModal';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';
import { sanitizeUserFormValues } from '@/lib/user-form';
import { projectSchema, type ProjectFormValues } from '@/lib/schemas';
import type { User, Project } from '@/types';

const ALLOWED_ROLES = ['ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER'];

type AdminTab = 'users' | 'projects';

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<AdminTab>('users');

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);
  const [userModal, setUserModal] = useState<Partial<User> | null>(null);
  const [deleteUser, setDeleteUser] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<string | null>(null);
  const [projectModal, setProjectModal] = useState(false);
  const {
    register: registerProject, handleSubmit: handleSubmitProject, reset: resetProject,
    formState: { errors: projectErrors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: '', description: '', color: '#6366f1' },
  });

  const { data: users, isLoading: loadingUsers, isError: usersError, refetch: refetchUsers } = useUsers();
  const { data: projects, isLoading: loadingProjects, isError: projectsError, refetch: refetchProjects } = useProjects();
  const { mutate: createUser, isPending: creatingUser } = useCreateUser();
  const { mutate: updateUser, isPending: updatingUser } = useUpdateUser();
  const { mutate: removeUser, isPending: deletingUser } = useDeleteUser();
  const { mutate: toggleStatus } = useToggleUserStatus();
  const { mutate: createProject, isPending: creatingProject } = useCreateProject();
  const { mutate: toggleProjectStatus } = useToggleProjectStatus();
  const { mutate: removeProject, isPending: deletingProject } = useDeleteProject();

  const userColumns: Column<User>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { key: 'role', header: 'Role', render: (v) => (
      <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">{v}</span>
    )},
    { key: 'employeeId', header: 'Employee ID', render: (v) => v ?? '—' },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'createdAt', header: 'Created', render: (v) => formatDate(v) },
    {
      key: 'id', header: 'Actions',
      render: (_, row) => (
        <div className="flex gap-1">
          <button
            onClick={() => { setUserModal(row); }}
            className="rounded p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleStatus({ id: row.id, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}
            className="rounded p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
          >
            <Power className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDeleteUser(row.id)}
            className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const projectColumns: Column<Project>[] = [
    { key: 'name', header: 'Project', sortable: true },
    { key: 'description', header: 'Description', render: (v) => v ?? '—' },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'createdAt', header: 'Created', render: (v) => formatDate(v) },
    {
      key: 'id', header: 'Actions',
      render: (_, row) => (
        <div className="flex gap-1">
          <button
            onClick={() => toggleProjectStatus(row.id)}
            className="rounded p-1.5 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50"
            title={row.status === 'ACTIVE' ? 'Pause' : 'Activate'}
          >
            <Power className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteProject(row.id)} className="rounded p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const handleSaveUser = (form: UserFormValues) => {
    const payload = sanitizeUserFormValues(form);
    if (userModal?.id) {
      const { password: _password, ...updatePayload } = payload;
      updateUser({ id: userModal.id, ...updatePayload });
    } else {
      createUser(payload as any);
    }
    setUserModal(null);
  };

  useEffect(() => {
    if (!projectModal) resetProject();
  }, [projectModal, resetProject]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Admin Settings</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {(['users', 'projects'] as AdminTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 capitalize transition-colors ${
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            Manage {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <>
          <div className="flex justify-end">
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { setUserModal({}); }}>
              Add User
            </Button>
          </div>
          <DataTable columns={userColumns} data={users?.data ?? []} loading={loadingUsers} error={usersError} onRetry={refetchUsers} exportFilename="users" rowKey={(r) => r.id} />
        </>
      )}

      {/* Projects Tab */}
      {tab === 'projects' && (
        <>
          <div className="flex justify-end">
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setProjectModal(true)}>
              Add Project
            </Button>
          </div>
          <DataTable columns={projectColumns} data={projects?.data ?? []} loading={loadingProjects} error={projectsError} onRetry={refetchProjects} exportFilename="projects" rowKey={(r) => r.id} />
        </>
      )}

      <UserFormModal
        open={!!userModal}
        onClose={() => setUserModal(null)}
        title={userModal?.id ? 'Edit User' : 'Add User'}
        submitLabel={userModal?.id ? 'Save Changes' : 'Create'}
        mode={userModal?.id ? 'edit' : 'create'}
        initialValues={userModal ?? undefined}
        loading={creatingUser || updatingUser}
        onSubmit={handleSaveUser}
      />

      {/* Project Modal */}
      <Modal open={projectModal} onClose={() => setProjectModal(false)} title="Add Project" size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setProjectModal(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitProject((values) => {
                createProject(values);
                setProjectModal(false);
              })}
              loading={creatingProject}
            >
              Create Project
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={handleSubmitProject((values) => {
            createProject(values);
            setProjectModal(false);
          })}
        >
          <Input label="Project Name" error={projectErrors.name?.message} {...registerProject('name')} />
          <Input label="Description (optional)" {...registerProject('description')} />
          <div className="flex items-center gap-3">
            <Input type="color" label="Color Tag" className="h-9 w-12 p-1" {...registerProject('color')} />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-5">Pick a colour to identify this project</p>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!deleteUser} onClose={() => setDeleteUser(null)} onConfirm={() => removeUser(deleteUser!, { onSuccess: () => setDeleteUser(null) })} loading={deletingUser}
        title="Delete User" description="This will permanently delete the user from the platform. Past tasks will be retained but the user will not be able to log in again. This action cannot be undone." confirmLabel="Delete User" />

      <ConfirmModal open={!!deleteProject} onClose={() => setDeleteProject(null)} onConfirm={() => removeProject(deleteProject!, { onSuccess: () => setDeleteProject(null) })} loading={deletingProject}
        title="Delete Project" description="This will permanently delete the project from the platform. Existing tasks will be unlinked from the project but retained. This action cannot be undone." confirmLabel="Delete Project" />
    </div>
  );
}
