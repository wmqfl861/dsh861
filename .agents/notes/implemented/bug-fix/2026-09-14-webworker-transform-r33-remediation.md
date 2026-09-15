# Agent Note: Worker transform duplication and two lowering semantic defects

Status: implemented

English | [中文](2026-09-14-webworker-transform-r33-remediation.zh.md)

## Problem

The r33 review of the r32 transform (`packages/experimental/webworker-runtime/src/compile/transform.ts`, blob `48d4d6ec` at `acca50b6`) named three defects, each verified against a recorded first failure:

1. `pnpm run duplication` failed on one clone: the lexical-declaration collection loop (`let`/`const`/`class`/`function` names) was duplicated between `blockScopeNames` (lines 826–833) and `switchScopeNames` (lines 841–848).
2. Receiver regression: the named-import read is a member expression (`held["name"]`), so an imported identifier in a direct-call, optional-call, or tagged-template callee/tag position lowered to a method call that binds the held module as `this` inside the imported function. Native ESM calls an imported function receiver-free; the first failure shows the lowered call returning the held module instead of `undefined`.
3. Scope regression: `SwitchStatement` pushed the shared case scope before traversing the discriminant, so a case-body declaration shadowed an import at the discriminant. `switch (selected) { case 1: const selected = 2; … }` lowered with a bare `selected` discriminant and threw `selected is not defined` at run time.

## Decision

The duplicated loop is extracted into `collectLexicalNames(statement, into)`; `blockScopeNames` and `switchScopeNames` both call it, and the var/function-scope split and the single shared switch scope are unchanged. The identifier rewrite now recognizes a named import in callee (direct or optional call) or tag (tagged template) position and emits `(0,held["name"])` there, so the call runs receiver-free; `new` callees, value reads, namespace member calls, and the parenthesized default accessor are untouched. The switch visit evaluates the discriminant in the enclosing scope before the case scope is pushed, then visits the cases (tests included) under it; the discriminant is visited exactly once. Because emitted code changed, `LOWERING_VERSION` is bumped to `dsh-worker-transform/3` (the image contract refuses images lowered by an older transform), the package README pair states the receiver and discriminant rules, and 15 new spec cases pin the behavior: three negative receiver cases (direct call, optional call, tagged template), the switch discriminant case, fall-through shadowing, and the namespace/alias/identity/object-method/value-read controls. The project count goes 300 to 330.

## Alternatives considered

**Return to an eager import snapshot or a per-import bound function.** Both would restore receiver-free calls, but the eager read is the r32 cyclic-module temporal-dead-zone defect and a cached `bind` product is a different function identity per module; the comma expression keeps every read a fresh member read.

**Rewrite every emitted member call receiver-free.** A genuine `object.method()` — including a namespace member call — must keep its object as `this`; only imported callees and tags get the comma expression.

**Evaluate the switch discriminant into a temporary or visit it twice.** The language evaluates the discriminant once, in the enclosing scope; visiting it once before the case scope is pushed states that directly.

## Consequences

`pnpm run duplication` passes with zero clones and `.jscpd.json` untouched. The transform and packer suites pass 356/356 (330 transform, 26 packer across both Vitest projects); typecheck, lint, and the documentation gates pass; `apps/web` `build:preview` repacks the image with contract `dsh-worker-transform/3` and the browser `preview-boot.e2e.ts` passes 1/1 against it. Regression evidence and the first-failure logs: `development/remediation/2026-09-14/web-transform-r33/`.
