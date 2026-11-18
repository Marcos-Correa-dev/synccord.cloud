import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';
export const RequirePermissions = (...permissions: bigint[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
