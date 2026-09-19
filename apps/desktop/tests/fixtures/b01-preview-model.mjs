/**
 * B01 测试模式 keyless 模型适配器（provider 路由 `b01-preview`）。
 *
 * 仅用于 B01 Windows 桌面交互取证：不访问网络、不读取凭据、不调用真实
 * 业务模型 API。
 *
 * 零依赖契约（2026-09-19 事故后收紧，见 W06/INCIDENT-1.md）：本文件不
 * import 任何 npm 包（包括 @deepseek-ai/*）——只使用 Node 内建模块，并经
 * 宿主注入接口 `ctx.llm.registerAdapter` 注册纯对象适配器；StreamChunk 等
 * 类型仅以结构化字面量产出，复刻 LlmAdapter 基类的默认 prepareCall 行为。
 * 因此该 fixture 在任何加载上下文都不发生包解析。
 *
 * 行为由最后一条用户文本触发：
 * - `B01-SLOW`：保持运行的慢速流式任务。派生一个自有 Node 子进程（PID 写
 *   入 journal 目录 `slow-child.pid`），每秒一个文本块，最长 120 秒；请求
 *   abort 时同步终止子进程并记录 `child-killed`。
 * - `B01-FAIL`：短流后以 `error` finish 结束，用于展示真实失败。
 * - 其他（含 `B01-PREVIEW`）：先输出 reasoning，再以约 350ms 间隔流式输出
 *   中文文本，最终结果含 `B01-PREVIEW-FINAL` 标记。
 *
 * 事件以 NDJSON 追加写入 `$DSH_B01_PREVIEW_STATE/model-journal.ndjson`
 * （环境变量未设置时不写 journal）。
 */

import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const PROVIDER = 'b01-preview'
const SLOW_CHILD_SCRIPT = [
  "const fs=require('node:fs')",
  "fs.writeFileSync(process.argv[1], String(process.pid))",
  "const deadline=Date.now()+300000",
  "setInterval(()=>{ if(Date.now()>deadline) process.exit(0) },1000)",
].join(';')

function journal(event) {
  const state = process.env.DSH_B01_PREVIEW_STATE
  if (state === undefined || state === '') return
  mkdirSync(state, { recursive: true })
  appendFileSync(join(state, 'model-journal.ndjson'), `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`)
}

function lastUserText(options) {
  for (let index = options.messages.length - 1; index >= 0; index -= 1) {
    const message = options.messages[index]
    if (message.role !== 'user') continue
    return message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('')
  }
  return ''
}

function sleep(ms, signal) {
  return new Promise(resolve => {
    const timer = setTimeout(done, ms)
    function done() {
      signal?.removeEventListener('abort', done)
      clearTimeout(timer)
      resolve()
    }
    if (signal !== undefined) signal.addEventListener('abort', done, { once: true })
  })
}

const adapter = {
  providerInfo(provider) {
    return { id: provider, name: `${provider}（B01 测试模式）` }
  },
  providerRetryPolicy() {
    return undefined
  },
  imageRequestPricing() {
    return undefined
  },
  listModels() {
    return Promise.resolve([])
  },
  async resolveModel(provider, model) {
    return { provider, id: model, name: `${model}（B01 测试模式）` }
  },
  async prepareCall(provider, model, signal) {
    return { model: await adapter.resolveModel(provider, model, signal), stream: options => adapter.stream(options) }
  },
  async *stream(options) {
    const signal = options.signal
    const text = lastUserText(options)
    journal({ type: 'request-start', purpose: options.purpose ?? 'chat', marker: text.slice(0, 64) })
    try {
      if (text.includes('B01-FAIL')) {
        const failed = 'B01 测试模式：即将失败。'
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: failed }
        yield { type: 'block-end', index: 0, block: { type: 'text', text: failed } }
        journal({ type: 'request-finish', outcome: 'error' })
        yield {
          type: 'finish',
          reason: { kind: 'error', failure: { code: 'SERVER', message: 'B01 测试模式注入的模型失败（keyless mock）' } },
        }
        return
      }

      if (text.includes('B01-SLOW')) {
        const state = process.env.DSH_B01_PREVIEW_STATE
        const pidFile = state === undefined || state === '' ? undefined : join(state, 'slow-child.pid')
        let child
        if (pidFile !== undefined) {
          mkdirSync(dirname(pidFile), { recursive: true })
          child = spawn(process.execPath, ['-e', SLOW_CHILD_SCRIPT, pidFile], { stdio: 'ignore' })
          child.unref()
          journal({ type: 'child-spawn', pid: child.pid, pidFile })
        }
        const killChild = () => {
          if (child === undefined || child.exitCode !== null || child.signalCode !== null) return
          child.kill()
          journal({ type: 'child-killed', pid: child.pid, reason: signal?.reason === undefined ? 'end' : String(signal.reason) })
        }
        signal?.addEventListener('abort', killChild, { once: true })
        try {
          yield { type: 'block-start', index: 0, blockType: 'text' }
          for (let round = 1; round <= 120; round += 1) {
            if (signal?.aborted) {
              journal({ type: 'request-abort', round })
              return
            }
            yield { type: 'text-delta', index: 0, text: `B01 测试模式保持运行 ${String(round).padStart(3, '0')}…\n` }
            await sleep(1000, signal)
            if (signal?.aborted) {
              journal({ type: 'request-abort', round })
              return
            }
          }
          journal({ type: 'request-finish', outcome: 'slow-drained' })
          return
        } finally {
          killChild()
        }
      }

      if (options.purpose === 'session-title') {
        yield { type: 'text-delta', index: 0, text: 'B01 测试会话' }
        yield { type: 'usage', usage: { inputTokens: 3, outputTokens: 4 } }
        journal({ type: 'request-finish', outcome: 'title' })
        yield { type: 'finish', reason: { kind: 'stop' } }
        return
      }

      const reasoning = 'B01 测试模式：组织最终回答。'
      yield { type: 'block-start', index: 0, blockType: 'reasoning' }
      yield { type: 'reasoning-delta', index: 0, text: reasoning }
      yield { type: 'block-end', index: 0, block: { type: 'reasoning', text: reasoning } }
      const marker = `B01-PREVIEW-FINAL-${Date.now()}`
      const sentences = [
        'B01 测试模式（keyless mock）正在流式输出。',
        '本回答不来自真实模型，也不读取任何凭据。',
        `最终标记：${marker}`,
      ]
      let full = ''
      yield { type: 'block-start', index: 1, blockType: 'text' }
      for (const sentence of sentences) {
        if (signal?.aborted) {
          journal({ type: 'request-abort' })
          return
        }
        yield { type: 'text-delta', index: 1, text: sentence }
        full += sentence
        await sleep(350, signal)
      }
      yield { type: 'block-end', index: 1, block: { type: 'text', text: full } }
      yield { type: 'usage', usage: { inputTokens: 21, outputTokens: 57, reasoningTokens: 3 } }
      journal({ type: 'request-finish', outcome: 'final', marker })
      yield { type: 'finish', reason: { kind: 'stop' } }
    } finally {
      journal({ type: 'request-end' })
    }
  },
}

export const name = 'b01-preview-model'
export const inject = ['llm']

/** 注册 B01 测试模式的 `b01-preview` 适配器路由（纯对象，零包导入）。 */
export function apply(ctx) {
  ctx.llm.registerAdapter([PROVIDER], adapter)
  ctx.effect(() => () => { journal({ type: 'provider-disposed' }) })
}
