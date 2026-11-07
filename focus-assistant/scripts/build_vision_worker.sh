#!/usr/bin/env bash
# Build the self-contained local vision worker with PyInstaller and copy it
# into the Tauri resources directory. Run from anywhere.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON="${PYTHON:-$ROOT/../venv/bin/python}"
BUILD_DIR="${BUILD_DIR:-$ROOT/build/vision-worker}"
OUT_DIR="$ROOT/src-tauri/resources/vision-worker"
MODEL="$ROOT/vision/models/face_landmarker.task"

if [[ ! -x "$PYTHON" ]]; then
  echo "Python not found at $PYTHON. Set PYTHON=/path/to/python." >&2
  exit 1
fi

if ! "$PYTHON" -c "import PyInstaller" >/dev/null 2>&1; then
  echo "PyInstaller is not installed." >&2
  echo "Install it with: $PYTHON -m pip install -r vision/requirements-packaging.txt" >&2
  exit 1
fi

if [[ ! -f "$MODEL" ]]; then
  echo "Missing face model: $MODEL" >&2
  exit 1
fi

rm -rf "$BUILD_DIR" "$OUT_DIR"
mkdir -p "$BUILD_DIR" "$OUT_DIR"

"$PYTHON" -m PyInstaller \
  --noconfirm \
  --clean \
  --onedir \
  --name focus-vision \
  --paths "$ROOT" \
  --add-data "$MODEL:vision/models" \
  --collect-all mediapipe \
  --collect-all cv2 \
  --distpath "$BUILD_DIR/dist" \
  --workpath "$BUILD_DIR/work" \
  --specpath "$BUILD_DIR" \
  "$ROOT/vision/worker_entry.py"

cp -a "$BUILD_DIR/dist/focus-vision/." "$OUT_DIR/"
chmod +x "$OUT_DIR/focus-vision"

echo "Bundled vision worker at $OUT_DIR"
du -sh "$OUT_DIR"
