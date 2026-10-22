"""Reproducibly subset the unmodified 0.3.5 npm data pack to English/Urdu.

Input: npm pack @echogarden/espeak-ng-emscripten@0.3.5 --ignore-scripts
then extract its package/ directory under ../vendor/. No engine code changes.
"""
import hashlib
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
vendor = ROOT / 'vendor' / 'package'
out = ROOT / 'assets' / 'espeak'
out.mkdir(parents=True, exist_ok=True)
js = (vendor / 'espeak-ng.js').read_text(encoding='utf-8')
data = (vendor / 'espeak-ng.data').read_bytes()
pattern = r'\{filename:"([^"]+)",start:(\d+),end:(\d+)\}'
files = re.findall(pattern, js)
assert len(files) > 100, 'Unexpected upstream data format'
kept = []
payload = bytearray()
for name, start, end in files:
    leaf = name.rsplit('/', 1)[-1]
    keep = not leaf.endswith('_dict') or leaf in ('en_dict', 'ur_dict', 'hi_dict', 'fa_dict', 'ar_dict')
    if '/lang/' in name:
        keep = name.endswith(('/gmw/en', '/gmw/en-US', '/inc/ur', '/inc/hi', '/ira/fa', '/sem/ar'))
    if '/voices/' in name:
        keep = False
    if keep:
        chunk = data[int(start):int(end)]
        kept.append({'filename': name, 'start': len(payload), 'end': len(payload) + len(chunk)})
        payload.extend(chunk)
metadata = 'loadPackage({files:[' + ','.join('{filename:' + json.dumps(f['filename']) + ',start:' + str(f['start']) + ',end:' + str(f['end']) + '}' for f in kept) + '],remote_package_size:' + str(len(payload)) + '})'
js, substitutions = re.subn(r'loadPackage\(\{files:\[.*?\],remote_package_size:\d+\}\)', lambda _: metadata, js, count=1)
assert substitutions == 1, 'Unexpected upstream package metadata'
(out / 'espeak-ng.js').write_text(js, encoding='utf-8')
(out / 'espeak-ng.data').write_bytes(payload)
shutil.copyfile(vendor / 'COPYING', out / 'COPYING')
shutil.copyfile(vendor / 'README.md', out / 'UPSTREAM-README.md')
manifest = {'package': '@echogarden/espeak-ng-emscripten', 'version': '0.3.5', 'npmShasum': '4817314c0a9aed9653785e4b4b45802960ac8c5a', 'packageCommit': 'ea36b43595facf07f1c5dc487b9f0de3340c1b5e', 'dataBytes': len(payload), 'files': [f['filename'] for f in kept], 'sha256': {name: hashlib.sha256((out / name).read_bytes()).hexdigest() for name in ('espeak-ng.js', 'espeak-ng.data')}}
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Prepared pinned English/Urdu fallback:', len(payload), 'data bytes')
