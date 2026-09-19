# Agent Note: Task-private source build replaces the CVE-listed CI bubblewrap pin

Status: implemented

English | [中文](2026-09-19-private-bubblewrap-ci-build-r48.zh.md)

## Problem

`scripts/prepare-ci-bubblewrap.sh` installed the r47-restored pin `bubblewrap_0.9.0-1ubuntu0.1_amd64.deb`, which UBUNTU-CVE-2026-87766 still lists as affected and which upstream's 0.12.0 release fixes. Upgrading needs a build path that installs nothing system-wide: the five workflow call sites and the `ci-workflow.spec.ts` no-apt-get assertions must stay untouched, no runner package database may be modified, and the runner's own development libraries must never silently satisfy the build instead of the pinned ones.

## Decision

The script now builds `bwrap` 0.12.0 inside its own `RUNNER_TEMP` tree from three hash-pinned inputs, each verified against a publisher-recorded digest before anything is unpacked or executed: the official bubblewrap 0.12.0 release tarball (reused r47-S bytes), the official Meson 1.12.0 release source run as `meson.py` (no pip/apt/MSI; Meson enforces its Python >= 3.10 floor itself), and Ubuntu's `libcap-dev 1:2.66-5ubuntu2.4` deb handled strictly as data — control fields matched against the signed noble-updates/noble-security Packages indexes (both indexes list the identical file; InRelease signatures gpgv-verified in the r48 evidence), member listings audited, `dpkg-deb --extract` only, no maintainer scripts. The audit rejects absolute paths, `..` traversal, device members, and links resolving outside the extraction root, accepts spaces in names (the real Meson tarball ships `manual tests/`), and audits a final unterminated line. Because the package's own `libcap.pc` claims `libdir=/usr/lib64` while its payload installs under `usr/lib/x86_64-linux-gnu`, the script writes a private `libcap.pc` naming the audited absolute paths, restricts `PKG_CONFIG_LIBDIR` to it, removes the package's dangling `libcap.so`/`libpsx.so` dev symlinks so `-lcap` can only resolve to the audited `libcap.a`, and configures with `prefer_static`. Acceptance is evidence-based, not assumed: the verbose compile log must contain the link command referencing the private libcap directory; the produced ELF must be `elf64-x86-64`, report no dynamic libcap under `objdump -p` NEEDED and `ldd`, and print exactly `bubblewrap 0.12.0`; source, dependency, and artifact digests are recorded separately. `GITHUB_PATH` publication moved after the functional probe, so a failed probe publishes nothing. The sysctl policy, the platform gate, and every failure exit semantic from r47 are otherwise unchanged; there is no apt-get, no global `LD_LIBRARY_PATH`, no `--not-a-security-boundary`, and no setuid anywhere.

A rewritten direct regression (`scripts/prepare-ci-bubblewrap.spec.ts`, 36 tests) executes the real script under test-owned PATH stubs for every external effect — `uname`, `curl`, `sha256sum`, `tar`, `dpkg-deb`, `python3` (standing in for Meson and placing the stub `bwrap`), `cc`, `ninja`, `pkg-config`, `objdump`, `ldd`, `sudo`, and the built `bwrap`. It covers the full success ordering (35 recorded calls in sequence, hash records, single success line, publication content), the tolerated sysctl absence, per-input download and digest failures, all four unsafe-member classes, a missing build tool, deb control and payload mismatches, private pkg-config resolution failure, meson setup and compile failures, missing and host-fallback link evidence, wrong architecture, dynamic-libcap NEEDED and ldd detection, wrong version identity, fatal probe with zero publication, platform and environment refusals, and extraction failure. Two negative controls — the digest gate no-op'd and ` || true` appended to the probe — fail exactly their digest and probe tests and restore byte-identically before each green re-run (r48 evidence tree).

## Consequences

The five workflow call sites did not change: the script's only published surface is still a `GITHUB_PATH` directory entry, now the private build directory instead of an extracted deb's `usr/bin`. The real Linux compile, link, ELF checks, and sandbox probe remain owned by the original CI's first run of this candidate; on this Windows host they are NOT_RUN and replaced by the stubbed control-flow suite. Under the restricted pkg-config path Meson reports `libselinux` not found, so the SELinux feature auto-disables — matching Ubuntu's AppArmor runner platform and Ubuntu's own bwrap packaging, recorded rather than silently assumed for SELinux-enforcing hosts. The static-ABI fit of `libcap.a` is proven by the actual runner link, not locally. `sandbox.yml` still installs bubblewrap through its own master-only apt-get path and is an unmigrated separate entry: the repository-wide CVE status stays open until that entry is migrated and CI accepts this build. Evidence: [private-bubblewrap-build-r48](../../../../development/remediation/2026-09-19/private-bubblewrap-build-r48/inputs-verified.md).

## Alternatives considered

**apt-get build dependencies at the five call sites.** Rejected: package transactions against the runner's dpkg database, contrary to the no-apt invariant and the round's no-system-install route.

**Consuming the shipped `libcap.pc` through a sysroot.** Rejected: its `libdir=/usr/lib64` does not match the payload's install path, so the link would fall back to host lookup paths — exactly the silent fallback this change exists to prevent.

**A private dynamic libcap.** Rejected: it would require taking the `libcap2` runtime package too; the round scoped the private dependency route to static libcap with dynamic glibc.

**Keeping the r47 deb pin.** Rejected: acquisition was restored, but the version remains CVE-listed; the owner decided the pin is replaced forward, not re-validated.
