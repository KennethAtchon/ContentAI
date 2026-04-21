#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FRONTEND_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
EDITOR_CORE_DIR="${EDITOR_CORE_DIR:-$FRONTEND_DIR/editor-core}"
OUT_DIR="$FRONTEND_DIR/src/features/editor/wasm"

if [ -x /opt/homebrew/opt/rustup/bin/rustup ]; then
  PATH="/opt/homebrew/opt/rustup/bin:$PATH"
  export PATH
fi

if [ ! -f "$EDITOR_CORE_DIR/Cargo.toml" ]; then
  echo "Missing editor-core crate at $EDITOR_CORE_DIR" >&2
  exit 1
fi

if command -v rustup >/dev/null 2>&1; then
  rustup target add wasm32-unknown-unknown >/dev/null
fi

mkdir -p "$OUT_DIR"

if command -v wasm-bindgen >/dev/null 2>&1; then
  cd "$EDITOR_CORE_DIR"
  cargo build --target wasm32-unknown-unknown --release
  wasm-bindgen \
    --target web \
    --out-dir "$OUT_DIR" \
    "$EDITOR_CORE_DIR/target/wasm32-unknown-unknown/release/editor_core.wasm"
else
  command -v wasm-pack >/dev/null 2>&1 || {
    echo "wasm-pack or wasm-bindgen is required to build editor-core." >&2
    exit 1
  }
  cd "$EDITOR_CORE_DIR"
  wasm-pack build --target web --out-dir "$OUT_DIR"
fi

test -f "$OUT_DIR/editor_core.js"
test -f "$OUT_DIR/editor_core_bg.wasm"
