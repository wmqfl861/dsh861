"""Compare traversal parents and stored commit headers in a local depth-one fixture.
No network, credentials, global Git configuration, or user checkout is involved.
"""
from pathlib import Path
import json
import subprocess
import tempfile

def run(directory: Path, *args: str, input: str | None = None) -> str:
    p = subprocess.run(['git', '-C', str(directory), '-c', 'user.name=Evidence Fixture', '-c', 'user.email=fixture@example.invalid', *args], input=input, text=True, capture_output=True, check=True)
    return p.stdout.strip()

with tempfile.TemporaryDirectory(prefix='dsh-shallow-proof-') as temp:
    root = Path(temp)
    source = root/'source'
    source.mkdir()
    run(source, 'init', '--initial-branch=main')
    tree = run(source, 'hash-object', '-t', 'tree', '--stdin', '-w', input='')
    first = run(source, 'commit-tree', tree, '-m', 'root')
    base = run(source, 'commit-tree', tree, '-p', first, '-m', 'base')
    head = run(source, 'commit-tree', tree, '-p', first, '-m', 'head')
    merge = run(source, 'commit-tree', tree, '-p', base, '-p', head, '-m', 'merge fixture\n\nparent ' + 'f'*40)
    run(source, 'update-ref', 'refs/heads/main', merge)
    run(root, 'clone', '--quiet', '--depth=1', source.as_uri(), str(root/'shallow'))
    shallow = root/'shallow'
    assert run(shallow, 'rev-parse', '--is-shallow-repository') == 'true'
    traversal = run(shallow, 'show', '-s', '--format=%P', '-n1', 'HEAD')
    assert traversal == ''
    commit = run(shallow, 'cat-file', 'commit', 'HEAD')
    headers = commit.split('\n\n', 1)[0]
    parents = [line[7:] for line in headers.split('\n') if line.startswith('parent ')]
    assert parents == [base, head]
    assert 'f'*40 not in parents
    print(json.dumps({'kind':'isolated local Git depth-one fixture', 'gitVersion':run(root,'--version'), 'shallow':True, 'oldPercentP':'', 'storedHeaderParents':parents, 'expectedParents':[base,head], 'bothParentsRecovered':True, 'messageParentNotParsed':True, 'networkUsed':False, 'repositoryTestsRun':False}, indent=2))
