import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const execute = promisify(execFile)

it('keeps native stderr private at the actual Provider spawn boundary', async () => {
  const env = { ...process.env }
  delete env.DSH_TEST_CODEX_INDEX
  delete env.DSH_TEST_EXPECT_RAW
  delete env.DSH_TEST_TYPESCRIPT_PATH
  const { stdout } = await execute(process.execPath, ['--experimental-vm-modules',
    fileURLToPath(new URL('./private-stderr-provider.fixture.mjs', import.meta.url))],
  { env, timeout: 10000, maxBuffer: 1024 * 1024 })
  const report = JSON.parse(stdout) as {
    expectPrivate: boolean
    results: Array<{ rawBytesAtRunner: number; stderrPrivate: boolean; stdoutPreserved: boolean }>
    actualCodexInvoked: boolean
  }
  expect(report.expectPrivate).toBe(true)
  expect(report.results).toHaveLength(2)
  for (const result of report.results) {
    expect(result.rawBytesAtRunner).toBe(0)
    expect(result.stderrPrivate).toBe(true)
    expect(result.stdoutPreserved).toBe(true)
  }
  expect(report.actualCodexInvoked).toBe(false)
})
