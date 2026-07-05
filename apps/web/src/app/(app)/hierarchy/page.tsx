'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { hierarchyApi } from '@/lib/api';
import { getApiError } from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';
import { useActiveUsers } from '@/hooks/useUsers';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import type { HierarchyGroup } from '@/types';

const ALLOWED_ROLES = ['ADMIN', 'COMPANY_OWNER', 'SAAS_OWNER'];

export default function HierarchyPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [createModal, setCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (user && !ALLOWED_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['hierarchy'],
    queryFn: hierarchyApi.findAll,
  });
  const { data: users = [] } = useActiveUsers();

  const [form, setForm] = useState({
    groupName: '',
    adminId: '',
    memberIds: [] as string[],
  });

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => hierarchyApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hierarchy'] });
      setCreateModal(false);
      setForm({ groupName: '', adminId: '', memberIds: [] });
      toast.success('Group created');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  // FE-04 fix: pass id as mutation variable instead of closing over deleteTarget state.
  // If state changes between click and mutation fire (re-render), the stale closure
  // would delete the wrong group.
  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: (id: string) => hierarchyApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hierarchy'] });
      setDeleteTarget(null);
      toast.success('Group deleted');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const employeeUsers = users.filter((u) => u.role === 'EMPLOYEE' || u.role === 'VIEWER');
  const adminUsers = users.filter((u) => ['ADMIN', 'MANAGER', 'COMPANY_OWNER'].includes(u.role));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-500" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Set Hierarchy</h1>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateModal(true)}>
          Add Group
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-40 animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No hierarchy groups yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map((group: HierarchyGroup) => (
            <div key={group.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 card-shadow overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{group.groupName}</p>
                  <p className="text-xs text-indigo-500 mt-0.5">Admin: {group.admin?.name}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setDeleteTarget(group.id)}
                    className="rounded p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Members ({group.memberIds.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.memberIds.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">No members assigned</p>
                  ) : (
                    group.memberIds.slice(0, 5).map((id) => {
                      const u = users.find((x) => x.id === id);
                      return (
                        <span key={id} className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                          {u?.name ?? id}
                        </span>
                      );
                    })
                  )}
                  {group.memberIds.length > 5 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">+{group.memberIds.length - 5} more</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create Hierarchy Group" size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                // LE-13 fix: validate before calling mutation
                if (!form.groupName.trim()) { toast.error('Group name is required'); return; }
                if (!form.adminId) { toast.error('Please select an admin'); return; }
                create();
              }}
              loading={creating}
            >Create Group</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Group Name" value={form.groupName} onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))} placeholder="e.g. Sales Team" />
          <Select label="Admin / Manager" value={form.adminId} onChange={(e) => setForm((f) => ({ ...f, adminId: e.target.value }))}>
            <option value="">Select admin...</option>
            {adminUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
          </Select>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Team Members</p>
            <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto border rounded-lg p-2 dark:border-slate-700">
              {/* LE-15 fix: only show employee/viewer users as possible members, not other admins */}
              {employeeUsers.filter((u) => u.id !== form.adminId).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" className="rounded"
                    checked={form.memberIds.includes(u.id)}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      memberIds: e.target.checked ? [...f.memberIds, u.id] : f.memberIds.filter((id) => id !== u.id),
                    }))}
                  />
                  <span>{u.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{u.role}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove(deleteTarget)}
        loading={deleting}
        title="Delete Hierarchy Group"
        description="This will remove the group and all its member mappings. Tasks and data will not be deleted."
        confirmLabel="Delete Group"
      />
    </div>
  );
}
