# Run in a trusted interactive local console; never place a key in arguments.
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Set', 'Status', 'Remove')][string]$Action,
    [Parameter(Mandatory = $true)]
    [ValidateSet('codex', 'claude-code', 'grok', 'opencode')][string]$Provider,
    [switch]$Replace
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$first = $null
$second = $null
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    if ($Replace -and $Action -ne 'Set') { throw 'INVALID_REPLACE_ACTION' }
    Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-credential.cs') -Raw -Encoding UTF8) | Out-Null
    $target = [Dsh861.Credentials.NativeCredential]::Target($Provider)
    if ($Action -eq 'Set') {
        if ([Console]::IsInputRedirected) { throw 'INTERACTIVE_CONSOLE_REQUIRED' }
        if (-not $PSCmdlet.ShouldProcess($target, 'Store a dedicated credential for the current Windows user')) { return }
        if (-not $Replace -and [Dsh861.Credentials.NativeCredential]::Status($Provider) -ne 'MISSING') {
            throw 'CREDENTIAL_EXISTS_USE_REPLACE'
        }
        $first = Read-Host -Prompt 'Enter the NEW key (hidden; never paste into the command line)' -AsSecureString
        $second = Read-Host -Prompt 'Confirm the NEW key (hidden)' -AsSecureString
        [Dsh861.Credentials.NativeCredential]::Store($Provider, $first, $second, $Replace.IsPresent)
    } elseif ($Action -eq 'Remove') {
        if (-not $PSCmdlet.ShouldProcess($target, 'Remove this dedicated credential')) { return }
        [void][Dsh861.Credentials.NativeCredential]::Remove($Provider)
    }
    [ordered]@{
        provider = $Provider
        credentialRef = "secret-reference:providers/$Provider"
        target = $target
        status = [Dsh861.Credentials.NativeCredential]::Status($Provider)
        scope = 'current-Windows-user-on-this-machine'
        rotationVerified = $false
        productActivated = $false
    } | ConvertTo-Json -Compress
} catch {
    # Raw PowerShell/.NET exceptions may contain caller input. Emit only a fixed category.
    [Console]::Error.WriteLine('CREDENTIAL_OPERATION_REFUSED: check platform, interactive input, existing target, format, and logon context.')
    exit 1
} finally {
    if ($null -ne $first) { $first.Dispose() }
    if ($null -ne $second) { $second.Dispose() }
}
