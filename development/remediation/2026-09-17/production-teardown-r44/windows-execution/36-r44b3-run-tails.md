===== teardown-spec-attempt14.log (tail) =====
stdout | snapshots/sdk/teardown.snapshot.ts > production-teardown close evidence over dsh --profile sdk > holds, releases, and observes the real close for agent-team-teardown
teardown-snapshot agent-team-teardown: child ee3fa6e6-3316-42a1-9724-91bf167e59bf pre-seq 24 -> post-seq 28, root pre-seq 35 -> suffix 8 events, takeover claims 2, notifications 1
 ✓ snapshots/sdk/teardown.snapshot.ts (2 tests) 6562ms
   ✓ production-teardown close evidence over dsh --profile sdk (2)
     ✓ holds, releases, and observes the real close for subagent-teardown 3468ms
     ✓ holds, releases, and observes the real close for agent-team-teardown 3092ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  21:36:46
   Duration  8.33s (tests 81%, transform 14%, import 5%)
exit=0
===== teardown-spec-lib-mode.log (tail) =====
stdout | snapshots/sdk/teardown.snapshot.ts > production-teardown close evidence over dsh --profile sdk > holds, releases, and observes the real close for agent-team-teardown
teardown-snapshot agent-team-teardown: child da9a4e96-ec58-4800-9c69-db094092849d pre-seq 24 -> post-seq 28, root pre-seq 35 -> suffix 8 events, takeover claims 2, notifications 1
 ✓ snapshots/sdk/teardown.snapshot.ts (2 tests) 9868ms
   ✓ production-teardown close evidence over dsh --profile sdk (2)
     ✓ holds, releases, and observes the real close for subagent-teardown 5215ms
     ✓ holds, releases, and observes the real close for agent-team-teardown 4650ms
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  22:18:18
   Duration  12.93s (tests 78%, transform 14%, import 7%)
exit=0
===== corpus-gate-run2.log (tail) =====
The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option. You can remove the plugin and set resolve.tsconfigPaths: true in your Vite config instead.
Both esbuild and oxc options were set. oxc options will be used and esbuild options will be ignored. The following esbuild options were set: `{ jsx: 'automatic' }`
 RUN  v5.0.0 C:/Albert/project/dsh861
 ✓ scripts/session-snapshot-corpus.corpus.ts (3 tests) 663ms
   ✓ keeps every recorded session owned, pinned, redacted, and header-scrubbed 404ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  21:41:36
   Duration  2.15s (transform 47%, tests 34%, import 17%, setup 2%)
exit=0
===== test-docs-run2.log (tail) =====
run-gates: start translation prompt
run-gates: PASS translation prompt (0.99s)
run-gates: start doc budgets
run-gates: PASS doc budgets (0.71s)
run-gates: start documentation standard tests
run-gates: PASS translation pairing (48.19s)
run-gates: start package README limitations
run-gates: PASS markdown links (48.24s)
run-gates: PASS package README model experience (14.93s)
run-gates: PASS documentation standard tests (6.69s)
run-gates: PASS package README limitations (12.04s)
run-gates: 16 passed, 0 failed, 0 skipped in 60.25s.
exit=0
===== gate-summary-final.txt (tail) =====
build exit=0
typecheck exit=0
lint exit=0
duplication exit=0
doc-sync exit=1
===== base40-final.log (tail) =====
     ✓ installs the complete scoped schema and shared-checkout policy for roots and teammates 357ms
     ✓ returns actionable no-progress output and renders structured wait cancellation 447ms
     ✓ adapts roster, mailbox, wait, and task CAS operations to canonical JSON 369ms
 Test Files  3 passed (3)
      Tests  40 passed (40)
   Start at  22:57:10
   Duration  6.46s (transform 48%, tests 39%, import 11%, setup 1%)
  Transform   thread-safe  transforming modules took 7.31s · 48% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
exit=0
===== owner-local-final.log (tail) =====
 ✓  thread-safe  packages/core/agent-loop/tests/teardown-ownership.spec.ts (11 tests) 500ms
 ✓  thread-safe  packages/experimental/agent-team/tests/teardown.spec.ts (8 tests) 1275ms
 ✓  thread-safe  packages/subagent/subagent/tests/continuation-teardown.spec.ts (14 tests) 2074ms
 Test Files  3 passed (3)
      Tests  33 passed (33)
   Start at  22:57:21
   Duration  5.12s (transform 52%, tests 34%, import 12%, setup 2%)
  Transform   thread-safe  transforming modules took 5.83s · 52% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
exit=0
===== py-B01-final2.log (tail) =====
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\socketserver.py", line 360, in finish_request
    self.RequestHandlerClass(request, client_address, self)
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\socketserver.py", line 747, in __init__
    self.handle()
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\http\server.py", line 437, in handle
    self.handle_one_request()
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\http\server.py", line 405, in handle_one_request
    self.raw_requestline = self.rfile.readline(65537)
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\socket.py", line 717, in readinto
    return self._sock.recv_into(b)
ConnectionResetError: [WinError 10054] 远程主机强迫关闭了一个现有的连接。
----------------------------------------
smoke-python-runtime: sdk-teardown passed
exit=0
===== py-B01-space-path.log (tail) =====
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\socketserver.py", line 360, in finish_request
    self.RequestHandlerClass(request, client_address, self)
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\socketserver.py", line 747, in __init__
    self.handle()
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\http\server.py", line 437, in handle
    self.handle_one_request()
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\http\server.py", line 405, in handle_one_request
    self.raw_requestline = self.rfile.readline(65537)
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\socket.py", line 717, in readinto
    return self._sock.recv_into(b)
ConnectionResetError: [WinError 10054] 远程主机强迫关闭了一个现有的连接。
----------------------------------------
smoke-python-runtime: sdk-teardown passed
exit=0
===== py-B02-update.log (tail) =====
    self.RequestHandlerClass(request, client_address, self)
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\socketserver.py", line 747, in __init__
    self.handle()
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\http\server.py", line 437, in handle
    self.handle_one_request()
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\http\server.py", line 405, in handle_one_request
    self.raw_requestline = self.rfile.readline(65537)
  File "C:\Users\Joyce Gu\AppData\Roaming\uv\python\cpython-3.10.21-windows-x86_64-none\lib\socket.py", line 717, in readinto
    return self._sock.recv_into(b)
ConnectionResetError: [WinError 10054] 远程主机强迫关闭了一个现有的连接。
----------------------------------------
smoke-python-runtime: updated snapshots in C:\Albert\project\dsh861\scripts\snapshots\python-sdk-single-exe\production-teardown
smoke-python-runtime: sdk-teardown passed
exit=0
===== gate-doc-sync-final3.log (tail) =====
run-gates: start doc budgets
run-gates: PASS translation prompt (0.60s)
run-gates: start documentation standard tests
run-gates: PASS doc budgets (0.60s)
run-gates: start documentation site checks
run-gates: PASS archived agent notes (2.02s)
run-gates: start package README limitations
run-gates: PASS documentation standard tests (5.41s)
run-gates: PASS package README model experience (10.34s)
run-gates: PASS package README limitations (9.97s)
run-gates: PASS documentation site checks (13.35s)
run-gates: 34 passed, 0 failed, 0 skipped in 174.56s.
exit=0
===== py-reject2 (9 rejection cases) =====
-- B03.log: exit line: smoke-python-runtime.py: error: --scenario sdk-teardown requires --dsh-bin pointing at this candidate's built CLI entry
-- B04.log: exit line: smoke-python-runtime.py: error: --exe and --dsh-bin select different runtime launch modes; provide at most one
-- B05.log: exit line: smoke-python-runtime.py: error: --installed-wheel resolves the wheel's own runtime and cannot be combined with --dsh-bin
-- B06a.log: exit line: smoke-python-runtime.py: error: --dsh-bin only serves --scenario sdk-teardown; this run mode never joins other scenarios
-- B06b.log: exit line: smoke-python-runtime.py: error: --dsh-bin only serves --scenario sdk-teardown; this run mode never joins other scenarios
-- B07a.log: exit line: smoke-python-runtime.py: error: --dsh-bin is not a file: C:\no\such\bin.js
-- B07b.log: exit line: smoke-python-runtime.py: error: --dsh-bin is not a file: C:\Albert\project\dsh861
-- B07c.log: exit line: smoke-python-runtime.py: error: --dsh-bin must be this candidate's built CLI entry C:\Albert\project\dsh861\apps\cli\lib\bin.js, got C:\Albert\project\dsh861\apps\cli\src\bin.ts
-- B07d.log: exit line: smoke-python-runtime.py: error: --dsh-bin is not a file: C:\Albert\project\dsh861\node C:\Albert\project\dsh861\apps\cli\lib\bin.js
