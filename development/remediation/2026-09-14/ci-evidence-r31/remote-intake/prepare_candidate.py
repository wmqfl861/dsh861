"""Create, but never apply, a blob-guarded candidate patch from a local checkout.

Usage: python prepare_candidate.py --root <checkout> --output <new-file.patch>
Only the four named source/test files may be included. Dirty or moved source
files, ambiguous replacements, and existing output files are refused.
"""
from __future__ import annotations
import argparse
import difflib
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ALLOWED = {
    'scripts/gate-evidence.ts', 'scripts/run-gates.ts',
    'scripts/gate-evidence.spec.ts',
    'packages/typert/generator/tests/__snapshots__/type-model.spec.ts.snap',
}

def replace_once(text: str, before: str, after: str) -> str:
    if not before or text.count(before) != 1:
        raise ValueError('a candidate anchor is absent or ambiguous; inspect newer work, do not force it')
    return text.replace(before, after, 1)

def blob_sha(data: bytes) -> str:
    return hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()

def git(root: Path, *args: str) -> bytes:
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError('required read-only Git check failed: ' + ' '.join(args[:2]))
    return result.stdout

def prepare(root: Path, specification: dict) -> bytes:
    changes = specification['changes']
    paths = [change['path'] for change in changes]
    if len(paths) != len(set(paths)) or set(paths) != ALLOWED:
        raise ValueError('candidate path set differs from the four reviewed paths')
    git(root, 'merge-base', '--is-ancestor', specification['sourceHead'], 'HEAD')
    output: list[str] = []
    for change in changes:
        path, expected = change['path'], change['expectedBlob']
        git(root, 'diff', '--no-ext-diff', '--no-textconv', '--quiet', 'HEAD', '--', path)
        if git(root, 'rev-parse', 'HEAD:' + path).decode().strip() != expected:
            raise ValueError('HEAD source moved at ' + path + '; preserve and review the new changes')
        raw = git(root, 'show', 'HEAD:' + path)
        if blob_sha(raw) != expected:
            raise ValueError('source bytes do not match the expected Git blob at ' + path)
        before = raw.decode('utf-8')
        after = before
        for replacement in change['replacements']:
            after = replace_once(after, replacement['old'], replacement['new'])
        if not after.endswith('\n') or after.endswith('\n\n'):
            raise ValueError('candidate must end with exactly one newline: ' + path)
        output.append(f'diff --git a/{path} b/{path}\n')
        output.extend(difflib.unified_diff(before.splitlines(keepends=True), after.splitlines(keepends=True), fromfile='a/'+path, tofile='b/'+path))
    return ''.join(output).encode('utf-8')

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        payload = json.loads(Path(__file__).with_name('candidate-replacements.json').read_text(encoding='utf-8'))
        patch = prepare(args.root.resolve(), payload)
        with args.output.open('xb') as target:
            target.write(patch)
        print(f'Candidate only: 4 files; {len(patch)} patch bytes; sha256={hashlib.sha256(patch).hexdigest()}')
        print('Review it, then use git apply --check and git apply. No repository source has been changed by this program.')
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        print('candidate refused: ' + str(error), file=sys.stderr)
        return 1
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
