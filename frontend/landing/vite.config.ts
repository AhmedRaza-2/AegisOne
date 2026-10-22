import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { createAssistantDevPlugin, devGatewayEnabled } from './dev/assistant-gateway.mjs';
import { resolveSupabaseConfiguration } from './src/lib/supabase-config';

export default defineConfig(({ command, mode }) => {
  const projectRoot = path.resolve(__dirname, '../../');
  // loadEnv's empty prefix is server-side only. Never expose this object via
  // define/import.meta.env; only the boolean local-gateway flag is public.
  const serverEnv = loadEnv(mode, projectRoot, '');
  const supabaseConfiguration = resolveSupabaseConfiguration(serverEnv);
  if (supabaseConfiguration.problem === 'invalid_key') {
    throw new Error('VITE_SUPABASE_ANON_KEY must be a public publishable/anon key for the configured project. Secret/service-role keys cannot be bundled.');
  }
  const localAssistant = command === 'serve' && mode === 'development' && devGatewayEnabled(serverEnv)
    && !serverEnv.VITE_ASSISTANT_API_URL?.trim();
  return {
    envDir: projectRoot,
    // Only explicitly approved public settings reach the browser, even if an
    // older .env still contains VITE_ADMIN_PASSWORD or VITE_SETUP_KEY.
    envPrefix: [],
    plugins: [react(), tailwindcss(), ...(command === 'serve' && mode === 'development' ? [createAssistantDevPlugin({ env: serverEnv, projectRoot })] : [])],
    define: {
      ...Object.fromEntries([
        'VITE_ASSISTANT_ENABLED', 'VITE_ASSISTANT_VOICE_ENABLED',
        'VITE_ASSISTANT_API_URL',
      ].filter(key => serverEnv[key] !== undefined).map(key => [`import.meta.env.${key}`, JSON.stringify(serverEnv[key])])),
      // Invalid URLs or missing settings may be detected before key validation.
      // Never expose their raw key; blanks also keep the browser guard unconfigured.
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseConfiguration.configured ? supabaseConfiguration.url : ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseConfiguration.configured ? supabaseConfiguration.anonKey : ''),
      'import.meta.env.VITE_ASSISTANT_LOCAL_API': JSON.stringify(localAssistant ? 'true' : 'false'),
    },
    css: {
      postcss: {}, // Prevents loading postcss.config.js from parent dir
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      fs: { allow: [path.resolve(__dirname, '..'), path.resolve(projectRoot, 'supabase/functions/assistant')] },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
