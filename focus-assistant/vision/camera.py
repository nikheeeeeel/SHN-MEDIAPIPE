"""Local camera access for the vision worker.

Frames are only ever held in memory for the duration of a detection pass.
Nothing is written to disk.
"""

from __future__ import annotations

import sys
from typing import Optional

import cv2
import numpy as np


class CameraError(RuntimeError):
    """Raised when the camera cannot be opened or stops producing frames."""


class Camera:
    def __init__(
        self,
        index: int = 0,
        width: int = 640,
        height: int = 480,
        fps: int = 30,
        read_attempts: int = 3,
    ) -> None:
        self.index = index
        self.width = width
        self.height = height
        self.fps = fps
        self.read_attempts = read_attempts
        self._capture: Optional[cv2.VideoCapture] = None

    def open(self) -> None:
        backend = cv2.CAP_V4L2 if sys.platform.startswith("linux") else cv2.CAP_ANY
        capture = cv2.VideoCapture(self.index, backend)

        if not capture.isOpened():
            capture.release()
            raise CameraError(
                f"Could not open camera {self.index}. Check that it is connected, "
                "not in use by another application, and that your user can access "
                "/dev/video*."
            )

        capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        capture.set(cv2.CAP_PROP_FPS, self.fps)
        if sys.platform.startswith("linux"):
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        self._capture = capture

    def read(self) -> np.ndarray:
        if self._capture is None:
            raise CameraError("Camera has not been opened.")

        for _ in range(self.read_attempts):
            ok, frame = self._capture.read()
            if ok and frame is not None and frame.size > 0:
                return frame

        raise CameraError(
            "The camera stopped returning frames. It may have been disconnected "
            "or taken over by another application."
        )

    def release(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None

    def __enter__(self) -> "Camera":
        self.open()
        return self

    def __exit__(self, *_: object) -> None:
        self.release()
