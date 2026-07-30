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
  // 0. Check if the organization name is already registered
  const { data: existingOrg, error: checkError } = await supabase
    .from('organizations')
    .select('id')
    .ilike('name', payload.name)
    .maybeSingle();

  if (checkError) {
    throw new Error('Failed to verify organization uniqueness.');
  }
  
  if (existingOrg) {
    throw new Error(`An organization named "${payload.name}" is already registered. Please login or contact support.`);
  }

  // 1. Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: payload.admin_email,
    password: payload.password,
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Auth user creation failed.');

  const userId = authData.user.id;

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
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(authError.message);

  const org = await getMyOrganization();
  if (!org) throw new Error('Organization profile not found.');
  return org;
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

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (error) return null;
  return data as Organization;
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
  // 1. Fetch from Supabase cloud database
  let supabaseOrgs: Organization[] = [];
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      supabaseOrgs = data as Organization[];
    }
  } catch (e) {
    console.warn("[org-service] Could not fetch Supabase orgs:", e);
  }

  // 2. Fetch from local backend API
  let localOrgs: Organization[] = [];
  try {
    const res = await fetch("http://localhost:8000/admin/organizations");
    if (res.ok) {
      const data = await res.json();
      localOrgs = data as Organization[];
    }
  } catch (e) {
    console.warn("[org-service] Could not fetch local backend orgs:", e);
  }

  // 3. Deduplicate by lowercased name or email so all unique orgs show up cleanly
  const map = new Map<string, Organization>();

  // Add local orgs first
  for (const org of localOrgs) {
    const key = org.name.toLowerCase().trim();
    map.set(key, org);
  }

  // Layer Supabase orgs on top
  for (const org of supabaseOrgs) {
    const key = org.name.toLowerCase().trim();
    map.set(key, org);
  }

  return Array.from(map.values());
}

export async function updateOrganizationStatus(orgId: string, status: 'active' | 'pending' | 'suspended', reason?: string): Promise<void> {
  let updated = false;

  // 1. Try Supabase cloud update
  try {
    const updates: any = { status };
    if (reason) {
      updates.product_version = reason;
    }

    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId);

    if (!error) updated = true;
  } catch (e) {
    console.warn("[org-service] Supabase status update skipped/failed:", e);
  }

  // 2. Try Local backend API update
  try {
    const res = await fetch(`http://localhost:8000/admin/organizations/${encodeURIComponent(orgId)}/status?status=${status}`, {
      method: "PUT"
    });
    if (res.ok) updated = true;
  } catch (e) {
    console.warn("[org-service] Local backend status update skipped/failed:", e);
  }

  if (!updated) {
    throw new Error("Failed to update organization status in both cloud and local DB.");
  }
}

export async function deleteOrganization(orgId: string): Promise<void> {
  let deleted = false;

  // 1. Try Supabase cloud delete
  try {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (!error) deleted = true;
  } catch (e) {
    console.warn("[org-service] Supabase delete skipped/failed:", e);
  }

  // 2. Try Local backend API delete
  try {
    const res = await fetch(`http://localhost:8000/admin/organizations/${encodeURIComponent(orgId)}`, {
      method: "DELETE"
    });
    if (res.ok) deleted = true;
  } catch (e) {
    console.warn("[org-service] Local backend delete skipped/failed:", e);
  }

  if (!deleted) {
    throw new Error("Failed to delete organization from both cloud and local DB.");
  }
}

