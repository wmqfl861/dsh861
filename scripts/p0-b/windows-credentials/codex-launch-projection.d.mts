/** Typed surface of codex-launch-projection.mjs; the .mjs file stays the runtime source of record. */

/** Lock-verified public route fields the projection carries through. */
export interface ProjectedCodexRoute {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort: string
  readonly baseUrl: string
  readonly credentialRef: string
}

/** Result of a successful projection; never an authorization to launch. */
export interface CodexLaunchProjection {
  readonly status: 'CODEX_LAUNCH_PROJECTED_NOT_AUTHORIZED'
  readonly productAccepted: false
  readonly publicConfigSha256: string
  readonly route: ProjectedCodexRoute
  readonly executable: string
  readonly executableSha256: string
  readonly workingDirectory: string
  readonly runRoot: string
  readonly configFile: string
  readonly configToml: string
  readonly args: readonly string[]
  readonly environment: Readonly<Record<string, string>>
  readonly credentialEnvironmentVariable: string
  readonly requiredBeforeCredentialRead: readonly string[]
}

/**
 * Project a lock-checked public declaration into native argv, config and an
 * isolated-path environment. Throws CODEX_LAUNCH_PROJECTION_REFUSED.
 */
export function projectCodexLaunch(
  configuration: unknown,
  trustedLock: unknown,
  input: unknown,
): CodexLaunchProjection
