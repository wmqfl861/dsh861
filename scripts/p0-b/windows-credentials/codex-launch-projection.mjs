/** Non-secret Codex launch projection. Does not issue approval, read keys, write files, or spawn. */
import { win32, posix } from 'node:path'
import { resolveApprovedRoute, publicConfigDigest } from '../model-config.mjs'

const own = (value, key) => Object.hasOwn(value, key)
const fields = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => own(value, key))
const fail = () => { throw new Error('CODEX_LAUNCH_PROJECTION_REFUSED') }
const printable = value => typeof value === 'string' && value.length > 0 && !/[\x00-\x1f\x7f]/.test(value)

function fixedPath(value, path) {
  if (!printable(value) || !path.isAbsolute(value) || value.includes('..')) fail()
  // Network shares require a separate deployment contract, not ambient authentication.
  if (path === win32 && !/^[A-Za-z]:\\/.test(value)) fail()
  return path.normalize(value)
}

function contains(parent, child, path) {
  const suffix = path.relative(parent, child)
  return suffix === '' || (suffix !== '..' && !suffix.startsWith(`..${path.sep}`) && !path.isAbsolute(suffix))
}

/**
 * Project a lock-checked public declaration into native argv, config and an isolated-path environment.
 * @param {unknown} configuration - parsed model declaration; no literal credentials permitted.
 * @param {unknown} trustedLock - separately retained approved lock, not an upgrade proposal's own lock.
 * @param {object} input - explicit deployment paths; the function reads no ambient environment.
 * @returns {object} immutable non-activated projection. Callers must verify native semantics and OS isolation.
 */
export function projectCodexLaunch(configuration, trustedLock, input) {
  try {
    const route = resolveApprovedRoute(configuration, trustedLock, 'codex')
    const url = new URL(route.baseUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail()
    if (!fields(input, ['platform', 'workspace', 'runRoot', 'executable', 'executableSha256', 'systemRoot', 'toolDirectories'])
      || !['win32', 'linux', 'darwin'].includes(input.platform)
      || !/^[a-f0-9]{64}$/.test(input.executableSha256)
      || !Array.isArray(input.toolDirectories) || input.toolDirectories.length === 0) fail()
    const path = input.platform === 'win32' ? win32 : posix
    const workspace = fixedPath(input.workspace, path)
    const runRoot = fixedPath(input.runRoot, path)
    const executable = fixedPath(input.executable, path)
    if (contains(workspace, runRoot, path) || contains(runRoot, workspace, path)
      || contains(runRoot, executable, path)) fail()
    const tools = input.toolDirectories.map(value => fixedPath(value, path))
    if (tools.some(value => value.includes(path.delimiter))) fail()
    const home = path.join(runRoot, 'home')
    const codexHome = path.join(runRoot, 'codex-home')
    const temporary = path.join(runRoot, 'tmp')
    const environment = {
      HOME: home, USERPROFILE: home, CODEX_HOME: codexHome,
      TEMP: temporary, TMP: temporary, TMPDIR: temporary,
      XDG_CONFIG_HOME: path.join(runRoot, 'config'), XDG_CACHE_HOME: path.join(runRoot, 'cache'),
      XDG_DATA_HOME: path.join(runRoot, 'data'), XDG_STATE_HOME: path.join(runRoot, 'state'),
      PATH: tools.join(path.delimiter),
    }
    if (input.platform === 'win32') {
      const systemRoot = fixedPath(input.systemRoot, path)
      Object.assign(environment, { SystemRoot: systemRoot, WINDIR: systemRoot,
        COMSPEC: path.join(systemRoot, 'System32', 'cmd.exe'),
        HOMEDRIVE: path.parse(home).root.slice(0, 2), HOMEPATH: home.slice(2),
        APPDATA: path.join(home, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(home, 'AppData', 'Local') })
    } else if (input.systemRoot !== null) fail()
    const credentialEnvironmentVariable = 'DSH861_CODEX_API_KEY'
    const safeShellEnvironment = Object.keys(environment).filter(name => name !== 'CODEX_HOME')
    const configToml = [
      `model_provider = ${JSON.stringify(route.provider)}`,
      `model = ${JSON.stringify(route.model)}`,
      `model_reasoning_effort = ${JSON.stringify(route.reasoningEffort)}`,
      'approval_policy = "never"', 'sandbox_mode = "read-only"', 'web_search = "disabled"',
      '', `[model_providers.${JSON.stringify(route.provider)}]`,
      `name = ${JSON.stringify(route.provider)}`, `base_url = ${JSON.stringify(route.baseUrl)}`,
      'wire_api = "responses"', `env_key = ${JSON.stringify(credentialEnvironmentVariable)}`,
      '', '[shell_environment_policy]', 'inherit = "none"', 'ignore_default_excludes = false',
      'exclude = ["*KEY*", "*TOKEN*", "*SECRET*"]',
      `include_only = ${JSON.stringify(safeShellEnvironment)}`,
      // With inherit=none, explicitly supply only non-secret shell locations.
      `set = { ${safeShellEnvironment.map(name => `${JSON.stringify(name)} = ${JSON.stringify(environment[name])}`).join(', ')} }`,
      '',
    ].join('\n')
    const args = ['exec', '--model', route.model, '--config', `model_provider=${JSON.stringify(route.provider)}`,
      '--config', `model_reasoning_effort=${JSON.stringify(route.reasoningEffort)}`,
      '--sandbox', 'read-only', '--ephemeral', '--json', '--color', 'never', '--cd', workspace, '-']
    return Object.freeze({
      status: 'CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED', productAccepted: false,
      publicConfigSha256: publicConfigDigest(configuration), route,
      executable, executableSha256: input.executableSha256,
      workingDirectory: workspace, runRoot, configFile: path.join(codexHome, 'config.toml'), configToml,
      args: Object.freeze(args), environment: Object.freeze(environment), credentialEnvironmentVariable,
      requiredBeforeCredentialRead: Object.freeze(['verified-owner-approval', 'rotation-attestation',
        'native-config-and-read-only-enforcement', 'scope-and-config-discovery-isolation',
        'transport-certificate-and-route-verification', 'external-budget-enforcement',
        'owned-process-tree-control']),
    })
  } catch {
    // Input paths, parser messages and malformed declarations can contain secrets.
    fail()
  }
}
