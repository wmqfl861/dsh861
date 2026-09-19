/**
 * Test-only ownership ledger for fixture Contexts and the temporary roots they
 * create, shared by the tool-subagent-control and tool-agent-team suites and
 * their ownership regression. A fixture registers its Context at creation —
 * before the first setup await that can fail — and its root directory the
 * moment that directory exists, so afterEach unwinds even a setup that threw
 * midway or a test whose assertions failed early. Cleanup also observes each
 * fixture's structured logger outlet across its whole disposal, because
 * Cordis reports disposer failures only through the logger; such logged
 * failures veto the root's deletion like a rejected disposal would.
 * @module owned-contexts
 */

import { rmSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import type { Exporter, LoggerService, Message } from '@deepseek-ai/cordis'
import type { SessionHandle, SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'

/**
 * Exporter key for {@link DisposeFailureObserver}. The logger service numbers
 * its own exporter registrations from a positive counter, so a fixed negative
 * key can never collide with one.
 */
const disposeObserverKey = -1

/** One error-level log record captured while a fixture's disposal ran. */
interface DisposeFailure {
  /** The logged reason unchanged — the disposer's original thrown object. */
  readonly reason: unknown
  /** Fiber that reported the failure: root, child, or unknown (collected). */
  readonly source: string
}

/**
 * Test-only observer over one fixture's structured logger outlet. Cordis
 * catches disposer failures inside `Fiber` unload and reports them through
 * `ctx.logger.error` while `fiber.dispose()` still resolves, so awaiting the
 * disposal alone cannot see them. The observer registers directly in the
 * fixture app's exporter map rather than through `ctx.logger.exporter()`,
 * whose disposer is fiber-owned and removed by the very disposal under
 * observation; {@link DisposeFailureObserver.detach} runs only after that
 * disposal settled, so late child-fiber failures are captured too. `export`
 * deliberately cannot throw: a failing exporter would break the framework's
 * own error reporting mid-disposal.
 */
class DisposeFailureObserver implements Exporter {
  private readonly failures: DisposeFailure[] = []

  /**
   * @param service - the fixture app's logger service; one instance per app,
   * so captured errors cannot leak across fixtures.
   * @param rootFiber - the fixture's root fiber, used to label each failure's
   * reporting fiber.
   */
  constructor(
    private readonly service: LoggerService,
    private readonly rootFiber: Context['fiber'],
  ) {}

  /** Start collecting; call before the fixture's disposal begins. */
  install(): void {
    this.service.exporters.set(disposeObserverKey, this)
  }

  /**
   * Stop collecting and return what the disposal logged.
   * @returns captured failures in log order; empty when disposal was clean.
   */
  detach(): readonly DisposeFailure[] {
    this.service.exporters.delete(disposeObserverKey)
    return this.failures
  }

  export(message: Message): void {
    if (message.type !== 'error') return
    const fiber = message.fiber?.deref()
    this.failures.push({
      reason: message.args[0],
      source: fiber === this.rootFiber ? 'root fiber' : fiber === undefined ? 'unknown fiber' : 'child fiber',
    })
  }
}

/** One owned fixture runtime: its Context plus the root directory it created. */
export interface OwnedContextFixture {
  /** Runtime whose fiber dispose closes every mounted service, agent, and write handle. */
  readonly ctx: Context
  /** Directory this fixture created; deleted only after its Context settled. */
  root?: string
  /**
   * Observation cleanup runs between the Context's disposal and the root's
   * deletion. A rejection keeps the directory and fails cleanup, so a probe
   * here can veto the deletion of a directory whose resources never settled.
   */
  afterDispose?: () => Promise<void>
}

/**
 * Per-suite ledger of owned fixture runtimes. One instance lives at module
 * scope; afterEach awaits {@link OwnedTestContexts.cleanup} so every test that
 * created fixtures — including failing ones — returns its resources before the
 * next test starts.
 */
export class OwnedTestContexts {
  private readonly fixtures: OwnedContextFixture[] = []

  /**
   * Register a Context at the moment of creation.
   * @param ctx - freshly constructed fixture Context, before any setup await.
   * @returns the fixture record later completed with {@link OwnedTestContexts.ownRoot}.
   */
  own(ctx: Context): OwnedContextFixture {
    const fixture: OwnedContextFixture = { ctx }
    this.fixtures.push(fixture)
    return fixture
  }

  /**
   * Attach a freshly created temporary root to its owning fixture.
   * @param fixture - fixture record returned by {@link OwnedTestContexts.own}.
   * @param root - directory the fixture just created.
   * @returns the same root, for setup code that keeps using it.
   */
  ownRoot(fixture: OwnedContextFixture, root: string): string {
    fixture.root = root
    return root
  }

  /**
   * Registered, not-yet-cleaned fixtures in creation order.
   * @returns a detached copy for assertions; mutating it cannot affect cleanup.
   */
  snapshot(): readonly OwnedContextFixture[] {
    return [...this.fixtures]
  }

  /**
   * Dispose every registered Context to quiescence and delete each settled
   * fixture's root. Each fixture is handled independently: a disposal
   * rejection, a disposal failure the framework only logged (Cordis reports
   * disposer errors through the logger while `fiber.dispose()` resolves), or
   * an observation failure keeps that fixture's directory for diagnosis, the
   * remaining fixtures are still cleaned, and every failure is rethrown.
   * @returns settlement after all fixtures were handled; rejects with the
   * collected failures (an AggregateError when there is more than one).
   */
  async cleanup(): Promise<void> {
    const pending = this.fixtures.splice(0)
    const failures: unknown[] = []
    for (const fixture of pending) {
      const observer = new DisposeFailureObserver(fixture.ctx.logger, fixture.ctx.fiber)
      observer.install()
      let disposeFailed = false
      try {
        await fixture.ctx.fiber.dispose()
      } catch (error) {
        // Quiescence unproven: keep this fixture's directory and handle the rest.
        failures.push(error)
        disposeFailed = true
      }
      // Detach only after the disposal settled — the whole root/child fiber
      // unload — or failures logged after an early exit would be missed.
      const captured = observer.detach()
      if (captured.length > 0) {
        failures.push(new AggregateError(
          captured.map(record => record.reason),
          `dispose of owned fixture ${fixture.root ?? '(rootless)'} logged ${captured.length} error(s): ${captured.map(record => record.source).join(', ')}`,
        ))
      }
      if (disposeFailed || captured.length > 0) continue
      try {
        await fixture.afterDispose?.()
      } catch (error) {
        failures.push(error)
        continue
      }
      if (fixture.root === undefined) continue
      try {
        rmSync(fixture.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'owned test context cleanup failed')
  }
}

/** Independent single-writer probe over one storage root's real kernel locks. */
export interface WriteOwnershipProbe {
  /**
   * Open one session for single-writer write through an independent backend
   * over the original directory: rejects with `SessionAlreadyOwnedError` while
   * the fixture's runtime still holds the session's write ownership.
   * @param id - stored session to claim.
   * @returns the probe's owned write handle; the caller must close it.
   */
  claim(id: SessionId): Promise<SessionHandle>
  /** Dispose the probe's own backend Context. */
  dispose(): Promise<void>
}

/**
 * Mount an independent JSONL backend over an existing storage root so a test
 * can observe the root's real write ownership without touching the fixture's
 * own persistence instance or recreating any directory.
 * @param root - the fixture's existing storage root.
 * @returns the probe; dispose it after use.
 */
export async function mountWriteOwnershipProbe(root: string): Promise<WriteOwnershipProbe> {
  const ctx = new Context()
  await ctx.plugin(JsonlSessionPersistence, { root })
  const persistence: SessionPersistence = ctx.sessionPersistence
  return {
    claim: id => persistence.open(id, 'write'),
    dispose: () => ctx.fiber.dispose(),
  }
}
