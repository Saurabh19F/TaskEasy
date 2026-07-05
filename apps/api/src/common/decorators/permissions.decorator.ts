import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Usage: @RequirePermissions(PERMISSIONS.TASK_APPROVE)
 * Applied to controller methods. Checked by PermissionsGuard.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
