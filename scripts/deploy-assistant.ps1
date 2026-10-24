<#
  Deploys the landing-page chatbot (Supabase Edge Function "assistant") to the central Supabase project.

  Before running:
    1. npx supabase login                      (opens the browser once)
    2. Create a NEW Groq key on the free plan and copy the limits of the chat model from
       https://console.groq.com/settings/limits
    3. Copy supabase/functions/assistant/.env.example to a file OUTSIDE the repository, fill it in
       (ASSISTANT_ENABLED=true, ASSISTANT_QUOTAS_VERIFIED=true, GROQ_API_KEY, ASSISTANT_IP_HASH_SECRET,
       the GROQ_* limits) and pass its path as -EnvFile.

  Usage:
    ./scripts/deploy-assistant.ps1 -ProjectRef xiktyrtujgdpegqttgac -EnvFile C:\secure\assistant.env

  The Vercel variables are public build settings and are printed at the end; set them in the Vercel
  project (Production) and redeploy.
#>
param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [Parameter(Mandatory = $true)][string]$EnvFile
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path $EnvFile)) { throw "Env file not found: $EnvFile" }
if ((Resolve-Path $EnvFile).Path.StartsWith((Resolve-Path ".").Path)) {
  throw "Keep the secrets file outside the repository folder."
}
$content = Get-Content $EnvFile -Raw
foreach ($required in "GROQ_API_KEY", "ASSISTANT_IP_HASH_SECRET", "GROQ_CHAT_RPM", "GROQ_CHAT_RPD", "GROQ_CHAT_TPM", "GROQ_CHAT_TPD") {
  if ($content -notmatch "(?m)^$required=\S+") { throw "$required is missing or empty in $EnvFile" }
}
if ($content -match "(?m)^GROQ_API_KEY=replace-with") { throw "Put your real Groq key in $EnvFile" }

npx supabase link --project-ref $ProjectRef
npx supabase db push
npx supabase functions deploy assistant --no-verify-jwt --project-ref $ProjectRef
npx supabase secrets set --env-file $EnvFile --project-ref $ProjectRef

$url = "https://$ProjectRef.supabase.co/functions/v1/assistant"
Write-Host ""
Write-Host "Function deployed. Quick check (expects a JSON reply, not 404):"
Write-Host "  curl.exe -i $url"
Write-Host ""
Write-Host "Now set these on the Vercel landing project (Production) and redeploy:"
Write-Host "  VITE_ASSISTANT_ENABLED=true"
Write-Host "  VITE_ASSISTANT_API_URL=$url"
Write-Host ""
Write-Host "Finally schedule select public.assistant_cleanup(); hourly if pg_cron is not enabled."
