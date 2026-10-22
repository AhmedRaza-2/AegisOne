import assert from 'node:assert/strict';
import test from 'node:test';
import { encodePcmWav, createVoiceController } from '../src/voice.ts';

function replaceGlobal(t: any, key: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key); });
}

test('PCM WAV uses mono 16-bit 16kHz headers, averages stereo and clamps samples', () => {
  const buffer = encodePcmWav([Float32Array.from([-2, 1, 2]), Float32Array.from([-2, -1, 2])], 16000);
  const view = new DataView(buffer); const text = (start: number, count: number) => String.fromCharCode(...new Uint8Array(buffer, start, count));
  assert.equal(text(0, 4), 'RIFF'); assert.equal(text(8, 4), 'WAVE'); assert.equal(text(36, 4), 'data');
  assert.equal(view.getUint16(20, true), 1); assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000); assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 6); assert.equal(buffer.byteLength, 50);
  assert.deepEqual([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)], [-32768, 0, 32767]);
});

test('PCM WAV resampling enforces a maximum duration of 30 seconds', () => {
  const buffer = encodePcmWav([new Float32Array(48_000 * 31)], 48000);
  assert.equal(buffer.byteLength, 44 + 480_000 * 2);
  assert.equal(new DataView(buffer).getUint32(40, true), 960_000);
  for (const sampleRate of [0, -1, NaN, Infinity]) assert.throws(() => encodePcmWav([new Float32Array(1)], sampleRate));
  assert.throws(() => encodePcmWav([], 16000));
});

test('insecure contexts never request microphone permission', async t => {
  let permissions = 0; const errors: string[] = [];
  replaceGlobal(t, 'isSecureContext', false);
  replaceGlobal(t, 'navigator', { mediaDevices: { getUserMedia: async () => { permissions++; } } });
  const controller = createVoiceController({ client: {} as any, onState() {}, onTranscript() {}, onError: message => errors.push(message) });
  await controller.start('en'); controller.dispose();
  assert.equal(permissions, 0); assert.match(errors[0], /HTTPS/);
});

test('cancelling while microphone permission is pending stops a late stream', async t => {
  let resolveMedia!: (value: unknown) => void; let stops = 0; const transcripts: string[] = [];
  replaceGlobal(t, 'isSecureContext', true);
  replaceGlobal(t, 'MediaRecorder', class {});
  replaceGlobal(t, 'navigator', { mediaDevices: { getUserMedia: () => new Promise(resolve => { resolveMedia = resolve; }) } });
  const controller = createVoiceController({ client: {} as any, onState() {}, onTranscript: text => transcripts.push(text), onError() {} });
  const starting = controller.start('ur'); controller.cancel();
  resolveMedia({ getTracks: () => [{ stop: () => stops++ }] }); await starting; controller.dispose();
  assert.equal(stops, 1); assert.deepEqual(transcripts, []);
});

test('cancel stops recording tracks without decoding or uploading cancelled audio', async t => {
  let stops = 0; let uploads = 0; const states: string[] = []; let recording: any;
  class Recorder {
    static isTypeSupported() { return true; }
    state = 'inactive'; onstop: null | (() => unknown) = null; ondataavailable: unknown; onerror: unknown;
    constructor() { recording = this; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.onstop?.(); }
  }
  replaceGlobal(t, 'isSecureContext', true); replaceGlobal(t, 'MediaRecorder', Recorder);
  replaceGlobal(t, 'navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stops++ }] }) } });
  const controller = createVoiceController({ client: { transcribe: async () => { uploads++; return 'late'; } } as any, onState: state => states.push(state), onTranscript() {}, onError() {} });
  await controller.start('en'); assert.equal(recording.state, 'recording');
  controller.cancel(); controller.dispose();
  assert.equal(recording.state, 'inactive'); assert.equal(stops, 1); assert.equal(uploads, 0); assert.equal(states.at(-1), 'idle');
});

test('cancel during transcription aborts the request and suppresses a late transcript', async t => {
  let recording: any; let stops = 0; let resolveTranscript!: (text: string) => void;
  let uploaded!: () => void; const uploadStarted = new Promise<void>(resolve => { uploaded = resolve; });
  let signal: AbortSignal | undefined; const transcripts: string[] = []; const errors: string[] = [];
  class Recorder {
    static isTypeSupported() { return true; }
    state = 'inactive'; onstop: null | (() => unknown) = null; ondataavailable: unknown; onerror: unknown;
    constructor() { recording = this; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; void this.onstop?.(); }
  }
  class Context {
    async decodeAudioData() { return { numberOfChannels: 1, sampleRate: 16000, getChannelData: () => new Float32Array(160) }; }
    async close() {}
  }
  replaceGlobal(t, 'isSecureContext', true); replaceGlobal(t, 'MediaRecorder', Recorder); replaceGlobal(t, 'AudioContext', Context);
  replaceGlobal(t, 'navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => stops++ }] }) } });
  const controller = createVoiceController({
    client: { transcribe: (_blob: Blob, _language: string, options: { signal: AbortSignal }) => { signal = options.signal; uploaded(); return new Promise<string>(resolve => { resolveTranscript = resolve; }); } } as any,
    onState() {}, onTranscript: text => transcripts.push(text), onError: message => errors.push(message),
  });
  await controller.start('ur-Latn');
  recording.ondataavailable({ data: new Blob(['audio']) }); await controller.stopRecording(); await uploadStarted;
  assert.equal(stops, 1); controller.cancel(); assert.equal(signal?.aborted, true);
  resolveTranscript('late private question'); await Promise.resolve(); await Promise.resolve(); controller.dispose();
  assert.deepEqual(transcripts, []); assert.deepEqual(errors, []);
});
