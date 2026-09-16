/**
 * Test-only ownership ledger for fixture Contexts and the temporary roots they
 * create, shared by the tool-subagent-control and tool-agent-team suites and
 * their ownership regression. A fixture registers its Context at creation —
 * before the first setup await that can fail — and its root directory the
 * moment that directory exists, so afterEach unwinds even a setup that threw
 * midway or a test whose assertions failed early.
 * @module owned-contexts
 */

import { rmSync } from 'node:fs'
import { Context } from '@deepseek-ai/cordis'
import type { SessionHandle, SessionPersistence } from '@deepseek-ai/dsh-session-persistence'
import type { SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'

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
   * fixture's root. Each fixture is handled independently: a disposal or
   * observation failure keeps that fixture's directory for diagnosis, the
   * remaining fixtures are still cleaned, and every failure is rethrown.
   * @returns settlement after all fixtures were handled; rejects with the
   * collected failures (an AggregateError when there is more than one).
   */
  async cleanup(): Promise<void> {
    const pending = this.fixtures.splice(0)
    const failures: unknown[] = []
    for (const fixture of pending) {
      try {
        await fixture.ctx.fiber.dispose()
        await fixture.afterDispose?.()
      } catch (error) {
        // Quiescence unproven: keep this fixture's directory and handle the rest.
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
