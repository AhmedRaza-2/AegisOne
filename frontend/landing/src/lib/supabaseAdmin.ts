import { createClient } from '@supabase/supabase-js';
import { supabaseConfiguration } from './supabase';


// Separate Supabase client for the /admin super-admin panel, with its own
// sessionStorage-backed key. The public site's client (lib/supabase.ts)
// persists its session in localStorage, which is shared across every tab
// of this origin — so signing in/out on /admin was also signing tenants
// in/out of /register, /login and /portal in whatever other tab they had
// open. sessionStorage is per-tab and cleared when the tab closes, which
// also keeps the admin session from lingering.
export const supabaseAdmin = createClient(supabaseConfiguration.url, supabaseConfiguration.anonKey, {
  auth: {
    storageKey: 'sb-admin-auth-token',
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
