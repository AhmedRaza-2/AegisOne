import { supabase, Organization } from './supabase';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generates a short random uppercase org ID like "ABC001" */
function generateOrgId(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const digits = String(Math.floor(100 + Math.random() * 900));
  return `${prefix}${digits}`;
}

/** Generates a deployment token like "X7D29-K3M11-P9Q82" */
function generateDeploymentToken(): string {
  const seg = () => Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${seg()}-${seg()}-${seg()}`;
}

/** Generates a license key like "XXXX-YYYY-ZZZZ-WWWW" */
function generateLicenseKey(): string {
  const seg = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${seg()}-${seg()}-${seg()}-${seg()}`;
}

// ─── Registration ────────────────────────────────────────────────────────────

export interface RegisterPayload {
  name: string;
  industry: string;
  employee_count: number;
  country: string;
  admin_name: string;
  admin_email: string;
  phone: string;
  password: string;
}

export async function registerOrganization(payload: RegisterPayload): Promise<Organization> {
  // 0+1. Run uniqueness check and auth user creation in parallel to cut latency
  const [checkRes, signUpRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('id')
      .ilike('name', payload.name)
      .maybeSingle(),
    supabase.auth.signUp({
      email: payload.admin_email,
      password: payload.password,
    }),
  ]);

  const existingOrg = checkRes.data;
  if (checkRes.error) {
    // Rollback the auth user we just created in parallel
    if (signUpRes.data?.user?.id) await supabase.auth.admin.deleteUser(signUpRes.data.user.id).catch(() => {});
    throw new Error('Failed to verify organization uniqueness.');
  }

  if (existingOrg) {
    // Name is taken — undo the parallel auth user creation
    if (signUpRes.data?.user?.id) await supabase.auth.admin.deleteUser(signUpRes.data.user.id).catch(() => {});
    throw new Error(`An organization named "${payload.name}" is already registered. Please login or contact support.`);
  }

  if (signUpRes.error) throw new Error(signUpRes.error.message);
  if (!signUpRes.data.user) throw new Error('Auth user creation failed.');

  const userId = signUpRes.data.user.id;

  // 2. Build the organization record
  const orgRecord = {
    auth_user_id: userId,
    org_id: generateOrgId(),
    name: payload.name,
    industry: payload.industry,
    employee_count: payload.employee_count,
    country: payload.country,
    admin_name: payload.admin_name,
    admin_email: payload.admin_email,
    phone: payload.phone,
    status: 'pending' as const,
    license_key: generateLicenseKey(),
    deployment_token: generateDeploymentToken(),
    allowed_users: payload.employee_count,
    product_version: '1.0.0',
  };

  const { data, error } = await supabase
    .from('organizations')
    .insert(orgRecord)
    .select()
    .single();

  if (error) {
    // Rollback: delete the auth user if DB insert fails
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(error.message);
  }

  return data as Organization;
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function loginOrganization(email: string, password: string): Promise<Organization> {
  // Single sign-in round-trip returns the user — use it directly for the org lookup
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(authError.message);

  const userId = authData.user?.id;
  if (!userId) throw new Error('Organization profile not found.');

  const org = await getOrganizationForUser(userId);
  if (!org) throw new Error('Organization profile not found.');
  return org;
}

async function getOrganizationForUser(userId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('auth_user_id', userId)
    .single();

  if (error) return null;
  return data as Organization;
}

// ─── Password Reset ─────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw new Error(error.message);
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function getMyOrganization(): Promise<Organization | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getOrganizationForUser(user.id);
}

export async function logoutOrganization(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ─── Admin Functions ─────────────────────────────────────────────────────────

export async function getOrganizations(): Promise<Organization[]> {
  // 1. Try fetching via RPC functions (which bypass RLS via SECURITY DEFINER)
  const rpcNames = ['get_all_organizations', 'list_organizations', 'get_organizations', 'get_organizations_admin'];
  for (const rpcName of rpcNames) {
    try {
      const { data, error } = await supabase.rpc(rpcName);
      if (!error && data) {
        console.log(`[org-service] Successfully fetched organizations using RPC: ${rpcName}`);
        return data as Organization[];
      }
    } catch (e) {
      // Continue to next RPC
    }
  }

  // 2. Fallback to direct table select (subject to RLS constraints)
  try {
    console.warn("[org-service] Falling back to direct table select (RLS restrictions apply)");
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("[org-service] Supabase select error:", error);
      return [];
    }
    
    return (data || []) as Organization[];
  } catch (e) {
    console.error("[org-service] Could not fetch Supabase orgs:", e);
    return [];
  }
}

export async function updateOrganizationStatus(orgId: string, status: 'active' | 'pending' | 'suspended', reason?: string): Promise<void> {
  // 1. Try updating status via the security-definer RPC to bypass RLS
  try {
    const { error } = await supabase.rpc('update_org_status', {
      org_id_param: orgId,
      status_param: status,
      reason_param: reason || null
    });
    if (!error) {
      console.log("[org-service] Successfully updated organization status via RPC");
      return;
    }
    console.warn("[org-service] RPC update_org_status failed:", error);
  } catch (e) {
    console.warn("[org-service] RPC update_org_status exception:", e);
  }

  // 2. Fallback to direct table update (subject to RLS constraints)
  const updates: any = { status };
  if (reason) {
    updates.product_version = reason;
  }

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId);

  if (error) {
    console.error("[org-service] Direct table update failed:", error);
    throw new Error(`Failed to update organization: ${error.message}`);
  }
}

export async function deleteOrganization(orgId: string): Promise<void> {
  try {
    // We call a secure RPC function on Supabase to delete both the org and the auth user.
    // This bypasses the frontend restriction on deleting auth users.
    const { error } = await supabase.rpc('delete_organization_and_user', {
      org_id_param: orgId
    });

    if (error) {
      // Fallback to normal delete if RPC doesn't exist yet
      console.warn("[org-service] RPC failed (maybe not created yet), falling back to normal delete:", error);
      const fallback = await supabase.from('organizations').delete().eq('id', orgId);
      if (fallback.error) throw new Error(`Supabase delete error: ${fallback.error.message}`);
    }
  } catch (e: any) {
    console.error("[org-service] Supabase delete failed:", e);
    throw new Error(e.message || "Failed to delete organization from cloud DB.");
  }
}

