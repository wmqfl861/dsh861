import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CoveragePartitionCoordinator, type CoverageCommand, type CoverageCommandResult } from './coverage-partitions.ts'

const passed: CoverageCommandResult = { exitCode: 0, signalCode: null }

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const vitestEntry = join(dirname(fileURLToPath(import.meta.resolve('vitest/package.json'))), 'vitest.mjs')
const vitestNodeModule = fileURLToPath(import.meta.resolve('vitest/node'))

/** Every temporary root created by this file, removed after each test. */
const roots: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-vitest-project-inheritance-'))
  roots.push(root)
  return root
}

/** Per-project facts resolved by the real installed Vitest for this repository. */
interface ResolvedProbeProject {
  name: string
  setupFiles: string[]
  targetPlugins: { 'vite-tsconfig-paths': number; 'dsh-standard-decorators': number }
}

/**
 * Resolve the repository's projects through the real installed Vitest node
 * API in a child process, reporting each project's resolved setup scripts and
 * how often the two target plugins appear in its resolved plugin pipeline.
 * `extends: false` is the declared means; these resolved outcomes are the
 * tested ends, so a reverted inheritance shows up as duplicated plugins and a
 * dropped project wiring as missing setup scripts.
 */
function resolveRepositoryProjects(): ResolvedProbeProject[] {
  const probe = [
    "import { pathToFileURL } from 'node:url'",
    `const { createVitest } = await import(pathToFileURL(${JSON.stringify(vitestNodeModule)}).href)`,
    `const vitest = await createVitest({ root: ${JSON.stringify(repositoryRoot)}, watch: false })`,
    'const projects = vitest.projects.map(project => {',
    '  const names = (project.viteConfig.plugins ?? []).map(plugin => plugin?.name).filter(Boolean)',
    '  return {',
    '    name: project.name,',
    '    setupFiles: project.config.setupFiles,',
    '    targetPlugins: {',
    "      'vite-tsconfig-paths': names.filter(name => name === 'vite-tsconfig-paths').length,",
    "      'dsh-standard-decorators': names.filter(name => name === 'dsh-standard-decorators').length,",
    '    },',
    '  }',
    '})',
    "console.log('@@PROJECTS@@' + JSON.stringify(projects))",
    'await vitest.close()',
  ].join('\n')
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', probe], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
  expect(result.status, `project probe failed: ${result.stderr}`).toBe(0)
  const marker = result.stdout.split(/\r?\n/).find(line => line.startsWith('@@PROJECTS@@'))
  if (marker === undefined) throw new Error(`project probe printed no result: ${result.stdout}\n${result.stderr}`)
  return JSON.parse(marker.slice('@@PROJECTS@@'.length)) as ResolvedProbeProject[]
}

/** List files through the real installed Vitest with `config` resolved against `root`. */
function listFiles(configPath: string | undefined, root: string, filter?: string): string[] {
  const result = spawnSync(process.execPath, [
    vitestEntry,
    'list',
    '--filesOnly',
    ...(configPath === undefined ? [] : [`--config=${configPath}`]),
    ...(filter === undefined ? [] : [filter]),
  ], { cwd: root, encoding: 'utf8' })
  expect(result.status, `vitest list failed: ${result.stderr}`).toBe(0)
  return result.stdout.split(/\r?\n/).filter(line => line.trim() !== '')
}

describe('vitest inline project inheritance', { timeout: 90_000 }, () => {
  it('resolves each project with the shared setup scripts and one copy of each target plugin', () => {
    const projects = resolveRepositoryProjects()
    expect(projects.map(project => project.name).sort()).toEqual(['process-bound', 'thread-safe'])
    for (const project of projects) {
      expect(project.setupFiles.map(file => file.split('/').at(-1)).sort())
        .toEqual(['test-invariants.ts', 'test-proxy-environment.ts'])
      expect(new Set(project.setupFiles).size).toBe(2)
      expect(project.targetPlugins['vite-tsconfig-paths']).toBe(1)
      expect(project.targetPlugins['dsh-standard-decorators']).toBe(1)
    }
  })

  it('lists this spec under exactly one project', () => {
    // A file this spec owns runs under `thread-safe` only; a reverted
    // `extends: false` re-broadens `process-bound` to every file, which the
    // listing shows as a second, process-bound line.
    const lines = listFiles(undefined, repositoryRoot, 'scripts/vitest-project-inheritance.spec.ts')
    expect(lines).toEqual(['[thread-safe] scripts/vitest-project-inheritance.spec.ts'])
  })

  it('narrows a generated partition config without re-inheriting the root include', async () => {
    const root = await temporaryRoot()
    // A base config with the repository's shape: a broad root include and two
    // projects pinned `extends: false`, each with its own include.
    await writeFile(join(root, 'vitest.config.ts'), [
      'export default {',
      '  test: {',
      "    include: ['packages/**/tests/**/*.spec.ts'],",
      '    projects: [',
      "      { extends: false, test: { name: 'thread-safe', include: ['packages/**/tests/**/*.spec.ts'] } },",
      "      { extends: false, test: { name: 'process-bound', include: ['packages/pb/tests/pb.spec.ts'] } },",
      '    ],',
      '  },',
      '}',
      '',
    ].join('\n'))
    for (const file of [
      'packages/a/tests/a.spec.ts',
      'packages/pb/tests/pb.spec.ts',
      // Matches the broad root include but no partition: re-inheriting that
      // include would run this file in both partition projects.
      'packages/other/tests/other.spec.ts',
    ]) {
      await mkdir(dirname(join(root, file)), { recursive: true })
      await writeFile(join(root, file), '')
    }
    // Preserve each generated partition config one directory deeper than its
    // original location (the coordinator removes coverage/.partitioned after
    // the run) so its '../../vitest.config.ts' import still reaches the root.
    const preservedConfigs: string[] = []
    const runCommand = vi.fn(async (command: CoverageCommand) => {
      const configArgument = command.args.find(argument => argument.startsWith('--config='))
      if (configArgument !== undefined) {
        const relativeConfig = configArgument.slice('--config='.length)
        const fileName = relativeConfig.split('/').at(-1)
        if (fileName === undefined) throw new Error(`partition config path has no file name: ${relativeConfig}`)
        const preserved = join(root, 'preserved', 'p', fileName)
        await mkdir(dirname(preserved), { recursive: true })
        await copyFile(join(root, relativeConfig), preserved)
        preservedConfigs.push(preserved)
      }
      if (command.blobPath !== undefined) {
        await mkdir(dirname(command.blobPath), { recursive: true })
        await writeFile(command.blobPath, '{}')
      }
      return passed
    })
    const coordinator = new CoveragePartitionCoordinator({
      root,
      partitions: 2,
      pnpmEntrypoint: '/pnpm.cjs',
      files: ['packages/a/tests/a.spec.ts', 'packages/pb/tests/pb.spec.ts'],
      projectOf: new Map([
        ['packages/a/tests/a.spec.ts', 'thread-safe'],
        ['packages/pb/tests/pb.spec.ts', 'process-bound'],
      ]),
      runCommand,
    })
    await expect(coordinator.run()).resolves.toBe(0)
    expect(preservedConfigs).toHaveLength(2)

    const allLines = preservedConfigs.flatMap(configPath => listFiles(configPath, root))
    // Every partition file is listed exactly once, under its own project only.
    expect(allLines).toContain('[thread-safe] packages/a/tests/a.spec.ts')
    expect(allLines).toContain('[process-bound] packages/pb/tests/pb.spec.ts')
    // The broad root include does not reach a narrowed partition, and a
    // project handed an empty file list runs nothing instead of everything.
    expect(allLines).toHaveLength(2)
  })
})
