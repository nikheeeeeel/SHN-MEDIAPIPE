"""PyInstaller entry point for the packaged vision worker."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vision.main import main  # noqa: E402


def _bundle_base() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))


if __name__ == "__main__":
    model = _bundle_base() / "vision" / "models" / "face_landmarker.task"
    if not model.is_file():
        model = Path(__file__).resolve().parent / "models" / "face_landmarker.task"
    if "--model" not in sys.argv:
        sys.argv.extend(["--model", str(model)])
    raise SystemExit(main())
