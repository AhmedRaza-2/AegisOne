import assert from 'node:assert/strict';
import test from 'node:test';
import { createCompanionBridge, createCompanionReceiver, isBridgeMessage } from '../src/companion.ts';

class Peer {
  closed = false;
  sent: { data: any; targetOrigin: string }[] = [];
  postMessage(data: unknown, targetOrigin: string) { this.sent.push({ data, targetOrigin }); }
  close() { this.closed = true; }
}
class FakeWindow {
  listeners = new Map<string, Set<(event: any) => void>>();
  opener: Peer | null = null; popup = new Peer(); blocked = false;
  open() { return this.blocked ? null : this.popup; }
  addEventListener(type: string, listener: (event: any) => void) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(listener); }
  removeEventListener(type: string, listener: (event: any) => void) { this.listeners.get(type)?.delete(listener); }
  emit(type: string, event: any = {}) { for (const listener of this.listeners.get(type) || []) listener(event); }
}
function fakeWindow(t: any) {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'window'); const browser = new FakeWindow();
  Object.defineProperty(globalThis, 'window', { value: browser, configurable: true });
  t.after(() => { if (prior) Object.defineProperty(globalThis, 'window', prior); else Reflect.deleteProperty(globalThis, 'window'); });
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 100_000 });
  return browser;
}
const packet = (channel: string, type: string, extra = {}) => ({ version: 1, channel, type, ...extra });

test('bridge envelope rejects wrong channels, versions, oversized and cyclic payloads', () => {
  assert.equal(isBridgeMessage(packet('channel', 'ACK'), 'channel'), true);
  for (const value of [null, [], packet('other', 'ACK'), { ...packet('channel', 'ACK'), version: 2 }, packet('channel', 'EXECUTE'), packet('channel', 'ACK', { text: 'x'.repeat(8001) })]) {
    assert.equal(isBridgeMessage(value, 'channel'), false);
  }
  const cyclic: any = packet('channel', 'ACK'); cyclic.self = cyclic;
  assert.equal(isBridgeMessage(cyclic, 'channel'), false);
});

test('parent bridge binds the exact popup, HTTPS origin and random channel before accepting transcripts', t => {
  const browser = fakeWindow(t); const transcripts: unknown[] = []; const states: boolean[] = [];
  const bridge = createCompanionBridge({ url: 'https://voice.example/assistant/voice', onTranscript: (text, language) => transcripts.push([text, language]), onState: connected => states.push(connected) });
  t.after(() => bridge.dispose()); assert.equal(bridge.open(), true); t.mock.timers.tick(500);
  const init = browser.popup.sent[0]; assert.equal(init.targetOrigin, 'https://voice.example'); assert.equal(init.data.type, 'INIT');
  const channel = init.data.channel; assert.match(channel, /^[\da-f-]{36}$/i);
  for (const event of [
    { source: browser.popup, origin: 'https://evil.example', data: packet(channel, 'ACK') },
    { source: new Peer(), origin: 'https://voice.example', data: packet(channel, 'ACK') },
    { source: browser.popup, origin: 'https://voice.example', data: packet('wrong', 'ACK') },
  ]) browser.emit('message', event);
  browser.emit('message', { source: browser.popup, origin: 'https://voice.example', data: packet(channel, 'TRANSCRIPT', { text: 'too early', language: 'en' }) });
  assert.equal(states.includes(true), false); assert.deepEqual(transcripts, []);
  browser.emit('message', { source: browser.popup, origin: 'https://voice.example', data: packet(channel, 'ACK') });
  for (const extra of [{ text: 'x'.repeat(2001), language: 'en' }, { text: 'test', language: 'fr' }, { text: '   ', language: 'en' }]) {
    browser.emit('message', { source: browser.popup, origin: 'https://voice.example', data: packet(channel, 'TRANSCRIPT', extra) });
  }
  browser.emit('message', { source: browser.popup, origin: 'https://voice.example', data: packet(channel, 'TRANSCRIPT', { text: '  Salam  ', language: 'ur-Latn' }) });
  assert.deepEqual(transcripts, [['Salam', 'ur-Latn']]);
  bridge.sendAnswer('turn-1', 'Approved answer.', 'ur');
  assert.deepEqual(browser.popup.sent.at(-1), { targetOrigin: 'https://voice.example', data: packet(channel, 'ANSWER', { turnId: 'turn-1', text: 'Approved answer.', language: 'ur', sequence: 1 }) });
  bridge.close(); assert.equal(browser.popup.closed, true); assert.equal(states.at(-1), false);
  assert.equal(browser.popup.sent.at(-1)?.data.type, 'DISCONNECT');
});

test('blocked popups, unsafe URLs, handshake timeout and missing heartbeat fail closed', t => {
  const browser = fakeWindow(t); const errors: string[] = [];
  for (const url of ['http://voice.example', 'https://user:pass@voice.example', 'https://voice.example?secret=1']) {
    const invalid = createCompanionBridge({ url, onTranscript() {}, onError: error => errors.push(error) });
    assert.equal(invalid.open(), false); invalid.dispose();
  }
  browser.blocked = true;
  const blocked = createCompanionBridge({ url: 'https://voice.example', onTranscript() {}, onError: error => errors.push(error) });
  assert.equal(blocked.open(), false); blocked.dispose(); browser.blocked = false;
  const timeout = createCompanionBridge({ url: 'https://voice.example', onTranscript() {}, onError: error => errors.push(error) });
  assert.equal(timeout.open(), true); t.mock.timers.tick(10_501); assert.equal(browser.popup.closed, true); timeout.dispose();
  browser.popup = new Peer();
  const heartbeat = createCompanionBridge({ url: 'https://voice.example', onTranscript() {}, onError: error => errors.push(error) });
  assert.equal(heartbeat.open(), true); t.mock.timers.tick(500);
  const channel = browser.popup.sent[0].data.channel;
  browser.emit('message', { source: browser.popup, origin: 'https://voice.example', data: packet(channel, 'ACK') });
  t.mock.timers.tick(10_501); assert.equal(browser.popup.closed, true); heartbeat.dispose();
  assert.equal(errors.length, 6);
});

test('receiver binds opener/origin/channel, rejects answer replay and notifies disconnect', t => {
  const browser = fakeWindow(t); const opener = new Peer(); browser.opener = opener;
  const answers: unknown[] = []; const origins: unknown[] = []; let disconnects = 0;
  const receiver = createCompanionReceiver({ onInit: origin => origins.push(origin), onAnswer: (...args) => answers.push(args), onDisconnect: () => disconnects++ });
  t.after(() => receiver.dispose());
  const channel = '12345678-1234-4234-9234-123456789abc'; const origin = 'http://192.168.1.50:3002';
  for (const event of [
    { source: new Peer(), origin, data: packet(channel, 'INIT') },
    { source: opener, origin: 'null', data: packet(channel, 'INIT') },
    { source: opener, origin, data: packet('invalid', 'INIT') },
  ]) browser.emit('message', event);
  assert.deepEqual(origins, []);
  browser.emit('message', { source: opener, origin, data: packet(channel, 'INIT') });
  assert.deepEqual(origins, [origin]); assert.deepEqual(opener.sent[0], { targetOrigin: origin, data: packet(channel, 'ACK') });
  const answer = packet(channel, 'ANSWER', { turnId: 'turn', text: 'Read approved answer.', language: 'en', sequence: 2 });
  browser.emit('message', { source: opener, origin: 'https://evil.example', data: answer });
  browser.emit('message', { source: new Peer(), origin, data: answer });
  browser.emit('message', { source: opener, origin, data: { ...answer, channel: 'wrong' } });
  browser.emit('message', { source: opener, origin, data: answer });
  browser.emit('message', { source: opener, origin, data: answer });
  browser.emit('message', { source: opener, origin, data: { ...answer, sequence: 1 } });
  assert.deepEqual(answers, [['turn', 'Read approved answer.', 'en']]);
  receiver.sendTranscript('  reviewed question  ', 'ur');
  assert.deepEqual(opener.sent.at(-1), { targetOrigin: origin, data: packet(channel, 'TRANSCRIPT', { text: 'reviewed question', language: 'ur' }) });
  browser.emit('message', { source: opener, origin, data: packet(channel, 'DISCONNECT') });
  assert.equal(disconnects, 1); const sent = opener.sent.length;
  receiver.sendTranscript('must not send', 'en'); assert.equal(opener.sent.length, sent);
  receiver.dispose(); assert.equal(browser.listeners.get('message')?.size, 0); assert.equal(browser.listeners.get('pagehide')?.size, 0);
});

test('receiver disconnects when opener closes or stops sending heartbeats', t => {
  const browser = fakeWindow(t); const opener = new Peer(); browser.opener = opener; let disconnects = 0;
  const receiver = createCompanionReceiver({ onInit() {}, onAnswer() {}, onDisconnect: () => disconnects++ });
  const channel = '12345678-1234-4234-9234-123456789abc'; const origin = 'http://localhost:3002';
  browser.emit('message', { source: opener, origin, data: packet(channel, 'INIT') });
  opener.closed = true; t.mock.timers.tick(1000); assert.equal(disconnects, 1);
  opener.closed = false;
  browser.emit('message', { source: opener, origin, data: packet(channel, 'INIT') });
  t.mock.timers.tick(11_001); assert.equal(disconnects, 2); receiver.dispose();
});
