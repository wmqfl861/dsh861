import { it } from 'vitest'
import { withPrivateCodexStderr } from '../src/private-stderr.ts'
import { registerPrivateStderrCases } from './private-stderr.cases.ts'

registerPrivateStderrCases((name, body) => { it(name, body) }, withPrivateCodexStderr)
