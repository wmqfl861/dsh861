/**
 * Dependency-free mechanism experiment, NOT a run of the repository exporter,
 * scheduler, Vitest suite, or Windows CLI. The resolver is an exact fetched
 * source excerpt; the proposed claim helper comes from candidate-replacements.
 * Only a tiny file writer reproduces the exporter's non-empty-dir precondition.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const DIR = 'DSH_GATE_EVIDENCE_DIR'
const payload = JSON.parse(readFileSync(new URL('./candidate-replacements.json', import.meta.url), 'utf8'))
const replacement = payload.changes.find(change => change.path === 'scripts/gate-evidence.ts').replacements[0]
const moduleText = stripTypeScriptTypes(`export const GATE_EVIDENCE_DIR_ENV = '${DIR}'\n${replacement.new}`)
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`
const functions = await import(moduleUrl)
const cases = []
for (const mode of ['node-compat', 'ci-lint-contracts-ready', 'ci-consumers']) {
  for (const fixed of [false, true]) {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-owner-probe-'))
    try {
      const environment = { [DIR]: directory, GITHUB_JOB: 'test-consumers' }
      const request = (fixed ? functions.claimGateEvidenceRequest : functions.gateEvidenceRequest)('ci-consumers', environment)
      const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
        import { join } from 'node:path'
        const { gateEvidenceRequest } = await import(${JSON.stringify(moduleUrl)})
        const request = gateEvidenceRequest(${JSON.stringify(mode)}, process.env)
        if (request !== undefined) {
          mkdirSync(request.directory, { recursive: true })
          if (readdirSync(request.directory).length) throw new Error('not empty')
          writeFileSync(join(request.directory, 'identity.json'), JSON.stringify({aggregate:request.mode}))
        }
        process.stdout.write(JSON.stringify({enabled:request !== undefined}))
      `], { env: environment, encoding: 'utf8', timeout: 10000 })
      assert.equal(child.error, undefined)
      assert.equal(child.status, 0, child.stderr)
      let outerExported = false
      mkdirSync(request.directory, { recursive: true })
      if (readdirSync(request.directory).length === 0) {
        writeFileSync(join(request.directory, 'identity.json'), JSON.stringify({aggregate:request.mode, failed:1, exitCode:7}))
        outerExported = true
      }
      const identity = JSON.parse(readFileSync(join(directory, 'identity.json'), 'utf8'))
      assert.equal(outerExported, fixed)
      assert.equal(JSON.parse(child.stdout).enabled, !fixed)
      assert.equal(identity.aggregate, fixed ? 'ci-consumers' : mode)
      if (fixed) assert.equal(identity.exitCode, 7)
      cases.push({mode, fixed, childEnabled:!fixed, outerExported, expected:true})
    } finally { rmSync(directory, {recursive:true, force:true}) }
  }
}
for (const value of [undefined, '']) {
  const environment = value === undefined ? {GITHUB_JOB:'kept'} : {GITHUB_JOB:'kept', [DIR]:value}
  const before = {...environment}
  assert.equal(functions.claimGateEvidenceRequest('ci-consumers', environment), undefined)
  assert.deepEqual(environment, before)
}
const environment = {[DIR]:'/test-only', GITHUB_JOB:'kept'}
Object.defineProperty(environment, 'DO_NOT_ENUMERATE_SECRETS', {enumerable:true, get(){throw new Error('unrelated environment read')}})
const request = functions.claimGateEvidenceRequest('ci-consumers', environment)
assert.equal(request.directory, '/test-only')
assert.equal(request.environment.GITHUB_JOB, 'kept')
assert.equal(functions.claimGateEvidenceRequest('ci-consumers', environment), undefined)
console.log(JSON.stringify({kind:'isolated environment/child-process mechanism proof', node:process.versions.node, platform:process.platform, cases, disabledAndEmptyUnchanged:true, unrelatedEnvironmentNotEnumerated:true, fullRepositoryTests:false}, null, 2))
