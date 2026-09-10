"""One-off, checksum-locked transport of the user-approved Revision 5 inputs."""
import base64
import bz2
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path.cwd()
BASE = 'd7a1a8c63f89fd9ba63edfd72330ae929489d3ab'
EXPECTED = [
 '6423dde102e869b1013c3b827e8c4f44058d9fccf46ca13bdd4c99e7a76eefda',
 'aa694d1aa04df6e15f198f5e3061a85952b0022c83c350dc751209989a536e0f',
 'b15bbe80669ab48b05e3376b33eb556482e9b38ed15a8474c2e96b3c5baafea8',
 '4f9c22f0a003f4ff50bbb6018c0996c228759c459910efed7a6c5705214bc621',
 '8aa95a78a6c2f8da67c83aef64bbc6b1573e795ed8fff92cd2cc80360b2597a2',
 '5c19fffe58a29d0feb40252e1c9efa91201c4950af647c394d00f079aba50a90',
 '22ccae9c13c36b7d09bab62587387b8df70450fab0d8d69bdf9e2262f60575e1',
 'cecdc318b6c3bd804dc1eaa01baee877a82ac0f0d240e1ea7ef08b6c41ac26a7',
]
subprocess.run(['git', 'merge-base', '--is-ancestor', BASE, 'HEAD'], check=True)
if subprocess.check_output(['git', 'status', '--porcelain'], text=True).strip():
    raise RuntimeError('Build requires a clean isolated checkout')
parts, failures = [], []
for i, checksum in enumerate(EXPECTED):
    text = (ROOT / f'.stack-data-{i}.b64').read_text().strip()
    # Correct two identified transport transcription errors, then require the
    # original independently calculated checksum. No unverified input is accepted.
    if i == 2:
        text = text.replace('ma/PTZZ2a', 'ma/PTZ2a')
    if i == 4:
        text = text.replace('0WKasarJjb', '0WKsm1FKasarJjb')
    actual = hashlib.sha256(text.encode('ascii')).hexdigest()
    if actual != checksum:
        failures.append(f'Input segment {i}: length={len(text)} sha256={actual}; expected={checksum}')
    parts.append(text)
if failures:
    raise RuntimeError('\n'.join(failures))
packed = base64.b64decode(''.join(parts), validate=True)
if hashlib.sha256(packed).hexdigest() != '9b42fd41647f7ac3eeb09799f093896388c326f0dc7d48452d8fab06b2f7a0a9':
    raise RuntimeError('Approved source checksum mismatch')
decoder = bz2.BZ2Decompressor()
raw = decoder.decompress(packed, max_length=2_000_001)
if len(raw) > 2_000_000 or not decoder.eof or decoder.unused_data:
    raise RuntimeError('Invalid or oversized source data')
data = json.loads(raw)
names = {'build-inventory.json', 'source-map.json', 'source-revisions.json', 'revision-decisions.json'}
if set(data) != names or not all(isinstance(value, str) for value in data.values()):
    raise RuntimeError('Unexpected source manifest')
print('Verified exact approved source data and all eight transport segments.')
archive = io.BytesIO()
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as output:
    for name, content in data.items():
        output.writestr('unified-agent-stack-v5/' + name, content)
archive.seek(0)
spec = importlib.util.spec_from_file_location('stack_build_core', ROOT / '.stack-core.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.build(archive)
