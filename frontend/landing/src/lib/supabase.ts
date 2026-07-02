import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://xiktyrtujgdpegqttgac.supabase.co";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa3R5cnR1amdkcGVncXR0Z2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzY2NTMsImV4cCI6MjA5MjQxMjY1M30.WIaiRzDxqEdPne_s3M_5EMk9sElDByHuNJM9NagpRaA";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
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
