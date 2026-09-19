# r44 ownership-map attribution corrections (from formal plan v1 section 3.3)

The first executor's `source-evidence-ownership-map.md` stays unmodified as round input, and r43 historical diagnostics stay untouched. The formal Codex plan (plan.v1.md section 3.3) corrected two of the map's inferences; recorded here per the plan's instruction so successors do not carry the stale inferences forward.

## Correction 1: the activationOwner structural disposer is no longer an independent sibling

`vendor/cordis/src/fiber.ts` `runner.collect` adds the collected exact disposer into the combined generator effect and at the same time removes it from the fiber's disposable list (`this._disposables.delete(dispose)`). Because `ContinuableActivationRegistry` creates the `activationOwner` scope and then yields `scope.dispose` on the same ctx, that scope's structural disposer already lives inside the combined effect, not as an independent sibling effect. The map's item C3 sibling framing is corrected on this point.

The real gaps the plan keeps are: (a) the reverse `.then()` chain inside one effect skips later disposers when an earlier one rejects; (b) `continuationBinding` is still an independent effect; (c) the agent-loop factory provider still has an independent close path; (d) `AgentLoop.prepare()` collecting the Agent scope `rawDispose` can cross fibers, because the caller owner fiber and the actual scope parent fiber may differ, and cross-fiber collection does not remove the other fiber's registration.

## Correction 2: `SessionProjectionRegistry.register()` returns a wrapper, not the exact disposer

The returned function is a `() => void dispose()` wrapper, not the inner registration effect's exact disposer. Yielding that wrapper into a generator therefore does not move the registration off the sibling list and cannot prove ownership transfer. The Team fix must be verified as an actual child-fiber ownership transfer (plan section 7.1), not as wrapper-yielding.

## Unchanged attribution rule

`composeError` splices registration-time outer stacks into async rejections. `_reload`, `_execute`, constructor, and fixture-setup frames below an async error's own frames are not evidence that a reload or plugin load was executing at dispose time. Ordering claims require real fiber events, disposer entry/completion, and Promise/deferred handshakes, as required by task comment section C.
