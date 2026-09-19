/**
 * B01 测试模式启动辅助（开发模式，事故后收紧版；见 W06/INCIDENT-1.md）。
 *
 * 隔离契约（总控批准的返工硬条件）：
 * 1. 只写测试独有目录 `B01_TEST_ROOT`（默认 C:\dsh-b01-w06）：测试 app 目录
 *    （package.json + 指向仓库已构建 lib/renderer 的 junction）、其下的
 *    development project、electron-user-data、测试 patch/fixture 副本。**永不
 *    写 apps/desktop/.desktop-build/development/**——防呆断言强制。
 * 2. 装配时序（D07）：先 `prepareDevelopmentProject` 重建测试 project，再把
 *    b01-preview.cordis.patch.yml 装配为其用户层 cordis.patch.yml，并把零导入
 *    fixture 复制到同目录，最后才启动 Electron。目标已存在非自有同名文件时
 *    先备份，Electron 退出后恢复/清理（含异常路径）。
 * 3. 启动的是同一个 Electron main（同一 lib/main.js 字节、同一 argv 契约、
 *    同一私有 Desktop Host），仅 app path 锚定到测试目录；不创建另一套网页、
 *    Node 应用或传输。
 * 4. 不触发任何构建：只消费既有 lib/ 产物，缺失即报错（重型构建归总控）。
 *
 * 调用（仓库根，工具链 Node + tsx ESM 钩子）：
 *   node --import tsx/esm apps/desktop/tests/fixtures/b01-preview-launch.mjs
 *
 * 环境约定：DSH_HOME（测试 home）、DSH_B01_PREVIEW_STATE（模型 journal 目
 * 录）、DSH_B01_PREVIEW=1（激活测试模式条目）由调用方设置；调试端口开关与
 * dev.ts 相同。退出码透传 Electron 进程退出码。
 */

import { spawn, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'
import { DESKTOP_HOST_PROTOCOL_VERSION } from '../../src/host-protocol.ts'
import { prepareDevelopmentProject } from '../../scripts/development-project.ts'

const APP_ROOT = resolve(import.meta.dirname, '..', '..')
const REPOSITORY_ROOT = resolve(APP_ROOT, '..', '..')
const FIXTURE_ROOT = import.meta.dirname
const TEST_ROOT = resolve(process.env.B01_TEST_ROOT ?? 'C:\\dsh-b01-w06')
const TEST_APP_ROOT = join(TEST_ROOT, 'app')
const FORBIDDEN_PROJECT = join(APP_ROOT, '.desktop-build', 'development')

/** 防呆：只允许写测试独有目录内的路径，且绝不触碰仓库 development 目录。 */
function assertOwned(path) {
  const target = resolve(path)
  if (target !== TEST_ROOT && !target.startsWith(TEST_ROOT + sep)) {
    throw new Error(`B01 preview launch: refusing to write outside the test root ${TEST_ROOT}: ${target}`)
  }
  if (target === FORBIDDEN_PROJECT || target.startsWith(FORBIDDEN_PROJECT + sep)) {
    throw new Error(`B01 preview launch: refusing to write the repository development directory ${FORBIDDEN_PROJECT}: ${target}`)
  }
  return target
}

function packageVersion(path, subject) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof manifest.version !== 'string') throw new Error(`B01 preview launch: ${subject} has no version`)
  return manifest.version
}

function debugPort(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  const port = Number(value)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`B01 preview launch: ${name} must be an integer from 1 through 65535`)
  }
  return port
}

function junction(source, destination) {
  assertOwned(destination)
  if (existsSync(destination)) return
  spawnSyncJunction(source, destination)
}

function spawnSyncJunction(source, destination) {
  if (process.platform !== 'win32') {
    throw new Error(`B01 preview launch: junction creation requires win32, got ${process.platform}`)
  }
  const result = spawnSync('cmd', ['/c', 'mklink', '/J', destination, source], { encoding: 'utf8' })
  // mklink prints "created << ... >>"; a failure leaves status non-zero.
  if (result.status !== 0) {
    throw new Error(
      `B01 preview launch: mklink /J ${destination} -> ${source} failed with ${String(result.status)}: ${result.stderr ?? ''}`,
    )
  }
}

function main() {
  for (const path of [
    join(APP_ROOT, 'lib', 'main.js'),
    join(REPOSITORY_ROOT, 'apps', 'desktop-host', 'lib', 'index.js'),
    join(APP_ROOT, 'renderer', 'startup.html'),
  ]) {
    if (!existsSync(path)) {
      throw new Error(`B01 preview launch: missing built artifact ${path}; the heavy build is owned by the controller`)
    }
  }
  const version = packageVersion(join(APP_ROOT, 'package.json'), 'desktop package')
  const pnpmVersion = packageVersion(join(APP_ROOT, 'node_modules', 'pnpm', 'package.json'), 'pnpm package')
  const require = createRequire(join(APP_ROOT, 'package.json'))
  const electron = require('electron')
  if (typeof electron !== 'string') throw new Error('B01 preview launch: electron executable is unavailable')

  // Test-owned app dir: same Electron main bytes (junctioned lib), test-owned
  // resolution anchor so the development project and userData land under TEST_ROOT.
  const testAppPackage = join(TEST_APP_ROOT, 'package.json')
  assertOwned(testAppPackage)
  mkdirSync(TEST_APP_ROOT, { recursive: true })
  const appManifest = {
    name: 'b01-preview-desktop-app',
    private: true,
    version: '0.0.0',
    main: 'lib/main.js',
  }
  if (!existsSync(testAppPackage)) {
    copyFileSync(join(APP_ROOT, 'package.json'), `${testAppPackage}.repository-copy`)
    writeJsonFile(testAppPackage, appManifest)
  }
  junction(join(APP_ROOT, 'lib'), join(TEST_APP_ROOT, 'lib'))
  junction(join(APP_ROOT, 'renderer'), join(TEST_APP_ROOT, 'renderer'))

  const projectDir = join(TEST_APP_ROOT, '.desktop-build', 'development', 'project')
  assertOwned(projectDir)
  prepareDevelopmentProject({
    projectDir,
    cliDir: join(REPOSITORY_ROOT, 'apps', 'cli'),
    hostDir: join(REPOSITORY_ROOT, 'apps', 'desktop-host'),
    dependencyDir: join(REPOSITORY_ROOT, 'node_modules', '.pnpm', 'node_modules'),
    release: {
      schemaVersion: 1,
      version,
      hostProtocolVersion: DESKTOP_HOST_PROTOCOL_VERSION,
      nodeVersion: process.versions.node,
      pnpmVersion,
    },
  })
  const userPatch = join(projectDir, 'cordis.patch.yml')
  const fixtureCopy = join(projectDir, 'b01-preview-model.mjs')
  const backup = join(TEST_ROOT, 'backup', `cordis.patch.yml.${String(Date.now())}`)
  const foreignPatch = existsSync(userPatch)
  if (foreignPatch) {
    assertOwned(backup)
    mkdirSync(dirname(backup), { recursive: true })
    renameSync(userPatch, backup)
    console.log(`B01 preview launch: backed up pre-existing foreign cordis.patch.yml to ${backup}`)
  }
  copyFileSync(join(FIXTURE_ROOT, 'b01-preview.cordis.patch.yml'), userPatch)
  copyFileSync(join(FIXTURE_ROOT, 'b01-preview-model.mjs'), fixtureCopy)

  const mainPort = debugPort('DSH_DESKTOP_MAIN_INSPECT_PORT', 9229)
  const rendererPort = debugPort('DSH_DESKTOP_RENDERER_DEBUG_PORT', 9222)
  const hostPort = debugPort('DSH_DESKTOP_HOST_INSPECT_PORT', 9230)
  const home = resolve(process.env.DSH_HOME ?? join(TEST_ROOT, 'home'))
  assertOwned(home)
  const userData = join(TEST_APP_ROOT, '.desktop-build', 'development', 'electron-user-data')
  const environment = {
    ...process.env,
    DSH_HOME: home,
    DSH_B01_PREVIEW: '1',
    DSH_DESKTOP_HOST_INSPECT_PORT: String(hostPort),
    DSH_DESKTOP_NODE_BINARY: process.execPath,
    DSH_DESKTOP_DSH_DIR: projectDir,
    DSH_DESKTOP_OPEN_DEVTOOLS: process.env.DSH_DESKTOP_OPEN_DEVTOOLS ?? '1',
    ELECTRON_ENABLE_LOGGING: process.env.ELECTRON_ENABLE_LOGGING ?? '1',
  }
  console.log(`B01 preview launch: electron=${electron}`)
  console.log(`B01 preview launch: node=${process.execPath} (${process.versions.node})`)
  console.log(`B01 preview launch: DSH_HOME=${home}`)
  console.log(`B01 preview launch: app=${TEST_APP_ROOT} (project=${projectDir})`)
  console.log(`B01 preview launch: test profile assembled at ${userPatch} (fixture copy: ${fixtureCopy})`)
  console.log(`B01 preview launch: inspectors main=${String(mainPort)}, renderer=${String(rendererPort)}, host=${String(hostPort)}`)
  const child = spawn(electron, [
    `--inspect=127.0.0.1:${String(mainPort)}`,
    `--remote-debugging-port=${String(rendererPort)}`,
    `--user-data-dir=${userData}`,
    TEST_APP_ROOT,
  ], { cwd: TEST_APP_ROOT, env: environment, stdio: 'inherit' })
  // An inherited-stdio child with no pipes does not hold the event loop on
  // Windows; a ref'd keepalive makes this helper wait for the real Electron
  // exit and forward its code, matching dev.ts semantics.
  const keepalive = setInterval(() => {}, 60_000)
  const cleanup = () => {
    rmSync(userPatch, { force: true })
    rmSync(fixtureCopy, { force: true })
    if (foreignPatch) {
      renameSync(backup, userPatch)
      console.log('B01 preview launch: restored pre-existing foreign cordis.patch.yml')
    }
  }
  child.once('error', (error) => {
    console.error(`B01 preview launch: electron failed to start: ${String(error)}`)
    clearInterval(keepalive)
    cleanup()
    process.exitCode = 1
  })
  child.once('exit', (code, signal) => {
    clearInterval(keepalive)
    cleanup()
    console.log(`B01 preview launch: electron exited code=${String(code ?? signal)}`)
    process.exitCode = code ?? (signal === null ? 1 : 2)
  })
}

function writeJsonFile(path, value) {
  writeFileSync(path, `${JSON.stringify(value, undefined, 2)}\n`)
}

main()
