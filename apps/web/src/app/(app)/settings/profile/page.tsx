'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Upload, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { authApi, usersApi } from '@/lib/api';
import { useUploadSingle } from '@/hooks/useUploads';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const VALUE = 'text-sm font-medium text-slate-800 mt-0.5';

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={LABEL}>{label}</span>
      <span className={VALUE}>{value || '—'}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { setUser } = useAuthStore();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // authApi.me() calls getMe() which returns the full DB record (all fields)
  const { data: profile, isLoading } = useQuery({
    queryKey: ['auth', 'me', 'profile'],
    queryFn: () => authApi.me() as Promise<any>,
  });

  const [form, setForm] = useState({ name: '', phone: '', avatarUrl: '' });

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        avatarUrl: profile.avatarUrl ?? '',
      });
    }
  }, [profile]);

  const { mutate: uploadPhoto, isPending: uploadingPhoto } = useUploadSingle({
    onSuccess: (result) => setForm((f) => ({ ...f, avatarUrl: result.secureUrl })),
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => usersApi.update(profile.id, form),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['auth', 'me'] });
      setUser({ ...profile, name: updated.name, avatarUrl: updated.avatarUrl });
      toast.success('Profile updated');
    },
    onError: () => toast.error('Could not update profile'),
  });

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPhoto(file);
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <User className="h-5 w-5 text-indigo-500" />
        <h1 className="text-xl font-bold text-slate-900">Profile</h1>
      </div>

      {/* Avatar + basic info */}
      <div className="section-card flex items-center gap-5">
        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          {form.avatarUrl ? (
            <img src={form.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-400">
              {profile?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-base font-semibold text-slate-900">{profile?.name}</p>
          <p className="text-xs text-slate-500">{profile?.email}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{profile?.role} · {profile?.employeeId ?? 'No Employee ID'}</p>
          <div className="flex gap-2 mt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Upload className="h-3.5 w-3.5" />}
              onClick={() => fileInputRef.current?.click()}
              loading={uploadingPhoto}
            >
              Change Photo
            </Button>
            {form.avatarUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, avatarUrl: '' }))}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
      </div>

      {/* Editable fields */}
      <div className="section-card space-y-4">
        <p className="text-sm font-semibold text-slate-800">Personal Information</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Mobile Number"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save()} loading={saving} disabled={!profile?.id}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Read-only employment details */}
      <div className="section-card space-y-4">
        <p className="text-sm font-semibold text-slate-800">Employment Details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Employee ID" value={profile?.employeeId} />
          <DetailRow label="Role" value={profile?.role} />
          <DetailRow label="Department" value={profile?.department} />
          <DetailRow label="Designation" value={profile?.designation} />
          <DetailRow label="Employment Type" value={profile?.employmentType?.replace(/_/g, ' ')} />
          <DetailRow label="Work Mode" value={profile?.workMode} />
          <DetailRow label="Work Location" value={profile?.workLocation} />
          <DetailRow
            label="Joining Date"
            value={profile?.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : null}
          />
          <DetailRow label="Email" value={profile?.email} />
          <DetailRow label="Status" value={profile?.employeeStatus ?? profile?.status} />
        </div>
      </div>
    </div>
  );
}
