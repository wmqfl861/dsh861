"""Read-only verification of the three original CI ZIPs shipped under artifacts/.
Checks download digests, ZIP member safety/CRC, manifest bytes/hashes/file sets,
and run/head/job identity. Reports aggregate mismatch separately from integrity.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import stat
import sys
import zipfile

ARTIFACTS = {
    'consumers': ('43222cb85855721199bd79470a5d839f23b3ccbcacbbc4ee5fee96d8f01b854c', 'node-24-consumers', 'linux', 2212),
    'linux-coverage': ('8cd1b360b0daf4c2be629e56b059984a817c5154183644002aa8eaf8395d6a90', 'node-24-coverage', 'linux', 34532),
    'windows-coverage': ('e1e8b8e538bf6dcea5c26337793861da172c98e5c933daf2a1e5f064104a7094', 'windows-coverage', 'win32', 68384),
}

def verify(root: Path) -> list[dict]:
    report = []
    for label, (digest, job, platform, size) in ARTIFACTS.items():
        archive = root / f'dsh861-r30-{label}-run34799140559-attempt1.zip'
        raw = archive.read_bytes()
        if len(raw) != size or hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError(f'{label}: original ZIP digest or size mismatch')
        with zipfile.ZipFile(archive) as z:
            names = z.namelist()
            if len(names) != len(set(names)) or z.testzip() is not None:
                raise ValueError(f'{label}: duplicate member or CRC failure')
            for info in z.infolist():
                path = PurePosixPath(info.filename)
                if info.is_dir() or stat.S_ISLNK(info.external_attr >> 16) or path.is_absolute() or '..' in path.parts or '\\' in info.filename or info.file_size >= 2_000_000:
                    raise ValueError(f'{label}: unexpected ZIP member')
            manifest = json.loads(z.read('manifest.json'))
            listed = [entry['path'] for entry in manifest['files']]
            if len(listed) != len(set(listed)) or set(listed) | {'manifest.json'} != set(names):
                raise ValueError(f'{label}: manifest file-set mismatch')
            for entry in manifest['files']:
                data = z.read(entry['path'])
                if entry['bytes'] != len(data) or entry['sha256'] != hashlib.sha256(data).hexdigest():
                    raise ValueError(f'{label}: manifest hash or length mismatch')
            identity = json.loads(z.read('identity.json'))
            gates = json.loads(z.read('gate-results.json'))
            expected = {'repository':'wmqfl861/dsh861', 'pr':'13', 'runId':'34799140559', 'runAttempt':'1', 'job':job, 'prHead':'201206cb4c83581b3d44620831434fbf2e337df9', 'prBase':'5434305c5dcf7ddc3ebf939226647b7b608335e6'}
            if any(identity.get(key) != value for key, value in expected.items()):
                raise ValueError(f'{label}: identity mismatch')
            if identity['git']['head'] != identity['checkout']['githubSha'] or identity['git']['head'] != 'd1ee13a76acd0cbee2f135fd546dab336e77ab72':
                raise ValueError(f'{label}: checkout identity mismatch')
            if identity['runtime']['platform'] != platform or identity['aggregate'] != gates['aggregate']:
                raise ValueError(f'{label}: platform or internal aggregate mismatch')
            report.append({'artifact':label, 'integrity':'PASS', 'checkedFileHashes':len(listed), 'aggregate':gates['aggregate'], 'expectedAggregateMatches':gates['aggregate'] == ('ci-consumers' if label == 'consumers' else 'ci-coverage'), 'summary':gates['summary'], 'recordedParent':identity['git']['headParent']})
    return report

if __name__ == '__main__':
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name('artifacts')
    try:
        print(json.dumps(verify(root), ensure_ascii=False, indent=2))
    except (OSError, ValueError, KeyError, zipfile.BadZipFile) as error:
        print('verification failed: ' + str(error), file=sys.stderr)
        raise SystemExit(1)
