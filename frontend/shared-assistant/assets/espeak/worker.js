// SPDX-License-Identifier: GPL-3.0-or-later
// AegisOne browser adapter for the bundled eSpeak NG fallback. See COPYING.
import createEngine from './espeak-ng.js';
let ready;
self.onmessage = async ({ data }) => {
  try {
    if (!data || !['en', 'ur'].includes(data.language) || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 6000) throw new Error('Invalid speech request');
    ready ||= createEngine({ print() {}, printErr() {} });
    const engine = await ready;
    const synth = new engine.eSpeakNGWorker();
    try {
      synth.set_voice('', data.language);
      synth.set_rate(160);
      const chunks = [];
      let total = 0;
      synth.synthesize(data.text, samples => { const floats = Float32Array.from(samples, sample => sample / 32768); chunks.push(floats); total += floats.length; return false; });
      if (!total) throw new Error('Empty speech');
      const samples = new Float32Array(total);
      let offset = 0;
      for (const chunk of chunks) { samples.set(chunk, offset); offset += chunk.length; }
      self.postMessage({ samples: samples.buffer, sampleRate: synth.get_samplerate() }, [samples.buffer]);
    } finally { engine.destroy(synth); }
  } catch { self.postMessage({ error: 'speech_unavailable' }); }
};
