"""Offline Git/OS reproduction, not a full Cordis or Vitest execution."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory

PATH = 'apps/cli/tests/profiles/acp/cordis.yml'
OLD = b'- path: ../../../../../snapshots/acp/escalation-approved/cordis.yml'
NEW = OLD + b'\n'

def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()

assert blob_sha(OLD) == '336d59ae50cfc6b95c3ece43e3fd30e2c13e32ea'
assert blob_sha(NEW) == '2a4483236bc2e2d05b4f6fc5f7192eeddf010cf9'
rows = []
for symlinks in ('true', 'false'):
    for label, mode, data in [('baseline', '120000', OLD), ('candidate', '100644', NEW)]:
        with TemporaryDirectory(prefix='dsh-r29-git-mode-') as directory:
            env = dict(os.environ, GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull)
            def git(*args, data=None):
                return subprocess.run(['git', *args], cwd=directory, env=env, input=data,
                                      check=True, capture_output=True, timeout=10).stdout
            git('init', '--quiet')
            git('config', '--local', 'core.symlinks', symlinks)
            sha = git('hash-object', '-w', '--stdin', data=data).decode().strip()
            git('update-index', '--add', '--cacheinfo', f'{mode},{sha},{PATH}')
            git('checkout-index', '--all', '--force')
            path = Path(directory, PATH)
            try:
                content = path.read_bytes()
                readable = True
                assert content == data
                failure = None
            except FileNotFoundError:
                readable, failure = False, 'ENOENT'
            index = git('ls-files', '--stage', '--', PATH).decode().strip()
            guard = re.match(r'^100644 [0-9a-f]{40} 0\t', index) is not None
            assert guard == (label == 'candidate')
            assert readable == (label == 'candidate' or symlinks == 'false')
            assert path.is_symlink() == (label == 'baseline' and symlinks == 'true')
            if path.is_symlink():
                assert os.readlink(path) == OLD.decode()
            rows.append(dict(version=label, coreSymlinks=symlinks, indexMode=mode,
                             blob=sha, readable=readable, readError=failure,
                             indexRegressionAccepts=guard))
print(json.dumps(dict(kind='offline-git-checkout-proof', fullRepositoryTest=False,
                      platform=os.name, gitVersion=subprocess.check_output(['git', '--version']).decode().strip(),
                      cases=rows), indent=2))
