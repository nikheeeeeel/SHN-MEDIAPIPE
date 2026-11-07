"""MediaPipe Face Landmarker wrapper used for face and iris landmarks."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions, vision


class FaceDetectorError(RuntimeError):
    """Raised when the face model cannot be loaded or run."""


@dataclass(frozen=True)
class FaceObservation:
    present: bool
    landmarks: Sequence[Any] | None


class FaceDetector:
    def __init__(self, model_path: str | Path) -> None:
        path = Path(model_path)
        if not path.is_file():
            raise FaceDetectorError(
                f"Face model not found at {path}. "
                "Expected vision/models/face_landmarker.task."
            )

        try:
            options = vision.FaceLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(path)),
                running_mode=vision.RunningMode.VIDEO,
                num_faces=1,
                min_face_detection_confidence=0.5,
                min_face_presence_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            self._landmarker = vision.FaceLandmarker.create_from_options(options)
        except Exception as exc:  # noqa: BLE001 - surfaced as a friendly error
            raise FaceDetectorError(f"Could not load the face model: {exc}") from exc

        self._last_timestamp_ms = -1

    def detect(self, rgb_frame: np.ndarray, timestamp_ms: int) -> FaceObservation:
        """Return face presence and the 478 MediaPipe landmarks when present."""
        # MediaPipe VIDEO mode requires strictly increasing timestamps.
        timestamp_ms = max(timestamp_ms, self._last_timestamp_ms + 1)
        self._last_timestamp_ms = timestamp_ms

        image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=np.ascontiguousarray(rgb_frame),
        )
        try:
            result = self._landmarker.detect_for_video(image, timestamp_ms)
        except Exception as exc:  # noqa: BLE001 - surfaced as a friendly error
            raise FaceDetectorError(f"Face detection failed: {exc}") from exc

        if not result.face_landmarks:
            return FaceObservation(present=False, landmarks=None)

        return FaceObservation(
            present=True,
            landmarks=result.face_landmarks[0],
        )

    def close(self) -> None:
        close = getattr(self._landmarker, "close", None)
        if close is not None:
            close()
