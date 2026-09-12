# Agent model configuration reference

English | [中文](README.zh.md)

[models.v1.json](models.v1.json) is the owner's versioned desired configuration for the four product harnesses. It contains public routes and stable credential references, not API keys. The declaration is independent of CLI installation directories and versions. [models.v1.lock.json](models.v1.lock.json) records the digest of the public configuration; it is not an encrypted credential store or a signature.

## Check the declaration

From the repository root, using Node:

```sh
node scripts/p0-b/model-config.mjs check
node --test scripts/p0-b/__tests__/model-config.test.mjs
```

`check` exits zero only for a valid declaration matching its public lock. The report explicitly says `CONFIG_VALID_NOT_ACTIVATED`, `productAccepted=false`, native compatibility `NOT_RUN`, and credentials not imported by this change. Unknown fields, literal credential fields, credential-bearing URLs, implicit fallback policies and a mismatched lock are rejected without printing untrusted input. HTTP routes are retained exactly and reported; they are not contacted.

## Credentials and product adapters

Provision rotated keys into a protected vault outside the repository, under `providers/codex`, `providers/claude-code`, `providers/grok`, and `providers/opencode`. These IDs are stable across upgrades. A trusted platform reader can resolve them through the [credential-reference component](../../scripts/p0-b/credential-ref.ts); this configuration does not implement or provision that vault. Keys supplied in chat must be replaced. No raw key, key suffix, key-derived hash, encrypted key, or decryption material is stored here. Ignore patterns are accidental-commit safeguards, not a security boundary.

OpenCode selects `zhipuai-coding-plan` as a built-in provider. Its `baseUrl` is null because the owner did not supply an override. This means no fabricated endpoint and no authorization to inherit the global OpenCode authentication directory. The adapter must verify the installed provider ID, its resolved endpoint, protocol and credential mechanism in the isolated installation. Product OpenCode and the independent hard-review OpenCode retain separate run identity and storage; these defaults do not reassign planner or reviewer roles.

Model and effort strings are exact owner requests. In particular, Codex `max` is preserved, not rewritten to `xhigh`. Native compatibility must be established for the selected CLI and gateway before execution. An unsupported value blocks execution instead of silently changing it. Gateway wire protocols, authentication header conventions and native configuration projections remain adapter responsibilities; this manifest is not a native Codex, Claude Code, Grok or OpenCode config file.

The three gateway URLs use HTTP. Their credential transport protection has not been verified. Do not send keys over an unprotected public connection; establish approved HTTPS or a verified protected transport without silently changing the approved route. The current change makes no network request and imports no credentials.

## Upgrade contract

A CLI-only upgrade must retain the same public model configuration and stable secret references. Compare a proposed declaration against the approved one:

```sh
node scripts/p0-b/model-config.mjs compare-upgrade --candidate path/to/candidate.json
```

The comparison exits nonzero if any protected field changes. A successful comparison is not native compatibility validation and does not activate an upgrade. The integrated upgrader must separately verify effective settings, auxiliary model calls, protocol and credential handling; pin the approved configuration and CLI version for active workflows; route only new workflows to a verified new version; and retain the previous compatible version or block on incompatibility. These runtime actions are not implemented by this offline comparison command.

The lock uses `sha256-sorted-json-v1`: recursively sort object keys, serialize compact JSON, preserve array order, and hash its UTF-8 bytes. All values are validated public configuration. Formatting and LF/CRLF changes do not alter this digest. It is not RFC 8785 and does not replace exact-byte candidate hashes. A trusted approved lock must be retained outside an upgrade proposal; a process able to change both manifest and lock can redefine the baseline. Legitimate model or route changes require owner authorization and a new version, not automatic lock regeneration.

See the [decision record](../../.agents/notes/implemented/architecture/2026-09-09-owner-model-config-lock.md) and [verification boundary](../../development/remediation/2026-09-09/model-config-r03/README.md).
