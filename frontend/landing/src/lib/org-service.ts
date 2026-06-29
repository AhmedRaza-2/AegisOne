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
    status: 'active' as const,  // auto-activate for now
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
