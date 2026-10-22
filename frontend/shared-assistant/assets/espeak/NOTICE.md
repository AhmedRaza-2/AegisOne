# Basic English / Urdu voice

This optional, locally processed fallback uses eSpeak NG, compiled by the Echogarden project. It is synthetic speech, not a natural voice guarantee. Urdu pronunciation requires listener validation before enabling the voice pilot.

- Engine package: `@echogarden/espeak-ng-emscripten@0.3.5`.
- Original package SHA-1: `4817314c0a9aed9653785e4b4b45802960ac8c5a`.
- Package repository commit: `ea36b43595facf07f1c5dc487b9f0de3340c1b5e`.
- License: GPLv3; see the bundled `COPYING`.
- Upstream repositories: https://github.com/echogarden-project/espeak-ng-emscripten and https://github.com/echogarden-project/espeak-ng.
- The engine JavaScript is unmodified except its generated file-offset metadata. The data file is reduced to English/Urdu and their supporting dictionaries, phonemes and intonation data. `manifest.json` records the retained files and checksums.
- The browser `worker.js` adapter is supplied under GPL-3.0-or-later.
- Source, upstream instructions, and the exact data-subsetting script are distributed in `source.zip` alongside these assets. No runtime CDN or external speech API is used by this fallback.

To reproduce the data subset, unpack the pinned npm package under `frontend/shared-assistant/vendor/package`, then run `python frontend/shared-assistant/scripts/prepare-espeak.py`. To rebuild the upstream engine, follow `UPSTREAM-README.md` and the included source/build script; the historical package does not record its exact Emscripten toolchain version, so bit-identical recompilation is not claimed.
