# Agent Note: Reject late-close re-parsing by counting the parser's split entry

Status: implemented

English | [中文](2026-09-16-late-close-parse-count-regression-r38.zh.md)

## Problem

The r37 descendant-walk fix (see [the traversal note](../bug-fix/2026-09-15-gate-descendants-traversal-r37.md)) put a settled check at the top of `wireDescendantEnumeration`'s close handler, but the late-close regressions in [run-gates.spec.ts](../../../../scripts/run-gates.spec.ts) pinned only resolved values and kill counts. Those assertions hold with and without the guard: a late close that re-parses and re-walks the captured table produces the same empty settle and the same single kill, because the walk terminates and `finish`'s internal guard discards the repeated value. r37's eager-close negative control measured the discarded work (a 2000000-row table re-walked for 2631 ms inside a late close), which proves the re-walk executes but is a performance probe, not a suite regression. Two spec comments also claimed a cyclic table makes the un-guarded late close never terminate; the guarded breadth-first walk terminates on cyclic tables, so those comments described behavior the shipped code does not have.

## Decision

The wiring regressions now count the real parser's entry calls. A helper spies `String.prototype.split` while keeping the original implementation; only the synchronous fake-close dispatch is inside the spy scope — no awaits, no assertions, no other work — and the parser enters through `output.split('\n')` in `parsePidPpidLines`, so the count is exactly the number of parse passes. `mockRestore` clears the call history, so the count is copied before it, restoration runs in `finally` so a throwing close still restores, and a post-restore descriptor equality check proves the original function and its attributes are back on the prototype (functions compare by reference inside descriptor equality). Six notification orders are pinned with the result and kill assertions kept: a single normal close and a repeated normal close each parse exactly once — the single-close case is the positive control, since an observer that always counts zero fails it and the resolved descendants prove the real parser and walker ran — and a close delivered once or twice after cancel, or once or twice after error, parses zero times. The stale cyclic-table comments now state that the guarded walk terminates on cycles and name these count regressions as the proof that a late close does not re-parse; the cyclic late-close child case stays for its cycle shape and runaway isolation.

## Alternatives considered

**Outcome-only assertions.** They pass on both versions of the close handler; the mutation acceptance below shows the removal of the guard alone leaves them green while the count assertions fail five of six cases.

**A large-table performance probe with a wall-clock threshold.** Load-sensitive on CI runners and forbidden as a regular-suite probe by the r38 instructions; the parse count is deterministic and needs no timing budget and no widened timeouts.

**Spying the module's exported parse function.** `wireDescendantEnumeration` calls the parser through an internal reference, so an export spy would observe zero calls — exactly the always-zero observer the normal-close positive control exists to reject. Spying the prototype method intercepts the internal call because the lookup happens through `String.prototype` at call time.

**Mocking the walker or copying the algorithm into the test.** The observation must exercise the repository implementation; a copy or a mock observes itself.

**Checking the source text for the guard.** A static string match proves nothing about the executed close path.

## Consequences

The focused `-t "asynchronous enumeration"` filter now executes 11 tests in the wiring scopes (5 pre-existing, 6 new). On the shipped code the focused run passes 11 and both affected suites pass 136 with 6 pre-existing Windows skips (142 total). Mutation acceptance: with only the close handler's settled guard removed (safe walk and `finish`'s internal guard intact), the focused run exits 1 with five count-assertion failures (`expected 2 to be 1`, `expected 1 to be +0`, `expected 2 to be +0`, twice more after error) while every result and kill assertion still passes; the single-normal-close case passes under the mutation because both versions parse exactly once there. The mutated runner was restored from saved bytes in a `finally`, re-verified byte-exact against git blob `664e1a0ef88f86b524dee39f684cd34e3cbba4a6`, and the positive focused run repeated green. Typecheck, lint, duplication, and the quick documentation gates pass on the final bytes; the first typecheck failure (split's `Symbol.split` overload makes the separator comparison a no-overlap error without widening to `unknown[]`) and the first lint failure (unbound-method on the detached prototype method, repaired by relying on descriptor equality) are preserved in the evidence logs. The spy mutates a process-global prototype only inside one synchronous dispatch within one forked worker, and the both-suites rerun confirms no cross-file interference. `scripts/run-gates.ts` keeps its exact r37 bytes; sampling, cancellation, cleanup, and scheduling are untouched. Evidence and the review that requested this: [windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/late-close-regression-r38/windows-execution/FINDINGS.md) and [PR #13 review comment 5690291312](https://github.com/wmqfl861/dsh861/pull/13#issuecomment-5690291312).
