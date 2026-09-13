import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { cordisConfigFiles } from './cordis-config-files.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('cordisConfigFiles', () => {
  it('tracks the ACP include as a regular file even when Git symlinks are disabled', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const path = 'apps/cli/tests/profiles/acp/cordis.yml'
    // core.symlinks=false can hide a stale 120000 entry behind a readable file.
    const entry = execFileSync('git', ['ls-files', '--stage', '--', path], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
    }).trim()
    expect(entry).toMatch(/^100644 [0-9a-f]{40} 0\t/)
    expect(readFileSync(join(root, path), 'utf8').trim()).toBe(
      '- path: ../../../../../snapshots/acp/escalation-approved/cordis.yml',
    )
  })

  it('finds Loader YAML without treating translation records as configs', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-cordis-config-files-'))
    roots.push(root)
    for (const directory of ['.claude', 'apps/cli/config/examples', 'docs', 'node_modules/pkg', 'vendor/pkg']) {
      mkdirSync(join(root, directory), { recursive: true })
    }
    for (const file of [
      '.claude/hidden.cordis.yml',
      'docs/cordis-primer.i18n.yaml',
      'apps/cli/config/examples/agent.cordis.yaml',
      'apps/cli/config/examples/headless.cordis.yml',
      'node_modules/pkg/hidden.cordis.yml',
      'vendor/pkg/hidden.cordis.yml',
    ]) {
      writeFileSync(join(root, file), '[]\n')
    }

    expect(cordisConfigFiles(root)).toEqual([
      join('apps', 'cli', 'config', 'examples', 'agent.cordis.yaml'),
      join('apps', 'cli', 'config', 'examples', 'headless.cordis.yml'),
    ])
  })
})
