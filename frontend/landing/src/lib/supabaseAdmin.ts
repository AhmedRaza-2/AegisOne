import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || "https://xiktyrtujgdpegqttgac.supabase.co";
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa3R5cnR1amdkcGVncXR0Z2FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MzY2NTMsImV4cCI6MjA5MjQxMjY1M30.WIaiRzDxqEdPne_s3M_5EMk9sElDByHuNJM9NagpRaA";

// Separate Supabase client for the /admin super-admin panel, with its own
// sessionStorage-backed key. The public site's client (lib/supabase.ts)
// persists its session in localStorage, which is shared across every tab
// of this origin — so signing in/out on /admin was also signing tenants
// in/out of /register, /login and /portal in whatever other tab they had
// open. sessionStorage is per-tab and cleared when the tab closes, which
// also keeps the admin session from lingering.
export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-admin-auth-token',
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
