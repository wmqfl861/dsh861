#!/usr/bin/env bash
set -euo pipefail

# Forward replacement of the CVE-listed pinned deb (r47): bubblewrap is now
# built from the official 0.12.0 release source with task-private build
# dependencies. Every input is a hash-pinned release artifact whose digest is
# verified before the archive is unpacked, every unpack lands inside this
# script's own RUNNER_TEMP tree, and the produced binary must prove its
# identity, architecture, and dependency closure before it is published. No
# package transaction, no writes outside RUNNER_TEMP, no fallback to a host or
# system bubblewrap, and nothing here weakens the sandbox.

readonly BUBBLEWRAP_VERSION='0.12.0'
readonly BUBBLEWRAP_SHA256='9760d007363e3abba7c747489910f9f82d9fca53ba3bd3282e396fa3c97a3314'
readonly BUBBLEWRAP_URL="https://github.com/containers/bubblewrap/releases/download/v${BUBBLEWRAP_VERSION}/bubblewrap-${BUBBLEWRAP_VERSION}.tar.xz"

readonly MESON_VERSION='1.12.0'
readonly MESON_SHA256='88afe0c20e52030218924ac37d0c81c59b4b5f3ae3752c8c6d7470c7d365886c'
readonly MESON_URL="https://github.com/mesonbuild/meson/releases/download/${MESON_VERSION}/meson-${MESON_VERSION}.tar.gz"

# Digest from Ubuntu's signed noble-updates and noble-security Packages
# indexes (both list this exact file). Served by the official snapshot at a
# pinned UTC timestamp because the rolling pool drops superseded -updates
# versions; payload identity stays bound by the SHA-256, not by the host.
readonly LIBCAP_VERSION='1:2.66-5ubuntu2.4'
readonly LIBCAP_PC_VERSION='2.66'
readonly LIBCAP_ARCHIVE_NAME='libcap-dev_2.66-5ubuntu2.4_amd64.deb'
readonly LIBCAP_SHA256='07f2462867569a2119a2ad0f1593232663f2d1612b791c230d22a8d73a15abee'
readonly LIBCAP_URL="https://snapshot.ubuntu.com/ubuntu/20260919T000000Z/pool/main/libc/libcap2/${LIBCAP_ARCHIVE_NAME}"

readonly ROOT_NAME='dsh-bubblewrap-private'

# GNU tar's C-locale verbose listing: perms owner/group size date time name.
# Link names and targets are the captured tail so names may contain spaces;
# a link line that fails the anchored shape is rejected, not guessed at.
readonly SYMLINK_LINE_RE='^l[^[:space:]]+[[:space:]]+[^[:space:]]+[[:space:]]+[0-9]+[[:space:]]+[0-9-]+[[:space:]]+[0-9:]+[[:space:]]+(.+)[[:space:]]+->[[:space:]]+(.+)$'
readonly HARDLINK_LINE_RE='^[^[:space:]]+[[:space:]]+[^[:space:]]+[[:space:]]+[0-9]+[[:space:]]+[0-9-]+[[:space:]]+[0-9:]+[[:space:]]+(.+)[[:space:]]+link[[:space:]]+to[[:space:]]+(.+)$'

: "${RUNNER_TEMP:?prepare-ci-bubblewrap requires RUNNER_TEMP}"
: "${GITHUB_PATH:?prepare-ci-bubblewrap requires GITHUB_PATH}"

if [[ "$(uname -s)" != 'Linux' || "$(uname -m)" != 'x86_64' ]]; then
  echo 'prepare-ci-bubblewrap supports only Linux x86_64 hosted runners' >&2
  exit 1
fi

# Every tool the build needs must already exist on the runner; nothing is
# auto-installed. A missing image-inventory entry proves nothing either way —
# the preflight executes each tool instead of trusting any inventory.
missing_tools=()
for tool in curl sha256sum tar dpkg-deb python3 cc ninja pkg-config objdump ldd; do
  command -v "$tool" >/dev/null 2>&1 || missing_tools+=("$tool")
done
if ((${#missing_tools[@]} > 0)); then
  printf 'prepare-ci-bubblewrap requires on PATH: %s\n' "${missing_tools[*]}" >&2
  exit 1
fi

# Toolchain identity is recorded for the CI acceptance record; a tool that
# cannot answer here fails the run before any download.
python3_output="$(python3 --version 2>&1)"
cc_output="$(cc --version 2>&1)"
ninja_output="$(ninja --version 2>&1)"
pkg_config_output="$(pkg-config --version 2>&1)"
printf 'toolchain: %s; %s; ninja %s; pkg-config %s\n' \
  "$python3_output" "${cc_output%%$'\n'*}" "${ninja_output%%$'\n'*}" "${pkg_config_output%%$'\n'*}"

fail() {
  printf 'prepare-ci-bubblewrap: %s\n' "$1" >&2
  exit 1
}

# Downloads one pinned input and refuses bytes whose SHA-256 does not match
# the publisher-recorded digest; nothing unpacks or executes before this.
fetch_verified() {
  local url="$1" expected="$2" dest="$3"
  curl --fail --silent --show-error --location --retry 3 --retry-all-errors --output "$dest" "$url"
  if ! printf '%s  %s\n' "$expected" "$dest" | sha256sum --check --status; then
    fail "${dest} does not match its pinned SHA-256; refusing to unpack or execute it"
  fi
}

# True when a link target, resolved against the link's own directory, stays
# inside the extraction root.
link_resolves_in_root() {
  local name="$1" target="$2"
  local -a stack=() dir_parts=() target_parts=()
  local dir part
  dir="${name%/*}"
  [[ "$dir" == "$name" ]] && dir='.'
  IFS='/' read -r -a dir_parts <<<"${dir#./}"
  for part in "${dir_parts[@]}"; do
    case "$part" in ''|'.') ;; *) stack+=("$part") ;; esac
  done
  IFS='/' read -r -a target_parts <<<"$target"
  for part in "${target_parts[@]}"; do
    case "$part" in
      ''|'.') ;;
      '..')
        if ((${#stack[@]} == 0)); then return 1; fi
        unset 'stack[${#stack[@]}-1]'
        ;;
      *) stack+=("$part") ;;
    esac
  done
  return 0
}

# Audits `tar -tf` output: rejects absolute paths, `..` traversal, tab
# characters (newline-adjacent ambiguity), and empty names.
audit_member_names() {
  local name part
  local -a components=()
  # `|| [[ -n "$name" ]]` also audits a final unterminated line: acceptance
  # must not depend on the listing ending with a newline.
  while IFS= read -r name || [[ -n "$name" ]]; do
    [[ -n "$name" ]] || { printf 'archive has an empty member name\n' >&2; return 1; }
    [[ "$name" != *$'\t'* ]] || { printf 'archive member name contains a tab: %s\n' "$name" >&2; return 1; }
    [[ "$name" != /* ]] || { printf 'archive member is an absolute path: %s\n' "$name" >&2; return 1; }
    IFS='/' read -r -a components <<<"$name"
    for part in "${components[@]}"; do
      if [[ "$part" == '..' ]]; then
        printf 'archive member escapes the extraction root: %s\n' "$name" >&2
        return 1
      fi
    done
  done
  return 0
}

# Audits `LC_ALL=C tar -tvf` output: rejects device members and link targets
# that resolve outside the extraction root; unparseable link lines are
# rejected rather than guessed at.
audit_member_metadata() {
  local line perms
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    perms="${line%% *}"
    case "$perms" in
      b??*|c??*)
        printf 'archive contains a device member: %s\n' "$line" >&2
        return 1
        ;;
    esac
    if [[ "$line" == *' -> '* ]]; then
      if ! [[ "$line" =~ $SYMLINK_LINE_RE ]]; then
        printf 'archive has an unparseable symlink line: %s\n' "$line" >&2
        return 1
      fi
      if [[ "${BASH_REMATCH[2]}" == /* ]]; then
        printf 'archive link has an absolute target: %s\n' "$line" >&2
        return 1
      fi
      if ! link_resolves_in_root "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"; then
        printf 'archive link escapes the extraction root: %s\n' "$line" >&2
        return 1
      fi
    fi
    if [[ "$line" == *' link to '* ]]; then
      if ! [[ "$line" =~ $HARDLINK_LINE_RE ]]; then
        printf 'archive has an unparseable hardlink line: %s\n' "$line" >&2
        return 1
      fi
      if ! link_resolves_in_root "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"; then
        printf 'archive hardlink escapes the extraction root: %s\n' "$line" >&2
        return 1
      fi
    fi
  done
  return 0
}

# Audits a tarball's listing, then extracts it; nothing is written before the
# member audit accepts the whole listing.
extract_tar_verified() {
  local archive="$1" dest="$2"
  if ! tar -tf "$archive" | audit_member_names; then
    fail "rejected unsafe member names in ${archive}"
  fi
  if ! LC_ALL=C tar -tvf "$archive" | audit_member_metadata; then
    fail "rejected unsafe member metadata in ${archive}"
  fi
  mkdir -p "$dest"
  tar -xf "$archive" -C "$dest"
}

root="${RUNNER_TEMP}/${ROOT_NAME}"
downloads="${root}/downloads"
src_root="${root}/src"
tools_root="${root}/tools"
libcap_root="${root}/libcap"
pkgconfig_dir="${root}/pkgconfig"
build_dir="${root}/build"
mkdir -p "$downloads" "$src_root" "$tools_root" "$libcap_root" "$pkgconfig_dir"

bwrap_archive="${downloads}/bubblewrap-${BUBBLEWRAP_VERSION}.tar.xz"
meson_archive="${downloads}/meson-${MESON_VERSION}.tar.gz"
libcap_archive="${downloads}/${LIBCAP_ARCHIVE_NAME}"

# Input 1: bubblewrap official release source (asset of the v0.12.0 tag).
fetch_verified "$BUBBLEWRAP_URL" "$BUBBLEWRAP_SHA256" "$bwrap_archive"
extract_tar_verified "$bwrap_archive" "$src_root"
bwrap_src="${src_root}/bubblewrap-${BUBBLEWRAP_VERSION}"
[[ -f "${bwrap_src}/meson.build" ]] || fail "bubblewrap source is missing meson.build"

# Input 2: Meson official release source. meson.py runs straight from the
# extracted directory (no pip/apt/MSI) and enforces its own Python 3.10+ floor
# at startup, so an older interpreter fails loudly here.
fetch_verified "$MESON_URL" "$MESON_SHA256" "$meson_archive"
extract_tar_verified "$meson_archive" "$tools_root"
meson_entry="${tools_root}/meson-${MESON_VERSION}/meson.py"
[[ -f "$meson_entry" && -d "${tools_root}/meson-${MESON_VERSION}/mesonbuild" ]] \
  || fail 'meson source is missing meson.py or the mesonbuild package'

# Input 3: Ubuntu libcap-dev handled as data. Control fields and the member
# listing are verified read-only; `dpkg-deb --extract` unpacks payload files
# only and never runs a maintainer script.
fetch_verified "$LIBCAP_URL" "$LIBCAP_SHA256" "$libcap_archive"
# Each control field is its own single-field `dpkg-deb --field` invocation
# whose exit status and stderr are captured directly — never through a pipe
# or process substitution, the mechanism that hid subcommand failures before
# W01. The real tool answers multi-field requests with labeled `Field:
# value` lines in control-file order (CI run 35436610274 served `Package:
# libcap-dev` to the old bare-value comparison), so fields are never
# requested in bulk and each read accepts only a non-empty, single-line,
# unlabeled value that matches the pin exactly.
libcap_field_stderr="${root}/libcap-control-field.stderr"
deb_package_status=0
deb_package="$(dpkg-deb --field "$libcap_archive" Package 2>"$libcap_field_stderr")" || true
((deb_package_status == 0)) \
  || fail "dpkg-deb --field Package exited ${deb_package_status}: $(cat "$libcap_field_stderr" 2>/dev/null)"
[[ -n "$deb_package" ]] || fail "dpkg-deb --field Package returned no value; the control field is missing"
[[ "$deb_package" != *$'\n'* ]] || fail "dpkg-deb --field Package returned multiple records; exactly one was required"
[[ "$deb_package" != 'Package:'* ]] \
  || fail "dpkg-deb --field Package returned labeled output '${deb_package}'; the bare single-line value was required"
[[ "$deb_package" == 'libcap-dev' ]] || fail "libcap-dev control Package is '${deb_package}'"
deb_version_status=0
deb_version="$(dpkg-deb --field "$libcap_archive" Version 2>"$libcap_field_stderr")" || true
((deb_version_status == 0)) \
  || fail "dpkg-deb --field Version exited ${deb_version_status}: $(cat "$libcap_field_stderr" 2>/dev/null)"
[[ -n "$deb_version" ]] || fail "dpkg-deb --field Version returned no value; the control field is missing"
[[ "$deb_version" != *$'\n'* ]] || fail "dpkg-deb --field Version returned multiple records; exactly one was required"
[[ "$deb_version" != 'Version:'* ]] \
  || fail "dpkg-deb --field Version returned labeled output '${deb_version}'; the bare single-line value was required"
[[ "$deb_version" == "$LIBCAP_VERSION" ]] || fail "libcap-dev control Version is '${deb_version}', expected '${LIBCAP_VERSION}'"
deb_architecture_status=0
deb_architecture="$(dpkg-deb --field "$libcap_archive" Architecture 2>"$libcap_field_stderr")" || true
((deb_architecture_status == 0)) \
  || fail "dpkg-deb --field Architecture exited ${deb_architecture_status}: $(cat "$libcap_field_stderr" 2>/dev/null)"
[[ -n "$deb_architecture" ]] || fail "dpkg-deb --field Architecture returned no value; the control field is missing"
[[ "$deb_architecture" != *$'\n'* ]] \
  || fail "dpkg-deb --field Architecture returned multiple records; exactly one was required"
[[ "$deb_architecture" != 'Architecture:'* ]] \
  || fail "dpkg-deb --field Architecture returned labeled output '${deb_architecture}'; the bare single-line value was required"
[[ "$deb_architecture" == 'amd64' ]] || fail "libcap-dev control Architecture is '${deb_architecture}', expected 'amd64'"
if ! dpkg-deb --fsys-tarfile "$libcap_archive" | tar -tf - | audit_member_names; then
  fail "rejected unsafe member names in ${libcap_archive}"
fi
if ! dpkg-deb --fsys-tarfile "$libcap_archive" | LC_ALL=C tar -tvf - | audit_member_metadata; then
  fail "rejected unsafe member metadata in ${libcap_archive}"
fi
dpkg-deb --extract "$libcap_archive" "$libcap_root"

libcap_lib="${libcap_root}/usr/lib/x86_64-linux-gnu"
[[ -f "${libcap_root}/usr/include/sys/capability.h" ]] \
  || fail 'libcap-dev payload lacks usr/include/sys/capability.h'
[[ -f "${libcap_lib}/libcap.a" ]] \
  || fail 'libcap-dev payload lacks the static library libcap.a'
# The shipped dev symlinks point at the runtime package's libcap.so.2, which
# this static-only pipeline deliberately does not take. Removing the dangling
# links pins `-lcap` to the audited static archive instead of any host .so.
rm -f "${libcap_lib}/libcap.so" "${libcap_lib}/libpsx.so"
[[ ! -e "${libcap_lib}/libcap.so" ]] || fail 'libcap.so is still present after removing the dangling dev symlink'

# The archive's own libcap.pc names libdir=/usr/lib64 while the payload
# installs under usr/lib/x86_64-linux-gnu; building on that file would miss
# the directory and fall back to host lookup paths. The private .pc below
# names the audited absolute paths, and PKG_CONFIG_LIBDIR is restricted to it
# so nothing else on the runner can satisfy the libcap dependency.
{
  printf 'prefix=%s/usr\n' "$libcap_root"
  printf 'libdir=%s\n' "$libcap_lib"
  printf 'includedir=%s/usr/include\n' "$libcap_root"
  printf 'Name: libcap\n'
  printf 'Description: libcap development payload extracted from Ubuntu libcap-dev %s\n' "$LIBCAP_VERSION"
  printf 'Version: %s\n' "$LIBCAP_PC_VERSION"
  printf 'Libs: -L${libdir} -lcap\n'
  printf 'Cflags: -I${includedir}\n'
} > "${pkgconfig_dir}/libcap.pc"

resolved_pc_version="$(PKG_CONFIG_LIBDIR="$pkgconfig_dir" pkg-config --modversion libcap)" \
  || fail 'restricted pkg-config could not resolve the private libcap'
[[ "$resolved_pc_version" == "$LIBCAP_PC_VERSION" ]] \
  || fail "private libcap resolved version '${resolved_pc_version}', expected '${LIBCAP_PC_VERSION}'"
resolved_libdir="$(PKG_CONFIG_LIBDIR="$pkgconfig_dir" pkg-config --variable=libdir libcap)" \
  || fail 'restricted pkg-config could not resolve the private libcap libdir'
[[ "$resolved_libdir" == "$libcap_lib" ]] \
  || fail "private libcap libdir resolved to '${resolved_libdir}', expected '${libcap_lib}'"
echo "private libcap resolved: version ${resolved_pc_version} from ${resolved_libdir}"

# Configure with the restricted pkg-config path: prefer_static plus the
# .a-only private directory makes the libcap link static. The disabled
# project options are deliverables this pipeline does not need (tests, man
# page, shell completions) — not security checks. The SELinux feature stays
# at upstream default 'auto'; under the restricted search path Meson reports
# libselinux as not found, matching Ubuntu's AppArmor runner platform.
env PKG_CONFIG_LIBDIR="$pkgconfig_dir" python3 "$meson_entry" setup "$build_dir" "$bwrap_src" \
  -Dprefer_static=true \
  -Dtests=false \
  -Dman=disabled \
  -Dbash_completion=disabled \
  -Dzsh_completion=disabled

build_log="${root}/meson-compile.log"
env PKG_CONFIG_LIBDIR="$pkgconfig_dir" python3 "$meson_entry" compile -C "$build_dir" --verbose 2>&1 | tee "$build_log"

bwrap_bin="${build_dir}/bwrap"
[[ -f "$bwrap_bin" ]] || fail "the build did not produce ${bwrap_bin}"

# The verbose build log must contain the real link command and it must
# reference the private libcap directory; otherwise the binary fell back to
# host development files.
link_line="$(grep ' -o bwrap ' "$build_log" | tail -n 1 || true)"
[[ -n "$link_line" ]] || fail "no bwrap link command is recorded in ${build_log}"
echo "bwrap link command: ${link_line}"
if [[ "$link_line" != *" -L${libcap_lib}"* || "$link_line" != *'-lcap'* ]]; then
  fail "the link command does not reference the private libcap directory ${libcap_lib}"
fi

# Artifact identity: an x86-64 ELF whose dynamic dependencies prove the
# static-private libcap link (no libcap.so NEEDED entry, no ldd resolution)
# and whose version string is exactly the pinned upstream identity.
objdump_format="$(objdump -f "$bwrap_bin" | grep 'file format')"
[[ "$objdump_format" == *'elf64-x86-64'* ]] \
  || fail "the built bwrap is not elf64-x86-64: ${objdump_format}"
objdump_dynamic="$(objdump -p "$bwrap_bin")"
if grep -q 'libcap\.so' <<<"$objdump_dynamic"; then
  fail 'the built bwrap has a dynamic libcap dependency; the static-private link is not proven'
fi
ldd_output="$(ldd "$bwrap_bin")"
if grep -q 'libcap' <<<"$ldd_output"; then
  fail 'ldd resolves libcap for the built bwrap; the static-private link is not proven'
fi
echo "bwrap ELF: ${objdump_format}"
echo 'bwrap NEEDED entries:'
grep 'NEEDED' <<<"$objdump_dynamic" || true
echo 'bwrap dynamic dependencies (ldd):'
echo "$ldd_output"
bwrap_version="$("$bwrap_bin" --version)"
[[ "$bwrap_version" == "bubblewrap ${BUBBLEWRAP_VERSION}" ]] \
  || fail "the built bwrap reports version '${bwrap_version}', expected 'bubblewrap ${BUBBLEWRAP_VERSION}'"

binary_sha256_output="$(sha256sum "$bwrap_bin")"
binary_sha256="${binary_sha256_output%% *}"
# Hash chain for CI acceptance: source, build dependencies, and compiled
# artifact are recorded separately; a source digest is not a binary digest,
# and different runners are not claimed to reproduce identical binaries.
echo "verified source sha256: bubblewrap-${BUBBLEWRAP_VERSION}.tar.xz ${BUBBLEWRAP_SHA256}"
echo "verified build-dependency sha256: meson-${MESON_VERSION}.tar.gz ${MESON_SHA256}"
echo "verified build-dependency sha256: ${LIBCAP_ARCHIVE_NAME} ${LIBCAP_SHA256}"
echo "built artifact sha256: bwrap ${binary_sha256}"

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 \
  || echo 'apparmor userns knob absent — the functional probe decides'
"$bwrap_bin" --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent -- true

# Publication happens only after the functional probe passes, so a failed
# probe leaves no half-published path behind.
echo 'bubblewrap functional probe passed'
printf '%s\n' "$build_dir" >> "$GITHUB_PATH"
echo "published private-build bubblewrap ${BUBBLEWRAP_VERSION}: ${bwrap_bin}"
