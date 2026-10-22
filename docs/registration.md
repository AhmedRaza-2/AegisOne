# Local organization registration

The website registers organizations through Supabase. Running the local FastAPI
server supplies the customer dashboard API; it does not configure the website's
registration service.

Set the following public connection values in `F:\AegisOne\.env` (the repository
root). Use the URL and publishable/anon key from the same Supabase project:

```dotenv
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-public-publishable-or-anon-key>
```

Replace both example values. The project must be active and its hostname must
resolve. Never place a service-role key in a `VITE_` variable.

Restart the website with `npm run dev` from `frontend/landing` after changing
configuration. Open `http://localhost:3000/register` and retry the form.

Check the connection without creating accounts, sending email or reading any
organization rows (Node 22.6+):

```powershell
npm --prefix frontend/landing run check:registration
```

If DNS lookup fails, open the project in the Supabase dashboard, verify the URL
and resume it if paused. Wait until the project is ready, then rerun the check.
A paused project's hostname can stop resolving; changing the organization name
or password will not fix that. See the
[Supabase DNS troubleshooting guide](https://supabase.com/docs/guides/troubleshooting/nxdomain-error-connecting-to-a-supabase-project).
An HTTP permissions/schema failure requires checking the intended table grants,
RLS policies and migrations. Keep RLS enabled. The diagnostic checks connectivity
and table access; it does not submit a registration or verify email delivery.

The project must have the `organizations` table and its registration function.
The existing function source is
`frontend/landing/supabase/register_organization.sql`; apply it to the intended
project after its organization schema exists. Registration does not bypass
database permissions or failed duplicate checks.

## Credential handling

Write raw dotenv values, without Markdown links or continuation backslashes.
The Supabase URL and publishable/anon key are public browser configuration;
database passwords, `AEGIS_JWT_SECRET`, `SETUP_KEY`, SMTP passwords and provider
keys stay on the server. The landing build exposes an explicit list of public
settings and rejects privileged Supabase keys. Unknown `VITE_` settings are not
automatically exposed.

Do not configure `VITE_ADMIN_PASSWORD`, `VITE_ADMIN_EMAIL` or `VITE_SETUP_KEY`.
Use the Supabase sign-in form for platform administration. Backend provisioning
reads only server-side `SETUP_KEY`; leave it empty to use the persistent generated
key. `.env` and `.env.*` files are excluded from Git and Docker build contexts,
while credential-free `.env.example` templates remain versioned.

Change any real administrator/database password that was pasted into chat or
otherwise shared. Generate new JWT/setup secrets when replacing exposed values;
restarting the API with a new JWT secret invalidates existing API sessions.
Changing a database password also requires updating the database server and
matching connection string. An anon key is designed to be public; it never
replaces database authorization. See
[Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

The platform `/admin` page requires the server-controlled
`app_metadata.role = "super_admin"`. User-editable metadata and email addresses
do not grant that role. If migrating an existing administrator, assign this role
through trusted Supabase administration. For example, in the project SQL Editor,
substitute the verified administrator's Auth user UUID before running:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"role":"super_admin"}'::jsonb
where id = '<verified-admin-auth-user-uuid>'::uuid;
```

Sign out and sign in again to refresh the claim. Server-side RLS and admin RPCs
must independently enforce this trusted role; a browser check is only a UI gate.

Website passwords are not stored in session storage or forwarded to the customer
server. The deployment portal sends only organization details to setup. Sign in
to the customer dashboard there, or explicitly create its first administrator on
a fresh instance. Enter that dashboard password directly on the customer server;
it is never passed in a URL or copied from the website registration form.

For testing an organization that already exists in the local API, sign in with
its administrator at `http://localhost:3002/login`, then open Organization Setup.
That existing-account path uses the local API rather than creating another
website registration.
