interface AppRoleUser {
  app_metadata?: Record<string, unknown> | null;
}

/** Supabase users can edit user_metadata; privileged roles belong in app_metadata. */
export function hasTrustedSuperAdminRole(user: AppRoleUser | null | undefined): boolean {
  return user?.app_metadata?.role === 'super_admin';
}
