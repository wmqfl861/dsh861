import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { inspect } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Default: real repository source through --import tsx/esm. Explicit compiled
// mode is only a focused offline control, not a product build or supported-engine claim.
const built = process.env.P0B_SECURITY_MODULE_ROOT
const root = built ? resolve(built) : fileURLToPath(new URL('../', import.meta.url))
const ext = built ? '.js' : '.ts'
const load = name => import(pathToFileURL(join(root, name + ext)).href)
const { parseCredentialRef, resolveCredentialReferences } = await load('credential-ref')
const { SecretRedactor, SECRET_REPLACEMENT } = await load('redaction')
const { captureRedactedStream } = await load('collectors/redacted-stream')
const { assertSecretFreeArguments, outputSecurityVerdict } = await load('security-gates')
const limits = { maxSecrets: 8, maxSecretBytes: 4096 }
const value = 'synthetic-only-credential-861-Xy9+/="测试"'
const binding = { source: { kind: 'env', name: 'DSH_SYNTHETIC_KEY' }, targetEnv: 'OPENAI_API_KEY' }
const digest = value => createHash('sha256').update(value).digest('hex')
const sources = { readEnv: () => value }
const safeError = (error, code) => {
  assert.equal(error.message, code)
  assert.equal(inspect(error).includes(value), false)
  assert.equal(error.cause, undefined)
  return true
}
async function owned(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh861-security-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}
function redact(text, secrets = [value], chunkSize = 7) {
  const redactor = new SecretRedactor(secrets, limits)
  const bytes = Buffer.from(text)
  let result = ''
  for (let start = 0; start < bytes.length; start += chunkSize) result += redactor.push(bytes.subarray(start, start + chunkSize))
  result += redactor.finish()
  return { result, detected: redactor.secretLeakDetected }
}

for (const reference of ['file:/tmp/key', 'env:', 'env:KEY=value', 'env:KEY\n', 'env:lowercase',
  'secret-reference:', 'secret-reference:../unsafe?x', value, '', null, {}]) {
  test(`credential parser rejects inadmissible reference ${String(reference).length}`, () => {
    assert.throws(() => parseCredentialRef(reference), error => safeError(error, 'CREDENTIAL_SOURCE_FORBIDDEN'))
  })
}

test('credential parser accepts explicit reference identities only', () => {
  assert.deepEqual(parseCredentialRef('env:DSH_SYNTHETIC_KEY'), binding.source)
  assert.deepEqual(parseCredentialRef('secret-reference:company/service-key'), { kind: 'secret-reference', id: 'company/service-key' })
})

test('every binding must be granted before any source read', async () => {
  let reads = 0
  const reader = { readEnv: () => { reads++; return value } }
  const forbidden = { ...binding, targetEnv: 'ANTHROPIC_API_KEY' }
  await assert.rejects(resolveCredentialReferences([binding, forbidden], [binding], reader),
    error => safeError(error, 'CREDENTIAL_SOURCE_FORBIDDEN'))
  assert.equal(reads, 0)
  await assert.rejects(resolveCredentialReferences([binding, binding], [binding], reader))
  assert.equal(reads, 0)
})

for (const targetEnv of ['PATH', 'NODE_OPTIONS', 'HOME', '__proto__', 'invalid=name']) {
  test(`credential target refuses process injection ${targetEnv}`, async () => {
    const item = { ...binding, targetEnv }
    await assert.rejects(resolveCredentialReferences([item], [item], sources),
      error => safeError(error, 'CREDENTIAL_SOURCE_FORBIDDEN'))
  })
}

test('additional credential fields cannot smuggle a literal or fallback', async () => {
  for (const item of [{ ...binding, value }, { ...binding, source: { ...binding.source, fallback: value } }]) {
    await assert.rejects(resolveCredentialReferences([item], [item], sources))
  }
})

test('lease serializes/inspects metadata without secrets or secret-derived hashes', async () => {
  const lease = await resolveCredentialReferences([binding], [binding], sources)
  const diagnostics = JSON.stringify(lease) + inspect(lease, { showHidden: true })
  assert.equal(diagnostics.includes(value), false)
  assert.equal(diagnostics.includes(digest(value)), false)
  assert.equal(diagnostics.includes('nonempty'), true)
  const metadata = lease.metadata()
  metadata[0].source.name = 'ALTERED'
  assert.equal(lease.metadata()[0].source.name, 'DSH_SYNTHETIC_KEY')
  let retainedEnvironment
  let retainedValues
  await lease.use((environment, values) => {
    retainedEnvironment = environment
    retainedValues = values
    assert.deepEqual(Object.keys(environment), ['OPENAI_API_KEY'])
    assert.equal(Object.getPrototypeOf(environment), null)
    assert.equal(environment.OPENAI_API_KEY, value)
    assert.deepEqual(values, [value])
    assert.equal(environment.PATH, undefined)
  })
  assert.deepEqual(Object.keys(retainedEnvironment), [])
  assert.deepEqual(retainedValues, [])
  await assert.rejects(lease.use(() => {}), error => safeError(error, 'CREDENTIAL_LEASE_CLOSED'))
})

test('lease rejects overlapping use and disposal remains idempotent', async () => {
  const lease = await resolveCredentialReferences([binding], [binding], sources)
  await lease.use(async () => {
    await assert.rejects(lease.use(() => {}), error => safeError(error, 'CREDENTIAL_LEASE_CLOSED'))
  })
  lease.dispose()
  lease.dispose()
})

test('trusted secret resolver gets the granted id and no environment fallback', async () => {
  const source = { kind: 'secret-reference', id: 'company/key-861' }
  const item = { source, targetEnv: 'ANTHROPIC_API_KEY' }
  const reads = []
  const lease = await resolveCredentialReferences([item], [item], {
    readEnv: () => { throw new Error('must not call') },
    readSecret: async id => { reads.push(id); return value },
  })
  assert.deepEqual(reads, [source.id])
  lease.dispose()
  await assert.rejects(resolveCredentialReferences([item], [item], sources),
    error => safeError(error, 'CREDENTIAL_SOURCE_UNAVAILABLE'))
})

for (const absent of [undefined, '']) {
  test(`missing credentials never fall back (${String(absent)})`, async () => {
    let reads = 0
    await assert.rejects(resolveCredentialReferences([binding], [binding], { readEnv: () => { reads++; return absent } }),
      error => safeError(error, 'CREDENTIAL_MISSING'))
    assert.equal(reads, 1)
  })
}

for (const invalid of [' ', 'synthetic\nkey', 'synthetic\0key', 42, '\uD800']) {
  test(`invalid credential values are rejected (${typeof invalid}/${String(invalid).length})`, async () => {
    await assert.rejects(resolveCredentialReferences([binding], [binding], { readEnv: () => invalid }),
      error => safeError(error, 'CREDENTIAL_VALUE_INVALID'))
  })
}

test('source and callback exceptions cannot leak a credential via message/cause', async () => {
  await assert.rejects(resolveCredentialReferences([binding], [binding], { readEnv: () => { throw new Error(value) } }),
    error => safeError(error, 'CREDENTIAL_SOURCE_UNAVAILABLE'))
  const lease = await resolveCredentialReferences([binding], [binding], sources)
  await assert.rejects(lease.use(() => { throw new Error(value) }),
    error => safeError(error, 'CREDENTIAL_OPERATION_FAILED'))
  assert.equal(lease.toJSON().usable, false)
})

const encoded = encodeURIComponent(value)
const representations = [value, JSON.stringify(value).slice(1, -1), encoded,
  encoded.replace(/%[0-9A-F]{2}/g, part => part.toLowerCase()),
  new URLSearchParams({ v: value }).toString().slice(2),
  Buffer.from(value).toString('base64'), Buffer.from(value).toString('base64url')]
for (const [index, representation] of representations.entries()) {
  test(`redacts representation ${index} at every byte boundary`, () => {
    const bytes = Buffer.from(`before:${representation}:after`)
    for (let cut = 0; cut <= bytes.length; cut++) {
      const r = new SecretRedactor([value], limits)
      const output = r.push(bytes.subarray(0, cut)) + r.push(bytes.subarray(cut)) + r.finish()
      assert.equal(output, `before:${SECRET_REPLACEMENT}:after`)
      assert.equal(r.secretLeakDetected, true)
    }
  })
}

test('overlapping secrets redact the union rather than releasing a suffix', () => {
  const secrets = ['syntheticABC', 'ABCverylongsynthetic']
  for (let chunk = 1; chunk <= 24; chunk++) {
    assert.equal(redact('left syntheticABCverylongsynthetic right', secrets, chunk).result,
      `left ${SECRET_REPLACEMENT} right`)
  }
})

test('prefix aliases and adjacent matches do not release plaintext', () => {
  const secrets = ['synthetic-alpha', 'synthetic-alpha-long']
  const input = 'synthetic-alpha-longsynthetic-alpha'
  for (let chunk = 1; chunk <= 30; chunk++) assert.equal(redact(input, secrets, chunk).result, SECRET_REPLACEMENT)
})

test('partial known prefixes stay buffered until their suffix can be checked', () => {
  const r = new SecretRedactor([value], limits)
  assert.equal(r.push(Buffer.from(value.slice(0, 12))), '')
  assert.equal(r.push(Buffer.from(value.slice(12))) + r.finish(), SECRET_REPLACEMENT)
})

test('non-secret unicode, split UTF-8 and empty streams preserve text', () => {
  const text = '正常日志：🧪🙂 café\n'.repeat(30)
  for (let chunk = 1; chunk <= 64; chunk++) {
    const result = redact(text, [value], chunk)
    assert.equal(result.result, text)
    assert.equal(result.detected, false)
  }
  const r = new SecretRedactor([value], limits)
  assert.equal(r.finish(), '')
  assert.equal(r.secretLeakDetected, false)
})

test('large streams retain bounded suffixes and fire detection once', () => {
  let count = 0
  const r = new SecretRedactor([value], limits, () => count++)
  let output = ''
  for (let i = 0; i < 1000; i++) {
    output += r.push(Buffer.from(i === 2 || i === 998 ? value : '.'.repeat(1000)))
    assert.ok(r.pendingCharacters < 1000)
  }
  output += r.finish()
  assert.equal(count, 1)
  assert.equal(output.includes(value), false)
  assert.equal(output.split(SECRET_REPLACEMENT).length, 3)
})

test('redactor enforces configuration and closed-stream lifecycle', () => {
  for (const [values, bounds] of [[[], limits], [[''], limits], [[value], { maxSecrets: 0, maxSecretBytes: 4 }],
    [[value], { ...limits, maxSecretBytes: 2 }], [[SECRET_REPLACEMENT], limits], [['\uD800'], limits]]) {
    assert.throws(() => new SecretRedactor(values, bounds), error => safeError(error, 'REDACTION_CONFIGURATION_INVALID'))
  }
  const r = new SecretRedactor([value], limits)
  r.discard()
  assert.throws(() => r.push(Buffer.from('text')))
  assert.throws(() => r.finish())
  assert.equal(r.pendingCharacters, 0)
})

test('failed detection callback discards pending input and returns safe error', () => {
  const r = new SecretRedactor([value], limits, () => { throw new Error(value) })
  assert.throws(() => r.push(Buffer.from(value)), error => safeError(error, 'REDACTION_DETECTION_CALLBACK_FAILED'))
  assert.equal(r.pendingCharacters, 0)
  assert.equal(r.secretLeakDetected, true)
})

test('argv gate rejects raw, escaped, encoded credentials and allows reference names', () => {
  assert.doesNotThrow(() => assertSecretFreeArguments(['node', 'runner', '--credential-ref', 'env:DSH_SYNTHETIC_KEY'], [value], limits))
  for (const representation of representations) {
    assert.throws(() => assertSecretFreeArguments(['node', '--key', representation], [value], limits),
      error => safeError(error, 'SECRET_IN_ARGUMENTS'))
  }
  assert.throws(() => assertSecretFreeArguments([], [value], limits))
})

test('clean capture writes a private new file and hashes only persisted UTF-8 bytes', async t => {
  const runRoot = await owned(t)
  const text = 'ordinary output 🧪\n'
  const report = await captureRedactedStream(Readable.from([Buffer.from(text)]),
    { ...limits, runRoot, channel: 'stdout', maxOutputBytes: 10000 }, [value])
  const bytes = await readFile(join(runRoot, report.file))
  assert.equal(bytes.toString(), text)
  assert.equal(report.redactedSha256, digest(bytes))
  assert.equal(report.bytes, bytes.length)
  assert.equal(report.status, 'CAPTURED')
  assert.equal(report.secretLeakDetected, false)
  if (process.platform !== 'win32') assert.equal((await stat(join(runRoot, report.file))).mode & 0o777, 0o600)
  await assert.rejects(captureRedactedStream(Readable.from(['overwrite']),
    { ...limits, runRoot, channel: 'stdout', maxOutputBytes: 10000 }, [value]),
  error => safeError(error, 'CAPTURE_OPEN_FAILED'))
  assert.equal((await readFile(join(runRoot, report.file))).toString(), text)
})

test('actual synthetic subprocess stdout/stderr are sanitized before persistence', async t => {
  const runRoot = await owned(t)
  const lease = await resolveCredentialReferences([binding], [binding], sources)
  let detections = 0
  const reports = await lease.use(async (environment, secrets) => {
    const script = 'const s=process.env.OPENAI_API_KEY; process.stdout.write(s.slice(0,7)); setImmediate(()=>{process.stdout.write(s.slice(7)); process.stderr.write(JSON.stringify({value:s}));});'
    const argv = [process.execPath, '-e', script]
    assertSecretFreeArguments(argv, secrets, limits)
    const child = spawn(argv[0], argv.slice(1), { env: { ...environment }, stdio: ['ignore', 'pipe', 'pipe'] })
    const exited = once(child, 'close')
    t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited.catch(() => {}) })
    const reports = await Promise.all(['stdout', 'stderr'].map(channel => captureRedactedStream(child[channel],
      { ...limits, runRoot, channel, maxOutputBytes: 10000 }, secrets, () => detections++)))
    assert.equal((await exited)[0], 0)
    return reports
  })
  assert.equal(detections, 2)
  assert.deepEqual(outputSecurityVerdict(reports), { status: 'FAIL', failureClass: 'SECRET_LEAK_DETECTED', productAccepted: false })
  for (const report of reports) {
    const bytes = await readFile(join(runRoot, report.file))
    assert.equal(bytes.includes(Buffer.from(value)), false)
    assert.equal(bytes.includes(Buffer.from(JSON.stringify(value).slice(1, -1))), false)
    assert.equal(report.redactedSha256, digest(bytes))
    assert.equal(bytes.includes(Buffer.from(SECRET_REPLACEMENT)), true)
  }
})

test('capture rejects invalid channels, output bounds and relative roots', async t => {
  const runRoot = await owned(t)
  for (const changes of [{ channel: '../escape' }, { runRoot: 'relative' }, { maxOutputBytes: 0 }, { maxOutputBytes: NaN }]) {
    await assert.rejects(captureRedactedStream(Readable.from(['text']),
      { ...limits, runRoot, channel: 'stdout', maxOutputBytes: 10000, ...changes }, [value]),
    error => safeError(error, 'CAPTURE_CONFIGURATION_INVALID'))
  }
})

test('capture output limit is fail-closed and cannot produce a success receipt', async t => {
  const runRoot = await owned(t)
  await assert.rejects(captureRedactedStream(Readable.from(['ordinary long output']),
    { ...limits, runRoot, channel: 'stdout', maxOutputBytes: 2 }, [value]),
  error => safeError(error, 'CAPTURE_OUTPUT_LIMIT'))
})

test('source error does not leak through raw suffix, error message or cause', async t => {
  const runRoot = await owned(t)
  const stream = new Readable({ read() { this.push(Buffer.from(value.slice(0, 10))); this.destroy(new Error(value)) } })
  await assert.rejects(captureRedactedStream(stream,
    { ...limits, runRoot, channel: 'stderr', maxOutputBytes: 10000 }, [value]),
  error => safeError(error, 'CAPTURE_IO_FAILED'))
  assert.equal((await readFile(join(runRoot, 'stderr.redacted.log'))).length, 0)
})

test('existing log symlink cannot redirect output to another owned file', async t => {
  if (process.platform === 'win32') {
    // A preexisting file covers exclusive-open behavior on Windows without symlink privileges.
    const runRoot = await owned(t)
    await writeFile(join(runRoot, 'stdout.redacted.log'), 'preserve')
    await assert.rejects(captureRedactedStream(Readable.from(['text']),
      { ...limits, runRoot, channel: 'stdout', maxOutputBytes: 10000 }, [value]))
    return
  }
  const runRoot = await owned(t)
  const elsewhere = await owned(t)
  const target = join(elsewhere, 'untouched.txt')
  await writeFile(target, 'preserve')
  await symlink(target, join(runRoot, 'stdout.redacted.log'))
  await assert.rejects(captureRedactedStream(Readable.from(['text']),
    { ...limits, runRoot, channel: 'stdout', maxOutputBytes: 10000 }, [value]),
  error => safeError(error, 'CAPTURE_OPEN_FAILED'))
  assert.equal(await readFile(target, 'utf8'), 'preserve')
})

test('output gate requires both distinct captures and never returns product PASS', () => {
  const good = channel => ({ status: 'CAPTURED', failureClass: null, secretLeakDetected: false,
    file: `${channel}.redacted.log`, bytes: 0, redactedSha256: digest('') })
  const reports = [good('stdout'), good('stderr')]
  assert.deepEqual(outputSecurityVerdict(reports), { status: 'OUTPUT_CAPTURED', failureClass: null, productAccepted: false })
  for (const invalid of [[], [reports[0]], [reports[0], reports[0]],
    [{ ...reports[0], status: 'PASS' }, reports[1]], [{ ...reports[0], bytes: -1 }, reports[1]],
    [{ ...reports[0], redactedSha256: 'not-a-hash' }, reports[1]], [null, reports[1]]]) {
    assert.equal(outputSecurityVerdict(invalid).status, 'BLOCKED')
  }
  assert.equal(outputSecurityVerdict([{ ...reports[0], secretLeakDetected: true }, reports[1]]).status, 'FAIL')
})


test('freezing callback copies cannot prevent lease closure', async () => {
  const lease = await resolveCredentialReferences([binding], [binding], sources)
  await lease.use((environment, values) => { Object.freeze(environment); Object.freeze(values) })
  assert.equal(lease.toJSON().usable, false)
  await assert.rejects(lease.use(() => {}), error => safeError(error, 'CREDENTIAL_LEASE_CLOSED'))
})

test('capture fixes its output limit before asynchronous work starts', async t => {
  const runRoot = await owned(t)
  const config = { ...limits, runRoot, channel: 'stdout', maxOutputBytes: 2 }
  const capture = captureRedactedStream(Readable.from(['ordinary long text']), config, [value])
  config.maxOutputBytes = 100000
  await assert.rejects(capture, error => safeError(error, 'CAPTURE_OUTPUT_LIMIT'))
})

test('seeded fragmented-stream checks match an independent whole-text masking oracle', () => {
  let state = 861
  const random = n => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n }
  const chars = 'abcdefXYZ012345-'
  const word = n => Array.from({ length: n }, () => chars[random(chars.length)]).join('')
  for (let run = 0; run < 200; run++) {
    const a = 'token-' + word(15)
    const b = a.slice(-6) + word(12)
    const secrets = [a, b]
    const text = word(40) + a + b.slice(6) + word(30) + a + word(30)
    const coverage = Array(text.length).fill(false)
    for (const secret of secrets) {
      const forms = [secret, Buffer.from(secret).toString('base64'), Buffer.from(secret).toString('base64url')]
      for (const form of forms) {
        for (let pos = text.indexOf(form); pos !== -1; pos = text.indexOf(form, pos + 1)) {
          for (let i = pos; i < pos + form.length; i++) coverage[i] = true
        }
      }
    }
    let expected = ''
    let masked = false
    for (let i = 0; i < text.length; i++) {
      if (coverage[i]) { if (!masked) expected += SECRET_REPLACEMENT; masked = true }
      else { expected += text[i]; masked = false }
    }
    assert.equal(redact(text, secrets, random(31) + 1).result, expected)
  }
})
