import type { UserFormValues } from '@/components/users/UserFormModal';

export function sanitizeUserFormValues(values: UserFormValues) {
  return {
    ...values,
    employeeId: values.employeeId.trim() || undefined,
    managerId: values.managerId.trim() || undefined,
    buddyId: values.buddyId.trim() || undefined,
    avatarUrl: values.avatarUrl.trim() || undefined,
    workMode: values.workMode.trim() || undefined,
    workLocation: values.workLocation.trim() || undefined,
    punchInTime: values.punchInTime.trim() || undefined,
  };
}
