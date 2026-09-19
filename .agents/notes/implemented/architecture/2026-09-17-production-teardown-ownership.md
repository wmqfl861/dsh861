# Agent Note: Production teardown waits for every owned obligation

Status: implemented

English | [中文](2026-09-17-production-teardown-ownership.zh.md)

## Problem

Two production teardown paths ended a session while owned work was still running. The control path cleared the inbox projection before the driver finished, and the Team path sampled the roster after the projection was gone. Under Cordis reverse-order unload, effect composition could also clear a registry slot before that slot's real drain had settled, so a concurrent close observed a manager-less no-op instead of joining the running cleanup. Timeouts were read as completion.

## Decision

Every layer waits for what it owns, and each wait observes the real settlement rather than a deadline. `AgentTeardownHooks` hands the factory a synchronous completion handle per agent; the factory closes admission first, starts every tracked obligation, and reports all original failures only after they settle. An activation's close record exists before create or resume; the shared preparation `P(x)` never awaits its own handle or a wrapper waiting on it. Slot ownership clears by exact identity only after the owned child fiber's complete lifetime — drain, structural release, and error observation — has settled. The Team runtime keeps real holds on admitted work, joins the same close transaction from every entry, and treats a timeout as an error observation, never as quiescence.

## Alternatives considered

Sequential cancellation without published completions reintroduced the self-wait cycle the shared handle removes. Clearing slots on first entry made concurrent drains join nothing, which the round's first hard review measured as a real order inversion. Promising stricter ordering than the vendored fiber delivers would have hidden the gap the ownership collection actually closes.

## Consequences

Cancellation now propagates even when the inbox clear fails, and original errors survive through aggregate causes. The last legal read of a projection is the close that owns it; later readers see refusal, not absence. Keyless evidence now includes the close-triggering path itself: [teardown snapshot scenarios](../../../../snapshots/sdk/) hold the real close at a gate, verify the write-ownership locks, and take over the original directory after protocol shutdown, and the Python smoke replays the same chain against the built CLI. r43's observer remains the cross-check for cleanup failures; this note records the shipped ordering, not that history.
