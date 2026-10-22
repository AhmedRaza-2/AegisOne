# Real AI in local development

Add a **server-only** `GROQ_API_KEY` to the repository-root `.env` or the shell running Vite, then run this from `frontend/landing`:

```sh
npm run dev
```

Open the printed localhost URL. No Supabase project, hosted Edge Function, public API URL or browser-exposed provider key is required. Restart the development server after changing the key or server-side assistant configuration. A usable key activates the local API only in Vite's development `serve` mode. Explicit `VITE_ASSISTANT_ENABLED=false` or `ASSISTANT_DEV_ENABLED=false` keeps it disabled. An explicit `VITE_ASSISTANT_API_URL` takes precedence over the local API. The canonical Vite config reads the repository-root `.env`, rather than `frontend/landing/.env`.

The chatbot is mounted only on the landing homepage (`/`). Registration, sign-in, deployment portal, documentation and customer dashboard pages have no chatbot. Leaving the homepage closes the chat and stops active requests and voice. Product documentation and the existing setup controls remain available on their own pages.

The homepage widget derives the API URL from the current localhost origin, so alternate ports, `127.0.0.1` and IPv6 localhost work. AI answers are available automatically when the API is configured; visitors can send a question directly without an enable button. A short disclosure explains that messages and the current homepage section are processed by Groq. Without a usable key, the assistant uses local product guidance. Inline voice requires `VITE_ASSISTANT_VOICE_ENABLED=true`, HTTPS or localhost, a deliberate record action and browser microphone permission. Users review the transcript before sending it; remote plain-HTTP pages retain text chat.

The assistant detects English, Urdu and Roman Urdu from each message and the conversation. There is no language selector. Chat requests send a lightweight `language` hint and default to `languageMode: 'auto'`; the model chooses the reply language using the message, relevant history and explicit requests such as “reply in Urdu.” The offline detector preserves the previous language for short or ambiguous follow-ups. Voice transcription also detects the spoken language automatically, and requested spoken answers follow the reply language.

`frontend/landing/dev/assistant-gateway.mjs` adapts the same reviewed provider, policy, context and capability API used in production. By default it accepts only loopback network peers, a loopback Host on the actual listening port, and the exact page origin. LAN callers, foreign/null browser origins and DNS rebinding hosts are rejected.

The key is never added to `import.meta.env`, API responses or application logs. A public boolean `VITE_ASSISTANT_LOCAL_API` tells the widget that its same-origin route exists; it contains no credential. Production builds do not include the local gateway. The default customer Docker configuration does not enable it.

Local sessions and counters live only in bounded RAM: at most 50 sessions and 2,000 usage buckets. Server restart clears them. Expiry, minute-based cleanup, capability checks, separate chat/transcription scopes, idempotency, 45-second leases and cancellation use the same API semantics. Do not use this RAM store as a hosted production database. Conversation history can disappear when Vite restarts after a configuration/server-module edit; this is different from normal frontend hot reload.

Local application limits cap chat at 20 requests/day, 80,000 reserved/measured tokens/day, eight requests/minute and a 12,800-token minute budget per Vite process. The minute budget accommodates the conservative byte-based reservation for reviewed product/setup guidance and the automatic-language response schema. Existing per-session/IP limits also apply. Voice is bounded to 16 requests/day, 96 audio seconds/hour and 240 seconds/day, reserving 30 seconds/recording. Successful responses reconcile token reservations to known actual usage; uncertain/failed requests retain the full reservation. These are **local application caps, not verified Groq account limits**. Groq may impose lower/shared limits and return 429. There are no retries, paid upgrades or fallback providers. Use a Free account; keys do not encode whether account billing is enabled. Production still requires verified account-specific quotas and private Supabase storage.

The gateway uses Vite's server-side module loader, so reviewed knowledge/provider changes invalidate their module graph without relying on Node's permanent import cache. Configuration/key changes still restart Vite and clear RAM sessions. Do not edit configuration while testing a conversation whose local history you want to preserve.

The local API uses the same product advisor as the hosted function. Pure greetings and clear unrelated requests or instruction overrides are handled locally. Other homepage messages reach the model without a grammar or keyword whitelist, including small talk, misspellings, incomplete questions and unfamiliar wording. The model interprets the request against reviewed facts and can ask for clarification. Clearly unrelated stored turns and all earlier generated answers are excluded from new model prompts. Refresh the page and start a new chat to stop displaying old responses after updating; restart Vite if it still serves the previous code.

Ordinary product questions do not need exact wording or the product name: “hello why are you here?”, “is this product safe?” and “What AegisOne can do?” reach the product advisor. Safety answers explain phishing-risk reduction and its limits without certifying a deployment. Clock/date requests receive a brief local device-clock response, without a provider request, fabricated live values or unrelated documentation links.

First messages also recognize references such as “this software,” “this solution” and “your security platform.” “How can I integrate this software in my company?” goes directly to organization deployment guidance without a greeting or earlier chat. Broad integration questions distinguish organization deployment from API integration; short setup answers and bounded follow-ups such as “already registered,” “Windows 11” and “make it simpler” retain the relevant user context. The offline quick guide follows the same conversation style and provides the full setup checklist when requested.

Homepage routing does not require product/topic keywords. Compact product context is always available; topic matching adds detail instead of deciding whether AI may answer. The latest question controls the answer. Only short, elliptical follow-ups borrow a retrieval topic from history; there is no persistent installation-only instruction. Docker questions receive Docker installation guidance, trust/authentication questions distinguish account controls from unverified certification, and product-name questions avoid invented etymology. Deployment prerequisite questions retrieve Docker/Compose, server access, network/download requirements and later setup inputs. Hardware sizing remains explicitly unverified. The conversation tests exercise the reported transcript through the HTTP handler as well as varied first messages and follow-ups.

Structured output includes the same nonempty text, source-count and action-count limits as server validation. If AI falls back, the development gateway returns an `X-Assistant-Fallback-Reason` header with a fixed category such as `provider_limit`, `invalid_sources` or `incomplete_answer`. It contains no exception text, prompt, upstream body or key; hosted responses do not expose this development header.

Homepage questions such as “what should I do on this page?” use only the current homepage section. Visitors can also ask general deployment or organization-setup questions and follow links to the product guide. The chatbot does not observe the deployment portal, service readiness, setup fields, validation counts or rollout status, and cannot highlight or operate setup controls. Mixed unrelated requests still receive the topic redirect.

Offline gateway tests make no provider calls:

```sh
node --test --test-isolation=none frontend/landing/dev/tests/assistant-gateway.test.mjs
```

They exercise a real localhost HTTP server with a mocked provider: origin restrictions, automatic-language product/setup questions, capability auth, scope/expiry, concurrent quotas, idempotency, token reconciliation, key exclusion and cancellation. Real provider testing requires a configured key and explicit user authorization; never print or paste the key during testing.
