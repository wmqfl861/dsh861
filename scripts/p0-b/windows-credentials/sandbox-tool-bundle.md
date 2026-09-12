# Preparing a pinned sandbox tool bundle

English | [中文](sandbox-tool-bundle.zh.md)

[prepare-sandbox-tool-bundle.mjs](prepare-sandbox-tool-bundle.mjs) verifies three local files against the [reviewed 0.149.1 manifest](sandbox-tool-bundle.0.149.1.json) and copies them into a fresh directory. It does not download, install, execute or activate any program. The result is a three-file sandbox diagnostic candidate, not a complete Codex distribution or a working sandbox.

## Inputs and integrity

The manifest fixes the main repository-pinned executable and the raw x64 setup and runner assets from the same official release. Published asset digests are not archive digests. The release API is the source of helper sizes and hashes; matching them is not an Authenticode or Sigstore verification. Missing files, incorrect lengths, changed bytes and directory or link inputs are refused before destination allocation. Hashes are checked again while copying and during complete output verification.

Sources and the existing staging parent must remain protected from hostile replacement. The preparer performs bounded chunk reads and never starts a source file. It creates independent copies under a random allocation, with native adjacent names, no hard links, no global configuration and no automatic PATH fallback. It refuses staging inside node_modules or Codex's named home/sandbox directories. Modes and identity checks are not a Windows ACL or adversarial filesystem guarantee.

The returned `verify()` checks all three files and the exact manifest, including extra entries. `dispose()` removes only known owned entries, joins concurrent calls and refuses replacement roots or unknown files; internal links are unlinked without traversal. Failed cleanup stays failed. Do not dispose a bundle after handing its files to an active consumer; this tool neither starts nor stops such consumers.

## Local preparation

After acquiring the two exact public release assets without credentials, invoke the CLI with explicit absolute local paths. It always loads the adjacent checked-in manifest; there is no command-line manifest override. Reuse the repository-pinned main executable rather than copying a global or older runner. Read only the paths given below; placeholders must be replaced with actual paths.

```powershell
node scripts/p0-b/windows-credentials/prepare-sandbox-tool-bundle.mjs --parent '<existing-staging-parent>' --codex '<pinned-codex.exe>' --setup '<downloaded-setup.exe>' --runner '<downloaded-runner.exe>'
```

Successful output names the newly created directory and reports `SANDBOX_TOOL_BUNDLE_PREPARED_NOT_ACTIVATED`. Its execution, system-change, runtime-compatibility and product-acceptance flags remain false. Refusal exits with code 2 and a fixed message; it never repairs a missing input by downloading or running setup. Executable files and download caches stay outside Git; only sanitized verification records are committed.

## Coexistence and remaining authorization

A different CODEX_HOME does not give the pinned setup new account names or independent Firewall/WFP identifiers. Existing sandbox accounts, saved credentials, profiles and rules may be shared by the global Codex installation. Do not reset passwords, copy old secrets or remove these resources as part of bundle preparation. A password reset would make saved account passwords stale; this does not establish that the owner's DPAPI key has become undecryptable. Being able to identify a shared object is not permission or a complete recipe to roll it back.

The reviewed [machine inventory](../../../development/nodes/P0-B/windows-elevated-inventory.r01.json) remains a historical observation, not installation authorization. Any activation needs a separate exact coexistence/deployment decision; bundle readiness does not satisfy OS isolation, owner enrollment, real CLI TLS, monetary enforcement or the designated planning/review requirements. See [the decision note](../../../.agents/notes/implemented/architecture/2026-09-12-pinned-sandbox-tool-preparation.md).
