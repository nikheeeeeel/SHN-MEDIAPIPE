"""Approximate iris-based gaze estimation.

MediaPipe Face Landmarker provides 478 normalized face landmarks, including
iris landmarks. This module compares the iris position inside each eye against a
short calibration baseline. It is deliberately conservative: brief blinks,
small head movements, and noisy frames should not count as looking away.

This is an approximation, not eye tracking. It works best with a steady head,
even lighting, and the camera roughly at eye level. If calibration or iris
landmarks are unreliable, the worker falls back to face-presence monitoring.
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Any, Sequence

# (corner A, corner B, upper lid, lower lid, iris centre)
EYE_SPECS: tuple[tuple[int, int, int, int, int], ...] = (
    (33, 133, 159, 145, 468),
    (362, 263, 386, 374, 473),
)

MIN_EYE_OPENNESS = 0.13
MIN_CALIBRATION_SAMPLES = 12
MAX_CALIBRATION_NOISE = 0.09
MIN_HORIZONTAL_THRESHOLD = 0.16
MAX_HORIZONTAL_THRESHOLD = 0.30
MIN_VERTICAL_THRESHOLD = 0.14
MAX_VERTICAL_THRESHOLD = 0.28
DEFAULT_SMOOTHING_ALPHA = 0.22
DEFAULT_AWAY_DEBOUNCE_SECONDS = 1.0
DEFAULT_RETURN_DEBOUNCE_SECONDS = 0.9
HYSTERESIS_MARGIN = 0.02
RETURN_FRACTION = 0.7


@dataclass(frozen=True)
class EyeMetrics:
    """Iris position normalized inside the eye aperture."""

    horizontal: float
    vertical: float
    openness: float


@dataclass(frozen=True)
class GazeCalibration:
    horizontal: float
    vertical: float
    threshold_horizontal: float
    threshold_vertical: float
    sample_count: int


@dataclass(frozen=True)
class GazeObservation:
    available: bool
    looking_away: bool
    horizontal_offset: float
    vertical_offset: float


def _clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def _eye_metrics(
    landmarks: Sequence[Any],
    corner_a: int,
    corner_b: int,
    upper: int,
    lower: int,
    iris: int,
) -> EyeMetrics | None:
    if len(landmarks) <= max(corner_a, corner_b, upper, lower, iris):
        return None

    a = landmarks[corner_a]
    b = landmarks[corner_b]
    upper_lid = landmarks[upper]
    lower_lid = landmarks[lower]
    iris_centre = landmarks[iris]

    width = abs(b.x - a.x)
    height = abs(lower_lid.y - upper_lid.y)
    if width <= 1e-6 or height <= 1e-6:
        return None

    openness = height / width
    if openness < MIN_EYE_OPENNESS:
        return None

    horizontal = (iris_centre.x - min(a.x, b.x)) / width
    vertical = (iris_centre.y - min(upper_lid.y, lower_lid.y)) / height

    # Extreme head angles can push an iris outside the eyelid box. Treat that
    # as unreliable instead of producing a wild gaze value.
    if not (0.02 <= horizontal <= 0.98 and -0.25 <= vertical <= 1.25):
        return None

    return EyeMetrics(
        horizontal=_clamp(horizontal, 0.0, 1.0),
        vertical=_clamp(vertical, 0.0, 1.0),
        openness=openness,
    )


def extract_eye_metrics(landmarks: Sequence[Any] | None) -> EyeMetrics | None:
    """Average iris metrics from both eyes, skipping closed or invalid eyes."""
    if not landmarks:
        return None

    metrics = [
        eye
        for eye in (
            _eye_metrics(landmarks, *spec)
            for spec in EYE_SPECS
        )
        if eye is not None
    ]
    if not metrics:
        return None

    return EyeMetrics(
        horizontal=sum(eye.horizontal for eye in metrics) / len(metrics),
        vertical=sum(eye.vertical for eye in metrics) / len(metrics),
        openness=sum(eye.openness for eye in metrics) / len(metrics),
    )


def median_absolute_deviation(values: Sequence[float], centre: float) -> float:
    return median(abs(value - centre) for value in values) if values else 0.0


class CalibrationCollector:
    """Collects centre-screen iris samples during the calibration phase."""

    def __init__(self, minimum_samples: int = MIN_CALIBRATION_SAMPLES) -> None:
        self.minimum_samples = minimum_samples
        self._horizontal: list[float] = []
        self._vertical: list[float] = []

    @property
    def sample_count(self) -> int:
        return len(self._horizontal)

    def add(self, metrics: EyeMetrics | None) -> None:
        if metrics is None:
            return
        self._horizontal.append(metrics.horizontal)
        self._vertical.append(metrics.vertical)

    def finish(self) -> GazeCalibration | None:
        if self.sample_count < self.minimum_samples:
            return None

        horizontal = median(self._horizontal)
        vertical = median(self._vertical)
        noise_h = median_absolute_deviation(self._horizontal, horizontal)
        noise_v = median_absolute_deviation(self._vertical, vertical)
        noise = max(noise_h, noise_v)

        # A moving head or unstable landmarks make the baseline meaningless.
        if noise > MAX_CALIBRATION_NOISE:
            return None

        threshold_h = _clamp(
            max(MIN_HORIZONTAL_THRESHOLD, 4.5 * noise_h),
            MIN_HORIZONTAL_THRESHOLD,
            MAX_HORIZONTAL_THRESHOLD,
        )
        threshold_v = _clamp(
            max(MIN_VERTICAL_THRESHOLD, 4.5 * noise_v),
            MIN_VERTICAL_THRESHOLD,
            MAX_VERTICAL_THRESHOLD,
        )

        return GazeCalibration(
            horizontal=horizontal,
            vertical=vertical,
            threshold_horizontal=threshold_h,
            threshold_vertical=threshold_v,
            sample_count=self.sample_count,
        )


class GazeEstimator:
    """Smoothes iris offsets and debounces away/back gaze transitions."""

    def __init__(
        self,
        calibration: GazeCalibration,
        smoothing_alpha: float = DEFAULT_SMOOTHING_ALPHA,
        away_debounce_seconds: float = DEFAULT_AWAY_DEBOUNCE_SECONDS,
        return_debounce_seconds: float = DEFAULT_RETURN_DEBOUNCE_SECONDS,
    ) -> None:
        self.calibration = calibration
        self.smoothing_alpha = _clamp(smoothing_alpha, 0.05, 1.0)
        self.away_debounce_seconds = away_debounce_seconds
        self.return_debounce_seconds = return_debounce_seconds
        self._smoothed_horizontal = calibration.horizontal
        self._smoothed_vertical = calibration.vertical
        self._has_sample = False
        self._looking_away = False
        self._away_candidate_since: float | None = None
        self._return_candidate_since: float | None = None

    @property
    def looking_away(self) -> bool:
        return self._looking_away

    def reset_tracking(self) -> None:
        """Drop transient state while keeping the calibrated baseline."""
        self._smoothed_horizontal = self.calibration.horizontal
        self._smoothed_vertical = self.calibration.vertical
        self._has_sample = False
        self._looking_away = False
        self._away_candidate_since = None
        self._return_candidate_since = None

    def update(self, metrics: EyeMetrics | None, now: float) -> GazeObservation:
        if metrics is None:
            # Blinks and brief landmark dropouts should not flip gaze state.
            return self._observation()

        alpha = self.smoothing_alpha
        if not self._has_sample:
            self._smoothed_horizontal = metrics.horizontal
            self._smoothed_vertical = metrics.vertical
            self._has_sample = True
        else:
            self._smoothed_horizontal += alpha * (
                metrics.horizontal - self._smoothed_horizontal
            )
            self._smoothed_vertical += alpha * (
                metrics.vertical - self._smoothed_vertical
            )

        horizontal_offset = (
            self._smoothed_horizontal - self.calibration.horizontal
        )
        vertical_offset = self._smoothed_vertical - self.calibration.vertical
        threshold_h = self.calibration.threshold_horizontal
        threshold_v = self.calibration.threshold_vertical

        clearly_away = (
            abs(horizontal_offset) > threshold_h + HYSTERESIS_MARGIN
            or abs(vertical_offset) > threshold_v + HYSTERESIS_MARGIN
        )
        clearly_back = (
            abs(horizontal_offset) <= threshold_h * RETURN_FRACTION
            and abs(vertical_offset) <= threshold_v * RETURN_FRACTION
        )

        if clearly_away:
            self._return_candidate_since = None
            if self._away_candidate_since is None:
                self._away_candidate_since = now
            if now - self._away_candidate_since >= self.away_debounce_seconds:
                self._looking_away = True
        elif clearly_back:
            self._away_candidate_since = None
            if self._return_candidate_since is None:
                self._return_candidate_since = now
            if now - self._return_candidate_since >= self.return_debounce_seconds:
                self._looking_away = False
        else:
            # Inside the hysteresis band: keep the current state but reset
            # candidate timers so a borderline value can never accumulate.
            self._away_candidate_since = None
            self._return_candidate_since = None

        return self._observation()

    def _observation(self) -> GazeObservation:
        return GazeObservation(
            available=True,
            looking_away=self._looking_away,
            horizontal_offset=self._smoothed_horizontal
            - self.calibration.horizontal,
            vertical_offset=self._smoothed_vertical - self.calibration.vertical,
        )
