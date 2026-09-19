# r47 real acquisition record (before any URL edit)

All commands run as the normal local user from Git Bash on the Windows host (Windows 10.0.26200 x64), UTC 2026-09-19 ~03:29. Download target directory was created fresh for this round outside the repository: `C:\dsh-r47-9f3k2m7q\`. No credentials, tokens, or `git credential` use; the package was not installed, executed, or unpacked beyond the read-only member listing below; no apt/dpkg/WSL/VM was installed.

## Request

```
curl -sS -L -D C:/dsh-r47-9f3k2m7q/download-headers.txt \
  -o C:/dsh-r47-9f3k2m7q/bubblewrap_0.9.0-1ubuntu0.1_amd64.deb \
  -w "http_code=... url_effective=... num_redirects=... size_download=..." \
  https://snapshot.ubuntu.com/ubuntu/20260901T000000Z/pool/main/b/bubblewrap/bubblewrap_0.9.0-1ubuntu0.1_amd64.deb
```

## Result (verbatim from [00a-acquisition-curl.log](00a-acquisition-curl.log); curl exit 0)

```
http_code=200
url_effective=https://snapshot.ubuntu.com/ubuntu/20260901T000000Z/pool/main/b/bubblewrap/bubblewrap_0.9.0-1ubuntu0.1_amd64.deb
num_redirects=0
size_download=50178
curl_exit=0
```

No redirects were followed (num_redirects=0, final URL = requested URL), so the bytes came from `snapshot.ubuntu.com` itself, not from any third-party mirror. Response headers ([00b-acquisition-headers.txt](00b-acquisition-headers.txt)): `HTTP/1.1 200 OK`, `server: nginx/1.18.0 (Ubuntu)`, `content-type: application/x-debian-package`, `content-length: 50178`, `last-modified: Wed, 25 Sep 2024 10:37:19 GMT`. stderr was empty.

## Byte count

`stat`: 50178 bytes on disk, matching `content-length` and `size_download` (no truncation, not an HTML error page).

## SHA-256, two independent tools

Git Bash `sha256sum` (exit 0):

```
1b506492bd9c7fd0cdb4f02ac822f1d3e336b0aead5113c1239baf8db5db562a *C:/dsh-r47-9f3k2m7q/bubblewrap_0.9.0-1ubuntu0.1_amd64.deb
```

PowerShell `powershell.exe -NoProfile -Command "Get-FileHash -Algorithm SHA256 ... | Format-List"` (exit 0):

```
Algorithm : SHA256
Hash      : 1B506492BD9C7FD0CDB4F02AC822F1D3E336B0AEAD5113C1239BAF8DB5DB562A
Path      : C:\dsh-r47-9f3k2m7q\bubblewrap_0.9.0-1ubuntu0.1_amd64.deb
```

Both equal the script's pinned `BUBBLEWRAP_SHA256='1b506492bd9c7fd0cdb4f02ac822f1d3e336b0aead5113c1239baf8db5db562a'` (hex is case-insensitive). Same-byte acquisition CONFIRMED; no hash was written back into the script to manufacture a match.

## Read-only package identity (existing tools only)

`C:\Windows\System32\tar.exe -tf` (Windows bsdtar, exit 0) lists the ar members `debian-binary`, `control.tar.zst`, `data.tar.zst` (a well-formed Debian package, not an HTML error page). Extracting only `control.tar.zst` to the external directory (SHA-256 `abe34cc157d992594f9b3ad0f6f4231d7af4f9422609407d5fb9ce020f7a5ed2`) and reading its `control` member shows:

```
Package: bubblewrap
Version: 0.9.0-1ubuntu0.1
Architecture: amd64
```

matching the pinned identity. The filename was not treated as the package identity; the identity binding remains the pinned SHA-256 above.

## Raw artifact custody

The `.deb` stays outside the repository at `C:\dsh-r47-9f3k2m7q\bubblewrap_0.9.0-1ubuntu0.1_amd64.deb` (dual-hashed above). `data.tar.zst` was never extracted; no postinst or binary was executed.

## Security status (explicit)

Canonical's `UBUNTU-CVE-2026-87766` lists `0.9.0-1ubuntu0.1` as an affected version (upstream fix noted toward 0.12.0; supported fixed builds still require USN verification, see USN-8779-1/-2). This same-byte acquisition does NOT close the CVE, is not a security upgrade, and does not approve the old pin for new deployments that run real untrusted workloads.
