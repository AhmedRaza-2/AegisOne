import { type AssistantClient } from './client.ts';
import { type Language } from './contracts.ts';
export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'speaking';
/** Canonical PCM WAV: duration is independently verifiable by the gateway. */
export function encodePcmWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  if (!channels.length || sampleRate <= 0 || !Number.isFinite(sampleRate)) throw new Error('Invalid audio');
  const count = Math.min(480000, Math.floor(channels[0].length * 16000 / sampleRate));
  const buffer = new ArrayBuffer(44 + count * 2); const view = new DataView(buffer);
  const str = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); str(8, 'WAVE'); str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const position = i * sampleRate / 16000; const left = Math.floor(position); const fraction = position - left;
    let value = 0;
    for (const channel of channels) value += (channel[left] || 0) * (1 - fraction) + (channel[Math.min(left + 1, channel.length - 1)] || 0) * fraction;
    value = Math.max(-1, Math.min(1, value / channels.length)); view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return buffer;
}
export function createVoiceController(options: { client: AssistantClient; onState: (state: VoiceState) => void; onTranscript: (text: string) => void; onError: (message: string) => void; assetBaseUrl?: string }) {
  let recorder: MediaRecorder | undefined; let stream: MediaStream | undefined; let timer: ReturnType<typeof setTimeout> | undefined;
  let operation = 0; let language: Language = 'en'; let abort: AbortController | undefined; let context: AudioContext | undefined; let source: AudioBufferSourceNode | undefined;
  let worker: Worker | undefined; let workerReject: ((reason: Error) => void) | undefined; let disposed = false;
  const setState = (s: VoiceState) => { if (!disposed) options.onState(s); };
  const stopTracks = () => { stream?.getTracks().forEach(t => t.stop()); stream = undefined; };
  function cancel() {
    operation++; if (timer) clearTimeout(timer); timer = undefined;
    if (recorder && recorder.state !== 'inactive') { recorder.onstop = null; recorder.stop(); } recorder = undefined;
    stopTracks(); abort?.abort(); abort = undefined;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    try { source?.stop(); } catch { /* already stopped */ } source = undefined;
    workerReject?.(new Error('Speech cancelled')); workerReject = undefined; worker?.terminate(); worker = undefined;
    void context?.close().catch(() => {}); context = undefined; setState('idle');
  }
  async function basicSpeech(text: string, speechLanguage: Language, id: number) {
    const base = (options.assetBaseUrl || '/assistant-assets/espeak').replace(/\/$/, '');
    // Resume while still in the user's click gesture, before downloading the engine.
    context = new AudioContext(); await context.resume();
    worker = new Worker(`${base}/worker.js`, { type: 'module' });
    const result = await new Promise<{ samples: Float32Array; sampleRate: number }>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error('Basic voice did not load. Please continue with text.')), 20_000);
      workerReject = reason => { clearTimeout(deadline); reject(reason); };
      worker!.onerror = () => { clearTimeout(deadline); reject(new Error('Basic voice is unavailable. Please continue with text.')); };
      worker!.onmessage = event => { clearTimeout(deadline); if (event.data.error) reject(new Error('Basic voice is unavailable. Please continue with text.')); else resolve({ samples: new Float32Array(event.data.samples), sampleRate: event.data.sampleRate || 22050 }); };
      worker!.postMessage({ text, language: speechLanguage === 'en' ? 'en' : 'ur' });
    });
    workerReject = undefined; worker?.terminate(); worker = undefined;
    if (id !== operation || disposed) return;
    if (!context) return;
    const audio = context.createBuffer(1, result.samples.length, result.sampleRate); audio.getChannelData(0).set(result.samples);
    source = context.createBufferSource(); source.buffer = audio; source.connect(context.destination);
    await new Promise<void>(resolve => { source!.onended = () => resolve(); source!.start(); });
  }
  async function stopRecording() {
    if (recorder?.state === 'recording') recorder.stop();
  }
  return {
    async start(nextLanguage: Language) {
      cancel(); const id = operation; language = nextLanguage;
      try {
        if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone recording needs HTTPS or localhost and a supported browser. You can continue with text.');
        const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
        if (id !== operation || disposed) { media.getTracks().forEach(t => t.stop()); return; }
        stream = media;
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
        recorder = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
        const chunks: Blob[] = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        recorder.onerror = () => { cancel(); options.onError('Recording failed. Please continue with text.'); };
        recorder.onstop = async () => {
          if (timer) clearTimeout(timer); timer = undefined; stopTracks();
          if (id !== operation || disposed) return;
          setState('transcribing');
          try {
            const audioContext = new AudioContext();
            let wav: ArrayBuffer;
            try { const encoded = await new Blob(chunks, { type: mime || 'audio/webm' }).arrayBuffer(); chunks.length = 0; const decoded = await audioContext.decodeAudioData(encoded); wav = encodePcmWav(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)), decoded.sampleRate); }
            finally { chunks.length = 0; await audioContext.close(); }
            if (id !== operation || disposed) return;
            abort = new AbortController(); const text = await options.client.transcribe(new Blob([wav], { type: 'audio/wav' }), language, { signal: abort.signal });
            if (id === operation && !disposed) { setState('idle'); options.onTranscript(text); }
          } catch (error) { if (id === operation && !disposed) { setState('idle'); options.onError(error instanceof Error ? error.message : 'Voice transcription failed.'); } }
        };
        recorder.start(); setState('recording'); timer = setTimeout(() => void stopRecording(), 30_000);
      } catch (error) { if (id === operation && !disposed) { stopTracks(); setState('idle'); options.onError(error instanceof Error ? error.message : 'Microphone permission was denied.'); } }
    },
    stopRecording,
    cancel,
    async speak(text: string, speechLanguage: Language) {
      cancel(); const id = operation; setState('speaking');
      try {
        const plain = text.replace(/https?:\/\/\S+/g, '').replace(/```[\s\S]*?```/g, '').replace(/[*_#`]/g, '').slice(0, 6000);
        if (!plain.trim()) { setState('idle'); return; }
        const code = speechLanguage === 'en' ? 'en' : 'ur';
        const voices = typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang.toLowerCase().split('-')[0] === code);
        if (voice) await new Promise<void>((resolve, reject) => {
          const utterance = new SpeechSynthesisUtterance(plain); utterance.voice = voice; utterance.lang = voice.lang;
          utterance.onend = () => resolve(); utterance.onerror = () => reject(new Error('Speech playback failed. Please continue with text.')); speechSynthesis.speak(utterance);
        });
        else await basicSpeech(plain, speechLanguage, id);
      } catch (error) { if (id === operation && !disposed) options.onError(error instanceof Error ? error.message : 'Speech playback failed.'); }
      finally { if (id === operation) { workerReject = undefined; worker?.terminate(); worker = undefined; void context?.close().catch(() => {}); context = undefined; source = undefined; setState('idle'); } }
    },
    dispose() { cancel(); disposed = true; },
  };
}
