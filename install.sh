#!/bin/sh
# Kirha CLI installer.
#
#   curl -fsSL https://raw.githubusercontent.com/kirha-ai/kirha-cli/main/install.sh | sh
#
# Environment variables:
#   KIRHA_INSTALL_DIR  install root (default: $HOME/.kirha)
#   KIRHA_VERSION      pin a specific version (default: latest GitHub release tag)
#   KIRHA_SKIP_VERIFY  set to "1" to skip the SHA256 checksum check (not recommended)

set -eu

REPO="kirha-ai/kirha-cli"
INSTALL_DIR="${KIRHA_INSTALL_DIR:-$HOME/.kirha}"
BIN_DIR="$INSTALL_DIR/bin"
BIN_PATH="$BIN_DIR/kirha"

err() { printf 'error: %s\n' "$1" >&2; exit 1; }
info() { printf '%s\n' "$1"; }

require() {
  command -v "$1" >/dev/null 2>&1 || err "$1 is required"
}

require curl
require uname
require mkdir
require chmod

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64|amd64) ARCH=x64 ;;
  arm64|aarch64) ARCH=arm64 ;;
  *) err "unsupported architecture: $ARCH" ;;
esac

case "$OS" in
  darwin|linux) ;;
  *) err "unsupported OS: $OS (use the npm package on Windows: npm i -g @kirha/cli)" ;;
esac

ASSET="kirha-${OS}-${ARCH}"

if [ -z "${KIRHA_VERSION:-}" ]; then
  info "Resolving latest release..."
  # Use a regex anchored to the start of the line to avoid matching any
  # incidental "tag_name" substring in the release body.
  KIRHA_VERSION=$(
    curl -fsSL \
      -H "Accept: application/vnd.github+json" \
      "https://api.github.com/repos/$REPO/releases/latest" \
      | sed -n 's/^[[:space:]]*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
      | head -n 1
  )
  [ -n "$KIRHA_VERSION" ] || err "failed to resolve latest release"
fi

URL="https://github.com/$REPO/releases/download/$KIRHA_VERSION/$ASSET"
CHECKSUMS_URL="https://github.com/$REPO/releases/download/$KIRHA_VERSION/checksums.txt"

info "Installing kirha $KIRHA_VERSION ($OS/$ARCH)"
info "  from $URL"
info "  to   $BIN_PATH"

mkdir -p "$BIN_DIR"
TMP_BIN=$(mktemp)
TMP_SUMS=$(mktemp)
trap 'rm -f "$TMP_BIN" "$TMP_SUMS"' EXIT

if ! curl -fL --progress-bar "$URL" -o "$TMP_BIN"; then
  err "download failed (release asset $ASSET may not exist for $KIRHA_VERSION)"
fi

if [ "${KIRHA_SKIP_VERIFY:-0}" = "1" ]; then
  info "Skipping checksum verification (KIRHA_SKIP_VERIFY=1)"
else
  if ! curl -fsSL "$CHECKSUMS_URL" -o "$TMP_SUMS"; then
    err "failed to fetch checksums.txt — re-run with KIRHA_SKIP_VERIFY=1 to bypass at your own risk"
  fi

  EXPECTED=$(awk -v asset="$ASSET" '$2 == asset { print $1 }' "$TMP_SUMS")
  [ -n "$EXPECTED" ] || err "no checksum entry for $ASSET in checksums.txt"

  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL=$(sha256sum "$TMP_BIN" | awk '{ print $1 }')
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL=$(shasum -a 256 "$TMP_BIN" | awk '{ print $1 }')
  else
    err "neither sha256sum nor shasum available — re-run with KIRHA_SKIP_VERIFY=1 to bypass at your own risk"
  fi

  if [ "$ACTUAL" != "$EXPECTED" ]; then
    err "checksum mismatch: expected $EXPECTED, got $ACTUAL"
  fi
  info "Checksum verified."
fi

mv "$TMP_BIN" "$BIN_PATH"
chmod +x "$BIN_PATH"

info ""
info "kirha $KIRHA_VERSION installed."
info ""

case ":$PATH:" in
  *":$BIN_DIR:"*)
    info "Run: kirha --help"
    ;;
  *)
    info "Add $BIN_DIR to your PATH, e.g.:"
    info ""
    info "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.zshrc"
    info "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> ~/.bashrc"
    info ""
    info "Then: kirha --help"
    ;;
esac
