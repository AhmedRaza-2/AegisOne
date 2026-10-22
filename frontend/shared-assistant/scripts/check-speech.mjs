import assert from 'node:assert/strict';
import createEngine from '../assets/espeak/espeak-ng.js';
const engine = await createEngine({ print() {}, printErr() {} });
for (const [language, text] of [['en', 'Review the setup details before continuing.'], ['ur', 'آگے بڑھنے سے پہلے سیٹ اپ کی معلومات چیک کریں۔']]) {
  const synth = new engine.eSpeakNGWorker();
  try {
    synth.set_voice('', language);
    let count = 0; let peak = 0;
    synth.synthesize(text, samples => { count += samples.length; for (const value of samples) peak = Math.max(peak, Math.abs(value)); return false; });
    assert.ok(count > synth.get_samplerate() / 2 && peak > 100, `${language}: non-empty audible speech`);
    console.log(`${language}: ${count} samples at ${synth.get_samplerate()} Hz; non-zero speech verified`);
  } finally { engine.destroy(synth); }
}
