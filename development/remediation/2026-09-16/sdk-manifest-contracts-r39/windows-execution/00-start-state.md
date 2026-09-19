# r39 start-state verification (2026-09-16)

Branch: chore/latest-stable-upgrade-20260912
Local HEAD:  9bd5c20ff49568a9fb7da80861f7d03220f620d8
Remote HEAD: 9bd5c20ff49568a9fb7da80861f7d03220f620d8 (git ls-remote origin refs/heads/chore/latest-stable-upgrade-20260912)
Working tree: clean (git status --porcelain empty); no fetch repeated.
PR #13 remains draft; base feat/multi-agent-company-nodes unchanged.

## Git blobs at HEAD (task A section expected vs observed)

All match. Allowed-modification files keep their task-listed starting blobs:

9bb358b7c98e30d93f072b41cf8ea91453aaa7b4 packages/subagent/subagent-claude-code/package.json
279c844e0b381c100b48c088bbbf097916df6b59 packages/subagent/subagent-claude-code/tests/real-product.spec.ts
781a13a58750c0a8aa4060eaef7cabdfb86e58ac packages/subagent/subagent-claude-code/tests/subagent-claude-code.spec.ts
d42ac977fd359fb775f0c85bbc418c5bd3bc0a55 packages/test-support/session-snapshot/src/manifest.ts
974d07e7e8fb88bd554b0b5e803722907f4bf846 packages/test-support/session-snapshot/tests/manifest.spec.ts
0ccbeee70bc0477b81ae1f669f5e52d6c57d7bf0 pnpm-lock.yaml
ffbaf61ef5408c25adf6b4f460f500a2d8764b30 scripts/run-gates.spec.ts
664e1a0ef88f86b524dee39f684cd34e3cbba4a6 scripts/run-gates.ts

## Installed identity evidence (read this session, not inferred)

- @anthropic-ai/claude-agent-sdk package.json (resolved via import.meta.resolve from packages/subagent/subagent-claude-code):
  version 0.3.269; claudeCodeVersion 2.1.269; optionalDependencies: all 8 platform packages at 0.3.269
  (darwin-arm64, darwin-x64, linux-arm64, linux-arm64-musl, linux-x64, linux-x64-musl, win32-arm64, win32-x64).
  SDK root: C:/Albert/project/dsh861/node_modules/.pnpm/@anthropic-ai+claude-agent-_036306a0898f005a49cafb4ef985a911/node_modules/@anthropic-ai/claude-agent-sdk
- Platform package on this host: @anthropic-ai/claude-agent-sdk-win32-x64 package.json version 0.3.269; claude.exe present in the same directory.
- claude.exe --version (run with test-isolated HOME/CLAUDE_CONFIG_DIR/XDG_CONFIG_HOME, fake key, telemetry disabled):
  stdout: "2.1.269 (Claude Code)"; exit code 0.
- Provider package.json dependencies: @anthropic-ai/claude-agent-sdk 0.3.269; @modelcontextprotocol/sdk ^1.30.0; zod ^4.6.2;
  no @deepseek-ai/dsh-subagent-codex in dependencies.
- pnpm-lock.yaml contains @anthropic-ai/claude-agent-sdk-<platform>@0.3.269 package entries and the SDK optionalDependencies mapping rows for every platform package.
- js-yaml installed version: 5.4.2 (packages/test-support/session-snapshot).
  yaml.load('', {schema: JSON_SCHEMA}) THROWS YAMLException: expected a document, but the input is empty.
  yaml.load('null
') => null; yaml.load('42
') => 42; yaml.load('- item
') => ["item"].
  Real parseSnapshotManifest wrapped messages:
  - ''  => "session-snapshot: case/snapshot.yml: invalid YAML: YAMLException: expected a document, but the input is empty"
  - 'null
' / '42
' / '- item
' => "session-snapshot: case/snapshot.yml: manifest must be a mapping"

## Isolation conditions re-verified before real-product run

- tests/messages-fixture.ts: server.listen(0, '127.0.0.1') - loopback only, random port; fixture 404s non-Messages paths.
- real-product.spec.ts realInstanceFixture: mkdtemp temp root with test-private workspace/claude-config/xdg directories;
  ANTHROPIC_API_KEY=dsh-fake-anthropic-key; ANTHROPIC_BASE_URL=loopback fixture; CLAUDE_CONFIG_DIR/HOME/XDG_CONFIG_HOME test-private;
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1; DISABLE_TELEMETRY=1; DISABLE_ERROR_REPORTING=1; proxies cleared; NO_PROXY=127.0.0.1,localhost.
  No user credentials, real keys, or external model endpoints involved.
