// Dual-mode plugin entry for the Agent Teams model tool: import the built
// lib output when this tree has one (the SDK launcher switches to the built
// CLI on the same condition), else the TypeScript source entry used by the
// tsx source launch. Scenario-local so the committed composition mounts the
// real Team tool in both replay lanes.
import { existsSync } from 'node:fs'

const target = existsSync(new URL('../../../packages/experimental/tool-agent-team/lib/index.js', import.meta.url))
  ? new URL('../../../packages/experimental/tool-agent-team/lib/index.js', import.meta.url)
  : new URL('../../../packages/experimental/tool-agent-team/src/index.ts', import.meta.url)
const plugin = await import(target.href)

export const name = plugin.name
export const inject = plugin.inject
export const Config = plugin.Config
export const apply = plugin.apply
export default plugin.default
