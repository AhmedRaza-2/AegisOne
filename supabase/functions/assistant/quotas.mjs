import { ApiError } from './policy.mjs';

export const CHAT_MODEL = 'openai/gpt-oss-120b';
export const CHAT_MODELS = Object.freeze(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
export const TRANSCRIPTION_MODEL = 'whisper-large-v3';
export const MAX_COMPLETION_TOKENS = 1200;
const requiredLimits = ['GROQ_CHAT_RPM', 'GROQ_CHAT_RPD', 'GROQ_CHAT_TPM', 'GROQ_CHAT_TPD', 'GROQ_AUDIO_RPM', 'GROQ_AUDIO_RPD', 'GROQ_AUDIO_ASH', 'GROQ_AUDIO_ASD'];

export function loadConfig(get) {
  const limits = {};
  for (const key of requiredLimits) {
    const raw = Number(get(key));
    limits[key] = Number.isSafeInteger(raw) && raw > 0 ? Math.floor(raw * 0.8) : 0;
  }
  const config = {
    enabled: get('ASSISTANT_ENABLED') === 'true',
    voiceEnabled: get('ASSISTANT_VOICE_ENABLED') === 'true',
    quotasVerified: get('ASSISTANT_QUOTAS_VERIFIED') === 'true' && requiredLimits.every(k => limits[k] > 0),
    groqKey: get('GROQ_API_KEY') || '',
    chatModel: get('ASSISTANT_CHAT_MODEL') || CHAT_MODEL,
    supabaseUrl: get('SUPABASE_URL') || '',
    serviceKey: get('SUPABASE_SERVICE_ROLE_KEY') || '',
    ipSecret: get('ASSISTANT_IP_HASH_SECRET') || '',
    limits,
  };
  config.available = config.enabled && config.quotasVerified && Boolean(config.groqKey) && config.ipSecret.length >= 32 && CHAT_MODELS.includes(config.chatModel);
  return config;
}

export function requireEnabled(config, scope) {
  if (!config.available || (scope === 'transcription' && !config.voiceEnabled)) {
    throw new ApiError(503, 'unavailable', 'AI help is unavailable. Basic help is still available.');
  }
}

export function bucket(key, period, limit, amount = 1, now = new Date()) {
  const milliseconds = { minute: 60000, hour: 3600000, day: 86400000 }[period];
  const start = Math.floor(now.getTime() / milliseconds) * milliseconds;
  return { key: `${key}:${period}`, start: new Date(start).toISOString(), end: new Date(start + milliseconds).toISOString(), limit, amount };
}

export function creationBuckets(ipHash, now) {
  return [bucket(`new-session:ip:${ipHash}`, 'minute', 6, 1, now), bucket(`new-session:ip:${ipHash}`, 'day', 60, 1, now), bucket('new-session:global', 'minute', 60, 1, now), bucket('new-session:global', 'day', 1000, 1, now)];
}

export function requestBuckets(config, scope, sessionId, ipHash, reservedTokens, now) {
  const shared = [bucket(`requests:session:${sessionId}`, 'minute', 6, 1, now), bucket(`requests:session:${sessionId}`, 'day', scope === 'chat' ? 30 : 20, 1, now), bucket(`requests:ip:${ipHash}`, 'minute', 12, 1, now), bucket(`requests:ip:${ipHash}`, 'day', 120, 1, now)];
  const l = config.limits;
  const model = config.chatModel;
  if (scope === 'chat') return [...shared,
    bucket(`groq:${model}:requests`, 'minute', l.GROQ_CHAT_RPM, 1, now),
    bucket(`groq:${model}:requests`, 'day', l.GROQ_CHAT_RPD, 1, now),
    bucket(`groq:${model}:tokens`, 'minute', l.GROQ_CHAT_TPM, reservedTokens, now),
    bucket(`groq:${model}:tokens`, 'day', l.GROQ_CHAT_TPD, reservedTokens, now)];
  return [...shared,
    bucket(`groq:${TRANSCRIPTION_MODEL}:requests`, 'minute', l.GROQ_AUDIO_RPM, 1, now),
    bucket(`groq:${TRANSCRIPTION_MODEL}:requests`, 'day', l.GROQ_AUDIO_RPD, 1, now),
    bucket(`groq:${TRANSCRIPTION_MODEL}:seconds`, 'hour', l.GROQ_AUDIO_ASH, 30, now),
    bucket(`groq:${TRANSCRIPTION_MODEL}:seconds`, 'day', l.GROQ_AUDIO_ASD, 30, now)];
}

export function reserveTokenCount(messages, schema) {
  // UTF-8 bytes are a conservative upper bound for ordinary text tokens. Include
  // message framing and the entire completion allowance, including reasoning.
  const schemaBytes = schema ? new TextEncoder().encode(JSON.stringify(schema)).length : 0;
  return messages.reduce((total, m) => total + new TextEncoder().encode(m.content).length + 32, MAX_COMPLETION_TOKENS + 128 + schemaBytes);
}
