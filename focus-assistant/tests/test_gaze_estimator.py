from __future__ import annotations

import unittest

from vision.gaze_estimator import (
    CalibrationCollector,
    EyeMetrics,
    GazeCalibration,
    GazeEstimator,
    extract_eye_metrics,
)


class Point:
    def __init__(self, x: float, y: float) -> None:
        self.x = x
        self.y = y


def make_landmarks(
    horizontal: float = 0.5,
    vertical: float = 0.5,
    eye_height: float = 0.08,
) -> list[Point]:
    points = [Point(0.5, 0.5) for _ in range(478)]

    # First eye: corners at x=0.30/0.50, iris travels within the aperture.
    points[33] = Point(0.30, 0.50)
    points[133] = Point(0.50, 0.50)
    points[159] = Point(0.40, 0.50 - eye_height / 2)
    points[145] = Point(0.40, 0.50 + eye_height / 2)
    points[468] = Point(
        0.30 + horizontal * 0.20,
        (0.50 - eye_height / 2) + vertical * eye_height,
    )

    # Second eye: corners at x=0.60/0.80.
    points[362] = Point(0.60, 0.50)
    points[263] = Point(0.80, 0.50)
    points[386] = Point(0.70, 0.50 - eye_height / 2)
    points[374] = Point(0.70, 0.50 + eye_height / 2)
    points[473] = Point(
        0.60 + horizontal * 0.20,
        (0.50 - eye_height / 2) + vertical * eye_height,
    )

    return points


def calibration(
    threshold_horizontal: float = 0.16,
    threshold_vertical: float = 0.14,
) -> GazeCalibration:
    return GazeCalibration(
        horizontal=0.5,
        vertical=0.5,
        threshold_horizontal=threshold_horizontal,
        threshold_vertical=threshold_vertical,
        sample_count=20,
    )


class EyeMetricsTests(unittest.TestCase):
    def test_extracts_centred_iris_metrics(self) -> None:
        metrics = extract_eye_metrics(make_landmarks(0.5, 0.5))

        self.assertIsNotNone(metrics)
        assert metrics is not None
        self.assertAlmostEqual(metrics.horizontal, 0.5)
        self.assertAlmostEqual(metrics.vertical, 0.5)
        self.assertAlmostEqual(metrics.openness, 0.4)

    def test_returns_none_for_closed_eyes(self) -> None:
        self.assertIsNone(extract_eye_metrics(make_landmarks(eye_height=0.01)))

    def test_uses_the_open_eye_when_one_is_closed(self) -> None:
        points = make_landmarks(0.7, 0.5)
        points[386] = Point(0.70, 0.499)
        points[374] = Point(0.70, 0.501)

        metrics = extract_eye_metrics(points)
        self.assertIsNotNone(metrics)
        assert metrics is not None
        self.assertAlmostEqual(metrics.horizontal, 0.7)

    def test_returns_none_for_missing_landmarks(self) -> None:
        self.assertIsNone(extract_eye_metrics(None))
        self.assertIsNone(extract_eye_metrics(make_landmarks()[:100]))


class CalibrationTests(unittest.TestCase):
    def test_computes_stable_centre_baseline(self) -> None:
        collector = CalibrationCollector(minimum_samples=5)
        for index in range(20):
            collector.add(
                EyeMetrics(
                    horizontal=0.5 + 0.003 * ((index % 3) - 1),
                    vertical=0.5,
                    openness=0.4,
                )
            )

        result = collector.finish()
        self.assertIsNotNone(result)
        assert result is not None
        self.assertAlmostEqual(result.horizontal, 0.5, places=3)
        self.assertAlmostEqual(result.vertical, 0.5, places=3)
        self.assertGreaterEqual(result.threshold_horizontal, 0.16)
        self.assertGreaterEqual(result.threshold_vertical, 0.14)
        self.assertEqual(result.sample_count, 20)

    def test_rejects_too_few_samples(self) -> None:
        collector = CalibrationCollector(minimum_samples=10)
        collector.add(EyeMetrics(0.5, 0.5, 0.4))
        self.assertIsNone(collector.finish())

    def test_rejects_unstable_calibration(self) -> None:
        collector = CalibrationCollector(minimum_samples=5)
        for index in range(20):
            collector.add(
                EyeMetrics(0.2 if index % 2 else 0.8, 0.5, 0.4)
            )
        self.assertIsNone(collector.finish())


class GazeEstimatorTests(unittest.TestCase):
    def test_debounces_into_away_state(self) -> None:
        estimator = GazeEstimator(calibration(), smoothing_alpha=1.0)

        estimator.update(EyeMetrics(0.5, 0.5, 0.4), 0.0)
        estimator.update(EyeMetrics(0.8, 0.5, 0.4), 1.0)
        still_here = estimator.update(EyeMetrics(0.8, 0.5, 0.4), 1.5)
        away = estimator.update(EyeMetrics(0.8, 0.5, 0.4), 2.1)

        self.assertFalse(still_here.looking_away)
        self.assertTrue(away.looking_away)
        self.assertAlmostEqual(away.horizontal_offset, 0.3)

    def test_debounces_back_to_screen(self) -> None:
        estimator = GazeEstimator(calibration(), smoothing_alpha=1.0)
        for now, horizontal in ((0.0, 0.5), (1.0, 0.8), (2.1, 0.8)):
            estimator.update(EyeMetrics(horizontal, 0.5, 0.4), now)
        self.assertTrue(estimator.looking_away)

        estimator.update(EyeMetrics(0.5, 0.5, 0.4), 3.0)
        not_back_yet = estimator.update(EyeMetrics(0.5, 0.5, 0.4), 3.5)
        back = estimator.update(EyeMetrics(0.5, 0.5, 0.4), 3.95)

        self.assertTrue(not_back_yet.looking_away)
        self.assertFalse(back.looking_away)

    def test_short_spike_does_not_trigger_away(self) -> None:
        estimator = GazeEstimator(calibration(), smoothing_alpha=1.0)
        estimator.update(EyeMetrics(0.5, 0.5, 0.4), 0.0)
        estimator.update(EyeMetrics(0.8, 0.5, 0.4), 1.0)
        estimator.update(EyeMetrics(0.5, 0.5, 0.4), 1.4)

        self.assertFalse(estimator.looking_away)

    def test_none_metrics_keep_current_state(self) -> None:
        estimator = GazeEstimator(calibration(), smoothing_alpha=1.0)
        estimator.update(EyeMetrics(0.8, 0.5, 0.4), 0.0)
        estimator.update(EyeMetrics(0.8, 0.5, 0.4), 1.5)
        away = estimator.update(None, 2.0)

        self.assertTrue(away.looking_away)

    def test_smoothing_ignores_a_single_outlier(self) -> None:
        estimator = GazeEstimator(
            calibration(threshold_horizontal=0.18),
            smoothing_alpha=0.2,
        )
        estimator.update(EyeMetrics(0.5, 0.5, 0.4), 0.0)
        estimator.update(EyeMetrics(0.95, 0.5, 0.4), 0.1)
        observation = estimator.update(EyeMetrics(0.5, 0.5, 0.4), 0.2)

        self.assertFalse(observation.looking_away)
        self.assertLess(abs(observation.horizontal_offset), 0.18)

    def test_vertical_gaze_is_detected(self) -> None:
        estimator = GazeEstimator(calibration(), smoothing_alpha=1.0)
        estimator.update(EyeMetrics(0.5, 0.5, 0.4), 0.0)
        estimator.update(EyeMetrics(0.5, 0.9, 0.4), 1.0)
        result = estimator.update(EyeMetrics(0.5, 0.9, 0.4), 2.1)

        self.assertTrue(result.looking_away)

    def test_reset_tracking_keeps_calibration(self) -> None:
        estimator = GazeEstimator(calibration(), smoothing_alpha=1.0)
        estimator.update(EyeMetrics(0.8, 0.5, 0.4), 0.0)
        estimator.update(EyeMetrics(0.8, 0.5, 0.4), 2.0)
        self.assertTrue(estimator.looking_away)

        estimator.reset_tracking()
        result = estimator.update(EyeMetrics(0.5, 0.5, 0.4), 3.0)

        self.assertFalse(result.looking_away)
        self.assertAlmostEqual(estimator.calibration.horizontal, 0.5)


if __name__ == "__main__":
    unittest.main()
