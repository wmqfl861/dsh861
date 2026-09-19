# Agent Note: Web consumer failures after the dependency-major upgrade

Status: implemented

English | [中文](2026-09-14-web-consumers-r32-upgrade-remediation.zh.md)

## Problem

The dependency-major upgrade (Lexical 0.50, zod 4.6.2, jsdom 30, js-yaml 5, React 19) left six Web browser-consumer test files failing. Four distinct root causes, each verified against a recorded first failure:

1. `built-boot.expected.e2e.ts` — jsdom 30 no longer matches camelCase attribute-value selectors (`svg[viewBox="…"]`) on foreign-namespace elements, so the brand-artwork lookup missed.
2. `agent-preset-authoring` golden — js-yaml 5.4.2 words the damaged-YAML diagnostic "deficient indentation (3:1)" where 4.3.1 said "unexpected end of the stream within a flow collection (3:1)". One golden line changed; the Windows-only `{{presetRoot}}\my-agent` separator difference stays un-normalized (CI compares on Linux).
3. `lifecycle-chrome.e2e.ts` IME cases — two interacting defects in the composer. (a) `claim-decor.ts` split the styled token with `splitText`, which copies the style to every part; the overflow half kept `TOKEN_STYLE`, Lexical's text normalization merged the equally-styled halves back, the transform re-split, and the cycle ended in Lexical error #14 — the loop upstream discussion #6052 reported for typing after a claim under IME. (b) Lexical 0.50 re-renders a composed TextNode's DOM only when the committed model text differs from the DOM text minus the composition padding; a Chromium insertText commit whose stripped text already equals the model leaves the U+200B padding in the DOM, where it silently swallows the next Backspace.
4. `preview-boot.e2e.ts` — three layers. The static-host `respond()` ran URL paths through `path.normalize`, which on win32 turns `/` into `\` so every generated override (image, fixtures, manifest) 404'd. Past that, zod 4.6.2 serves ESM dist through the `import` condition; the worker transform lowered named imports to eager top-level `const local = held[name]` reads, and zod's core/util cycle threw "Cannot access 'globalConfig' before initialization" through every loader entry. Past that, the default-import interop accessor was a bare call expression, so `new X()` lowered to a form that constructed the helper's result ("__dsh$default is not a constructor", preset "standard" failed to mount).

`queue-actions.e2e.ts` (CI-only "Minified React error #185") and `sidebar-scrollbar.e2e.ts` (CI-only transparent thumb/hover) never reproduced locally: four green queue-actions runs including the CI-parallel composition, and 7/7 sidebar-scrollbar. queue-actions' second case types text after a claimed `/goal`, the exact input that drives the claim-transform loop, whose per-flush draft updates are React `setState` calls — a slow CI machine trips React's nested-update limit before Lexical's 100-round transform guard. sidebar-scrollbar's thumb token resolves transparent while the column is quiet, and two cases inherited the `beforeAll` parked pointer, which the linger can expire between cases on a loaded runner.

## Decision

Each defect is fixed at its owner with its behavior pinned: the brand lookup reads the exact `viewBox` through `getAttribute` over all `svg` elements; the golden carries the new diagnostic wording; `claim-decor.ts` clears `TOKEN_STYLE` on the overflow half after `splitText` (the halves then differ and normalization cannot merge them); the composer's compositionend handler rewrites DOM text that is exactly the model text plus one padding character (U+200B or U+00A0), guarded by model equality so engines whose compositionend precedes the committed input are untouched; `respond()` looks overrides up by the raw forward-slash URL path and contains the disk path under `dist/`; the worker transform keeps named and default import bindings live by rewriting use sites to read through the required module's exports — with shadow tracking (function `var` hoisting, block/loop/catch/switch scopes), shorthand-property expansion, ESM-hoisted prologue requires, and a parenthesized default accessor — recorded as `dsh-worker-transform/2`; the two sidebar cases establish their revealed thumb from real pointer movement inside the case. No assertion was deleted, no error filtered, no timeout merely extended.

## Alternatives considered

**Fix the IME cases in the test driver by tolerating the padding.** The stale padding is product-visible state (a dead first Backspace after every IME commit), not a test misread; a suffix-tolerant comparator could not distinguish a DOM pad from a model leak.

**Strip the composition padding by rewriting the DOM directly.** Lexical owns that text node; forcing a reconcile through `markDirty` under the model-equality guard is the seam Lexical provides.

**Make namespace imports live too.** Nothing in the shipped graph reaches a cycle through one; an identity-stable lazy namespace is not expressible in the CommonJS body. It stays an eager snapshot, stated in the module doc and the README.

**Add path-separator normalization to the preset golden.** CI compares on Linux and passes; a normalizer would certify the Windows separator instead of the golden content.

## Consequences

The six-file composition passes 32/33 locally (five files fully green; the remaining diff is the recorded Windows separator pseudo-difference). Regressions: two headless claim cases (ASCII and CJK incremental typing assert token styled, overflow plain, no #14), 15 new transform cases (cycle evaluation, shadowing, shorthand, hoisted references, re-export accessors, constructor precedence; the project count goes 270 to 300), the prior transform cases and the packer's image-loadable suite stay green, and every IME case keeps its Chinese input, backspace, placeholder, and claim assertions. The composer change adds one TreeWalker pass per compositionend over the editor's text nodes. queue-actions' #185 attribution and sidebar-scrollbar's CI behavior remain confirmations CI owes; both files now pass the local CI-shaped parallel composition. Evidence and first-failure logs: `development/remediation/2026-09-14/web-consumers-r32/`.
