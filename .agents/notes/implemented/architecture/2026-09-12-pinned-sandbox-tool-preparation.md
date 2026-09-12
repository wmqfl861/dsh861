# Agent Note: Prepare pinned sandbox binaries without initializing shared accounts

Status: implemented

English | [中文](2026-09-12-pinned-sandbox-tool-preparation.zh.md)

## Problem

A usable main Codex executable does not establish that its separate setup and command runner are present. Elevated initialization can also affect accounts and network-policy objects used by another Codex installation. Combining artifact acquisition with system setup conceals missing binaries and shared-resource impact until an administrator operation has started.

## Decision

The [local bundle preparer](../../../../scripts/p0-b/windows-credentials/sandbox-tool-bundle.md) copies only three explicitly selected files after checking reviewed sizes and SHA-256 pins. It uses same-release raw setup and runner assets with the repository-pinned main executable, never a global runner or an automatic version upgrade. A fresh staging allocation preserves source files and existing installations. Preparation never executes a program, enrolls trust, touches accounts or requests elevation.

## Alternatives considered

Changing CODEX_HOME alone does not separate source-fixed account names and filtering identifiers. Reusing old secret files couples the new deployment to another installation's credentials. Running setup to discover whether helper files exist performs system work before the package is known. The preparer instead gives artifact integrity and system authorization separate results.

## Consequences

Prepared bytes are not runtime compatibility, a publisher-signature proof, system-change approval or OS isolation. Synthetic file tests cover copy, refusal and cleanup behavior, while the pinned real artifacts require a local integrity check. Source and staging directories remain under the trusted user's control; the preparer does not solve hostile concurrent filesystem replacement. Shared-resource cleanup cannot be inferred from stable names or GUIDs.
