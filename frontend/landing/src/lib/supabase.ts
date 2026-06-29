import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─────────────────────────────────────────────
// Types mirroring the Supabase DB schema
// ─────────────────────────────────────────────
export type OrgStatus = 'pending' | 'active' | 'suspended';

export interface Organization {
  id: string;
  org_id: string;            // e.g. "ABC001"
  name: string;
  industry: string;
  employee_count: number;
  country: string;
  admin_name: string;
  admin_email: string;       // used as Supabase Auth email
  phone: string;
  status: OrgStatus;
  license_key: string;       // e.g. "XXXX-YYYY-ZZZZ"
  deployment_token: string;  // e.g. "X7D29..."
  allowed_users: number;
  product_version: string;
  created_at: string;
}
