import { isLanguage, newId, type Language } from './contracts.ts';
const VERSION = 1;
const MAX_MESSAGE = 8000;
export function isBridgeMessage(data: unknown, channel: string): data is Record<string, any> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const d = data as Record<string, any>;
  try { if (JSON.stringify(d).length > MAX_MESSAGE) return false; } catch { return false; }
  return d.version === VERSION && d.channel === channel && ['INIT', 'ACK', 'PING', 'PONG', 'TRANSCRIPT', 'ANSWER', 'DISCONNECT'].includes(d.type);
}
export function createCompanionBridge(options: { url: string; onTranscript: (text: string, language: Language) => void; onState?: (connected: boolean) => void; onError?: (message: string) => void }) {
  let popup: Window | null = null;
  let origin = ''; let channel = ''; let connected = false; let lastPong = 0; let openedAt = 0; let sequence = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const post = (data: Record<string, unknown>) => popup?.postMessage({ ...data, version: VERSION, channel }, origin);
  function cleanup(closeWindow: boolean) {
    if (timer) clearInterval(timer); timer = undefined;
    if (popup && !popup.closed && connected) post({ type: 'DISCONNECT' });
    if (closeWindow) popup?.close();
    popup = null; connected = false; options.onState?.(false);
  }
  function receive(event: MessageEvent) {
    if (!popup || event.source !== popup || event.origin !== origin || !isBridgeMessage(event.data, channel)) return;
    const d = event.data;
    if (d.type === 'ACK' || d.type === 'PONG') { lastPong = Date.now(); if (!connected) { connected = true; options.onState?.(true); } }
    if (d.type === 'DISCONNECT') cleanup(false);
    if (d.type === 'TRANSCRIPT' && connected && isLanguage(d.language) && typeof d.text === 'string' && d.text.trim() && d.text.length <= 2000) options.onTranscript(d.text.trim(), d.language);
  }
  if (typeof window !== 'undefined') window.addEventListener('message', receive);
  return {
    open(): boolean {
      cleanup(true);
      try { const u = new URL(options.url); if (u.protocol !== 'https:' || u.search || u.hash || u.username || u.password) throw new Error(); origin = u.origin; }
      catch { options.onError?.('Configure a trusted HTTPS voice companion URL.'); return false; }
      channel = newId(); openedAt = Date.now(); lastPong = openedAt;
      // Deliberately retain opener. The setup route uses Referrer-Policy:no-referrer.
      popup = window.open(options.url, `aegis-assistant-voice-${channel}`, 'popup,width=460,height=640');
      if (!popup) { options.onError?.('The voice window was blocked. Allow popups or continue with text.'); return false; }
      timer = setInterval(() => {
        if (!popup || popup.closed) { cleanup(false); return; }
        if (!connected) {
          if (Date.now() - openedAt > 10_000) { cleanup(true); options.onError?.('The voice window could not connect. Text chat is still available.'); return; }
          post({ type: 'INIT' });
        } else {
          if (Date.now() - lastPong > 10_000) { cleanup(true); options.onError?.('Voice disconnected. Please reopen the voice window.'); return; }
          post({ type: 'PING' });
        }
      }, 500);
      return true;
    },
    sendAnswer(turnId: string, speechText: string, language: Language) {
      if (connected && typeof turnId === 'string' && turnId.length <= 100 && speechText.length <= 6000 && isLanguage(language)) post({ type: 'ANSWER', turnId, text: speechText, language, sequence: ++sequence });
    },
    close() { cleanup(true); },
    dispose() { cleanup(true); if (typeof window !== 'undefined') window.removeEventListener('message', receive); },
  };
}
export function createCompanionReceiver(options: { onInit: (origin?: string) => void; onAnswer: (turnId: string, text: string, language: Language) => void; onDisconnect: () => void }) {
  let origin = ''; let channel = ''; let peer: Window | null = null; let lastPing = 0; let lastSequence = 0; let timer: ReturnType<typeof setInterval> | undefined;
  function post(data: Record<string, unknown>) { peer?.postMessage({ ...data, version: VERSION, channel }, origin); }
  function disconnect() { if (timer) clearInterval(timer); timer = undefined; peer = null; origin = ''; channel = ''; options.onDisconnect(); }
  function receive(event: MessageEvent) {
    const d = event.data;
    if (!peer) {
      if (event.source !== window.opener || !window.opener || !/^https?:\/\//.test(event.origin) || !d || typeof d.channel !== 'string' || !/^[\da-f-]{36}$/i.test(d.channel) || !isBridgeMessage(d, d.channel) || d.type !== 'INIT') return;
      origin = event.origin; channel = d.channel; peer = window.opener; lastPing = Date.now(); lastSequence = 0;
      post({ type: 'ACK' }); options.onInit(origin);
      timer = setInterval(() => { if (!peer || peer.closed || Date.now() - lastPing > 10_000) disconnect(); }, 1000);
      return;
    }
    if (event.source !== peer || event.origin !== origin || !isBridgeMessage(d, channel)) return;
    if (d.type === 'INIT' || d.type === 'PING') { lastPing = Date.now(); post({ type: d.type === 'INIT' ? 'ACK' : 'PONG' }); }
    if (d.type === 'DISCONNECT') disconnect();
    if (d.type === 'ANSWER' && isLanguage(d.language) && typeof d.text === 'string' && d.text.length <= 6000 && typeof d.turnId === 'string' && d.turnId.length <= 100 && Number.isSafeInteger(d.sequence) && d.sequence > lastSequence) {
      lastSequence = d.sequence; options.onAnswer(d.turnId, d.text, d.language);
    }
  }
  function unload() { if (peer) post({ type: 'DISCONNECT' }); }
  if (typeof window !== 'undefined') { window.addEventListener('message', receive); window.addEventListener('pagehide', unload); }
  return {
    sendTranscript(text: string, language: Language) { if (peer && text.trim() && text.length <= 2000 && isLanguage(language)) post({ type: 'TRANSCRIPT', text: text.trim(), language }); },
    dispose() { unload(); disconnect(); if (typeof window !== 'undefined') { window.removeEventListener('message', receive); window.removeEventListener('pagehide', unload); } },
  };
}
