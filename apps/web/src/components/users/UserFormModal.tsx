'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Upload, X } from 'lucide-react';
import { useActiveUsers } from '@/hooks/useUsers';
import { useUploadSingle } from '@/hooks/useUploads';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type {
  EmploymentType,
  EmployeeStatus,
  Gender,
  Role,
  User,
  WorkMode,
} from '@/types';

export interface UserFormValues {
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  role: Role;
  gender: Gender | '';
  dateOfBirth: string;
  anniversaryDate: string;
  avatarUrl: string;
  department: string;
  designation: string;
  managerId: string;
  joiningDate: string;
  employmentType: EmploymentType | '';
  workMode: WorkMode | '';
  workLocation: string;
  employeeStatus: EmployeeStatus | '';
  password: string;
  punchInTime: string;
  buddyId: string;
  officeDays: string[];
  weeklyOff: string[];
}

// Punch-in tracking (and the buddy backup-coverage system) only applies to
// these roles — mirrors PUNCH_TRACKED_ROLES in the backend's CreateUserDto.
const PUNCH_TRACKED_ROLES: Role[] = ['MANAGER', 'EMPLOYEE', 'VIEWER'];

const DEFAULT_FORM: UserFormValues = {
  name: '',
  email: '',
  phone: '',
  employeeId: '',
  role: 'EMPLOYEE',
  gender: '',
  dateOfBirth: '',
  anniversaryDate: '',
  avatarUrl: '',
  department: '',
  designation: '',
  managerId: '',
  joiningDate: '',
  employmentType: 'FULL_TIME',
  workMode: '',
  workLocation: '',
  employeeStatus: 'ACTIVE',
  password: '',
  punchInTime: '09:30',
  buddyId: '',
  officeDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  weeklyOff: ['SUN'],
};

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const DEPARTMENT_OPTIONS = [
  'Administration',
  'Finance',
  'Human Resources',
  'IT',
  'Marketing',
  'Operations',
  'Product',
  'Sales',
  'Support',
  'Other',
];

const DESIGNATION_OPTIONS = [
  'Associate',
  'Executive',
  'Senior Executive',
  'Lead',
  'Manager',
  'Senior Manager',
  'Director',
  'Other',
];

const EMPLOYMENT_OPTIONS: Array<{ value: EmploymentType; label: string }> = [
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'INTERN', label: 'Intern' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'FREELANCER', label: 'Freelancer' },
  { value: 'PROBATION', label: 'Probation' },
];

const WORK_MODE_OPTIONS: Array<{ value: WorkMode; label: string }> = [
  { value: 'ONSITE', label: 'On Site' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'FIELD', label: 'Field' },
];

const EMPLOYEE_STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RESIGNED', label: 'Resigned' },
];

// Validation mirrors the `canSubmit` checks this form used to compute by
// hand — same required fields, same conditional punch-tracking/password
// rules — just surfaced as per-field messages instead of one silent
// disabled-button state.
function buildUserFormSchema(mode: 'create' | 'edit') {
  return z
    .object({
      name: z.string().trim().min(1, 'Full name is required'),
      email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
      phone: z.string().trim().min(1, 'Mobile number is required'),
      employeeId: z.string().optional(),
      role: z.string().min(1, 'Role is required') as z.ZodType<Role>,
      gender: z.string().min(1, 'Gender is required'),
      dateOfBirth: z.string().min(1, 'Date of birth is required'),
      anniversaryDate: z.string().optional(),
      avatarUrl: z.string().optional(),
      department: z.string().trim().min(1, 'Department is required'),
      designation: z.string().trim().min(1, 'Designation is required'),
      managerId: z.string().optional(),
      joiningDate: z.string().min(1, 'Joining date is required'),
      employmentType: z.string().min(1, 'Employment type is required'),
      workMode: z.string().optional(),
      workLocation: z.string().optional(),
      employeeStatus: z.string().min(1, 'Employee status is required'),
      password: z.string().optional(),
      punchInTime: z.string().optional(),
      buddyId: z.string().optional(),
      officeDays: z.array(z.string()).optional(),
      weeklyOff: z.array(z.string()).optional(),
    })
    .superRefine((data, ctx) => {
      if (mode === 'create' && (data.password ?? '').trim().length < 8) {
        ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password must be at least 8 characters' });
      }
      if (PUNCH_TRACKED_ROLES.includes(data.role as Role)) {
        if (!(data.punchInTime ?? '').trim()) {
          ctx.addIssue({ code: 'custom', path: ['punchInTime'], message: 'Punch-in time is required for this role' });
        }
        if (!(data.buddyId ?? '').trim()) {
          ctx.addIssue({ code: 'custom', path: ['buddyId'], message: 'A buddy is required for this role' });
        }
      }
    });
}

function joinSelectOptions(options: string[]) {
  return options.map((option) => (
    <option key={option} value={option}>
      {option}
    </option>
  ));
}

function formatEmployeeId(employeeId?: string) {
  return employeeId || 'Auto-generated on save';
}

interface UserFormModalProps {
  open: boolean;
  title: string;
  submitLabel: string;
  mode: 'create' | 'edit';
  initialValues?: Partial<UserFormValues> & { id?: string };
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => void;
}

export function UserFormModal({
  open,
  title,
  submitLabel,
  mode,
  initialValues,
  loading,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const { data: activeUsers = [] } = useActiveUsers();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const schema = useMemo(() => buildUserFormSchema(mode), [mode]);

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_FORM,
  });

  const { mutate: uploadPhoto, isPending: uploadingPhoto } = useUploadSingle({
    onSuccess: (result) => {
      setValue('avatarUrl', result.secureUrl, { shouldDirty: true });
    },
  });

  const role = watch('role');
  const avatarUrl = watch('avatarUrl');
  const weeklyOff = watch('weeklyOff') ?? [];

  const ALL_DAYS = [
    { value: 'MON', label: 'Mon' },
    { value: 'TUE', label: 'Tue' },
    { value: 'WED', label: 'Wed' },
    { value: 'THU', label: 'Thu' },
    { value: 'FRI', label: 'Fri' },
    { value: 'SAT', label: 'Sat' },
    { value: 'SUN', label: 'Sun' },
  ];

  useEffect(() => {
    if (!open) return;
    const { id: _id, ...rest } = initialValues ?? {};
    reset({
      ...DEFAULT_FORM,
      ...rest,
      password: mode === 'create' ? rest.password ?? DEFAULT_FORM.password : '',
    });
  }, [open, initialValues, mode, reset]);

  const managerOptions = useMemo(
    () =>
      activeUsers.filter((user: User) => user.id !== initialValues?.id),
    [activeUsers, initialValues?.id],
  );

  // Same pool as managerOptions (any active user besides yourself) — a buddy
  // is just a backup person, not necessarily a manager.
  const buddyOptions = managerOptions;

  const requiresPunchTracking = PUNCH_TRACKED_ROLES.includes(role);

  const handlePhotoPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    uploadPhoto(file);
    event.target.value = '';
  };

  const onFormSubmit = (values: UserFormValues) => {
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="2xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit(onFormSubmit)} loading={loading}>{submitLabel}</Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onFormSubmit)}>

        {/* Personal Info */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
          <Input label="Full Name *" error={errors.name?.message} {...register('name')} />
          <Input label="Email *" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Mobile *" type="tel" inputMode="numeric" error={errors.phone?.message} {...register('phone')} />
          <Select label="Gender *" error={errors.gender?.message} {...register('gender')}>
            <option value="">Select</option>
            {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Input label="Date of Birth *" type="date" error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
          <Input label="Anniversary Date" type="date" {...register('anniversaryDate')} />
          <Input label="Employee ID" value={formatEmployeeId(initialValues?.employeeId)} disabled readOnly />
        </div>

        {/* Photo — compact inline row */}
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-200 px-3 py-2">
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {avatarUrl
              ? <img src={avatarUrl} alt="Preview" className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center text-slate-400"><Camera className="h-4 w-4" /></div>}
          </div>
          <span className="text-xs text-slate-500 flex-1">Profile photo (optional)</span>
          <Button type="button" variant="outline" size="xs" leftIcon={<Upload className="h-3 w-3" />}
            onClick={() => fileInputRef.current?.click()} loading={uploadingPhoto}>
            Upload
          </Button>
          {avatarUrl && (
            <Button type="button" variant="ghost" size="xs" leftIcon={<X className="h-3 w-3" />}
              onClick={() => setValue('avatarUrl', '', { shouldDirty: true })}>
              Remove
            </Button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
        </div>

        {/* Work Info */}
        <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
          <Select label="Department *" error={errors.department?.message} {...register('department')}>
            <option value="">Select</option>
            {joinSelectOptions(DEPARTMENT_OPTIONS)}
          </Select>
          <Select label="Designation *" error={errors.designation?.message} {...register('designation')}>
            <option value="">Select</option>
            {joinSelectOptions(DESIGNATION_OPTIONS)}
          </Select>
          <Select label="Role *" error={errors.role?.message} {...register('role')}>
            {['ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER'].map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </Select>
          <Select label="Reporting Manager" {...register('managerId')}>
            <option value="">Select</option>
            {managerOptions.map((m: User) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Input label="Joining Date *" type="date" error={errors.joiningDate?.message} {...register('joiningDate')} />
          <Select label="Employment Type *" error={errors.employmentType?.message} {...register('employmentType')}>
            {EMPLOYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select label="Work Mode" {...register('workMode')}>
            <option value="">Select</option>
            {WORK_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Input label="Work Location" {...register('workLocation')} />
          <Select label="Employee Status *" error={errors.employeeStatus?.message} {...register('employeeStatus')}>
            {EMPLOYEE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          {mode === 'create' && (
            <Input label="Initial Password *" type="password" error={errors.password?.message} {...register('password')} />
          )}
        </div>

        {/* Attendance (only for tracked roles) */}
        {requiresPunchTracking && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="mb-2 text-xs font-semibold text-amber-800">Attendance &amp; Backup Coverage</p>
            <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
              <Input label="Punch-In Time *" type="time" error={errors.punchInTime?.message} {...register('punchInTime')} />
              <div className="col-span-2">
                <Select label="Buddy (Backup Person) *" error={errors.buddyId?.message} {...register('buddyId')}>
                  <option value="">Select buddy</option>
                  {buddyOptions.map((o: User) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </div>
              <div className="col-span-3">
                <p className="mb-1 text-xs font-medium text-amber-800">Weekly Off</p>
                <div className="flex gap-1.5">
                  {ALL_DAYS.map(({ value, label }) => {
                    const on = weeklyOff.includes(value);
                    return (
                      <button key={value} type="button" onClick={() => setValue('weeklyOff', [value], { shouldDirty: true })}
                        className="rounded-full px-2.5 py-1 text-xs font-semibold transition-all"
                        style={on
                          ? { background: '#EF4444', color: '#ffffff' }
                          : { border: '1px solid #FECACA', background: '#ffffff', color: '#EF4444' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
