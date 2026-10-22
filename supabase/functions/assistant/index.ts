import { createHandler } from './handler.mjs';

// Function JWT verification is disabled in config.toml because this is an
// explicitly public, capability-only API. All persistent operations check the
// hashed capability server-side; only this process holds the service-role key.
Deno.serve(createHandler());
