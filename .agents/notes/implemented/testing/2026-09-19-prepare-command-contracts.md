# Agent Note: Per-field deb control contracts and stub-source provenance in the CI prepare spec

Status: implemented

English | [中文](2026-09-19-prepare-command-contracts.zh.md)

## Problem

The CI bubblewrap prepare script (`scripts/prepare-ci-bubblewrap.sh`) verified the pinned libcap archive with `mapfile -t control < <(dpkg-deb --field "$libcap_archive" Package Version Architecture)`. Two defects were proven in CI run 35436610274. Multi-field `dpkg-deb --field` output arrives with field labels (`Package: libcap-dev`), so the bare-value array comparison exited 1 before compilation — the recorded first failure of the Linux prepare lanes. And process substitution swallows the subcommand's exit status, so a failing `dpkg-deb` whose stdout happened to look correct could not be detected. Separately, the Windows spec suite launched the script through a bare `bash` name with a child environment assembled from `{ ...process.env }` plus an appended `env.PATH`; on hosts where the parent stores the OS-canonical `Path` key this produces duplicate case-variant keys whose winner is chosen by the runner's msys runtime, and bare-name resolution can reach any of several installed bash binaries. The result was 27 of 36 Windows spec failures at the platform refusal, with no proof that the stubs — not host commands — had answered.

## Decision

The script now reads `Package`, `Version`, and `Architecture` through three independent single-field `dpkg-deb --field` calls, each with its exit status captured directly (`|| deb_*_status=$?`, no pipe, no process substitution). Nonzero exits, empty values, labeled output, embedded newlines or extra records, and wrong identities are each rejected with diagnostics carrying the field name, exit code, and captured stderr; accepted values must exactly match `libcap-dev`, `1:2.66-5ubuntu2.4`, `amd64`. No lenient multi-field parsing branch remains. The spec stub implements the real argv protocol — single-field requests return bare values, multi-field requests return labeled lines in control-file order regardless of request order — so fixtures freeze the observed CI bytes rather than an assumed shape.

The spec's scenario runner now launches a probe-verified absolute Git Bash with `--noprofile --norc` and constructs the child environment from a whitelist: on win32 a single `PATH` key in POSIX colon form with the stub bin first and Git `/usr/bin` appended (a directory census proved provides the coreutils the script and stubs still need while containing no curl, sudo, or compiler), with no parent content inherited; on POSIX the parent's exact `PATH` follows the explicit entries. A source-identity guard resolves `command -v uname` under the same environment before the script runs and refuses unless it equals the run's stub path, so a missing or non-executable stub is rejected before any real command can run. Each scenario carries a unique sentinel that every stub appends to a dedicated identity log, and the evidence fields record bash identity, resolution, spawn error, signal, and stream byte counts, which separately explain the empty-stdout early-exit branch (platform gate refusal) from launch failures. The Linux portability rework (real tools on the runner PATH, POSIX dual-path handling, pipeline log ordering) closed the four CI-only failures without weakening any Windows assertion.

## Alternatives considered

**Strip the labels and keep one multi-field call.** Still loses the per-command exit status and keeps the output-order dependency; the CI failure shape returns under any label variant.

**Widen the 30s timeouts to absorb Windows slowness.** The failures were provenance, not timing; the budget stayed and the measured worst case was 14.6s.

**Inherit the parent environment and prepend the stub bin.** This is the old assembly; duplicate `Path`/`PATH` keys make the winner runtime-dependent, which is precisely the class that explains CI's 27 failures.

**Trust `STUB_LOG` alone for provenance.** The log proves a stub ran, not that no host command answered first; the identity guard checks resolution before the script starts.

## Consequences

The prepare spec grew from 36 to 64 tests (48 after W01's protocol round, 60+1 after W02's provenance round, 64+1 after the Linux portability rework) with the original assertions byte-unchanged. Negative controls replay real mutants: restoring the old multi-field bare-value script fails all 12 protocol cases; swallowing field-command exits fails exactly the exit-propagation case; restoring the old environment assembly fails the duplicate-key and whitelist cases; removing the identity guard with host tools first reproduces the CI 27-failure signature. CI runs 35447649954 and 35450138445 show both Linux prepare pipelines fully passing — download, hash, audit, per-field control contract on the real pinned deb, Meson, compile, absolute private `libcap.a` link, ELF checks, version 0.12.0, probe, and PATH publication — and the static and observational gates green on both platforms. The upstream security test suite remains disabled by `-Dtests=false`; the ordinary `true` probe does not substitute for it. Evidence: [W01 FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W01/FINDINGS.md), [W02 FINDINGS](../../../../development/delivery-runs/B01/B01-20260919-01/W02/FINDINGS.md).
