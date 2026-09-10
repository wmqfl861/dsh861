# Private platform-reader endpoint. Input is public RSA material; output is never a plaintext key.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateSet('Read', 'SelfTest')][string]$Action,
    [ValidateSet('codex', 'claude-code', 'grok', 'opencode')][string]$Provider
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    if (-not [Console]::IsInputRedirected) { throw 'PRIVATE_PIPE_REQUIRED' }
    if (($Action -eq 'Read') -ne (-not [string]::IsNullOrEmpty($Provider))) { throw 'INVALID_PROVIDER' }
    [Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false, $true)
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false, $true)
    $characters = New-Object char[] 4097
    $count = [Console]::In.ReadBlock($characters, 0, $characters.Length)
    if ($count -gt 4096) { throw 'REQUEST_TOO_LARGE' }
    $request = (-join $characters[0..($count - 1)]) | ConvertFrom-Json
    $names = @($request.PSObject.Properties.Name | Sort-Object)
    if (($names -join ',') -ne 'exponent,modulus,requestId,version' -or $request.version -ne 1) {
        throw 'INVALID_REQUEST'
    }
    if ($request.requestId -cnotmatch '\A[0-9a-f]{32}\z' -or $request.exponent -cne 'AQAB'
        -or $request.modulus -cnotmatch '\A[A-Za-z0-9+/]{683}=\z') { throw 'INVALID_REQUEST' }
    Add-Type -TypeDefinition (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-credential.cs') -Raw -Encoding UTF8) | Out-Null
    $sealed = if ($Action -eq 'Read') {
        [Dsh861.Credentials.NativeCredential]::Seal($Provider, $request.modulus, $request.exponent)
    } else {
        [Dsh861.Credentials.NativeCredential]::SelfTest($request.requestId, $request.modulus, $request.exponent)
    }
    $result = [ordered]@{
        version = 1
        requestId = $request.requestId
        status = $(if ($null -eq $sealed) { 'MISSING' } else { 'SEALED' })
        ciphertext = $sealed
        selfTestRemoved = ($Action -eq 'SelfTest')
    }
    [Console]::Out.Write(($result | ConvertTo-Json -Compress))
} catch {
    # No exception text, request content, environment, or native buffer leaves this process.
    [Console]::Error.WriteLine('CREDENTIAL_BRIDGE_FAILED')
    exit 1
}
