from __future__ import annotations

import unittest

from vision.attention_monitor import AttentionMonitor, AttentionSettings


def make_monitor(
    absence_seconds: float = 120.0,
    cooldown_seconds: float = 300.0,
    gaze_seconds: float = 180.0,
) -> AttentionMonitor:
    return AttentionMonitor(
        AttentionSettings(
            absence_seconds=absence_seconds,
            gaze_seconds=gaze_seconds,
            cooldown_seconds=cooldown_seconds,
        ),
        started_at=0.0,
    )


class FaceAbsenceTests(unittest.TestCase):
    def test_grace_window_hides_brief_detector_misses(self) -> None:
        monitor = make_monitor()

        at_start = monitor.update(0.0, False)
        self.assertTrue(at_start.face_present)
        self.assertEqual(at_start.absence_seconds, 0.0)

        within_grace = monitor.update(2.0, False)
        self.assertTrue(within_grace.face_present)

        after_grace = monitor.update(2.1, False)
        self.assertFalse(after_grace.face_present)
        self.assertAlmostEqual(after_grace.absence_seconds, 2.1)

    def test_reminder_is_not_due_before_threshold(self) -> None:
        monitor = make_monitor()
        monitor.update(0.0, True)

        update = monitor.update(119.9, False)

        self.assertFalse(update.face_present)
        self.assertFalse(update.reminder_due)
        self.assertEqual(update.reminder_count, 0)

    def test_reminder_is_due_once_at_threshold(self) -> None:
        monitor = make_monitor()
        monitor.update(0.0, True)

        at_threshold = monitor.update(120.0, False)
        later = monitor.update(121.0, False)
        much_later = monitor.update(600.0, False)

        self.assertTrue(at_threshold.reminder_due)
        self.assertEqual(at_threshold.reminder_kind, "away")
        self.assertEqual(at_threshold.reminder_count, 1)
        self.assertFalse(later.reminder_due)
        self.assertFalse(much_later.reminder_due)
        self.assertEqual(much_later.reminder_count, 1)

    def test_face_return_resets_absence_timer(self) -> None:
        monitor = make_monitor()
        monitor.update(0.0, True)
        monitor.update(120.0, False)  # reminder due
        monitor.update(150.0, True)  # face returns

        update = monitor.update(151.0, False)
        self.assertTrue(update.face_present)
        self.assertEqual(update.absence_seconds, 0.0)

        after_grace = monitor.update(156.0, False)
        self.assertFalse(after_grace.face_present)
        self.assertFalse(after_grace.reminder_due)
        self.assertAlmostEqual(after_grace.absence_seconds, 6.0)

    def test_cooldown_suppresses_reminder_for_next_episode(self) -> None:
        monitor = make_monitor()
        monitor.update(0.0, True)
        first = monitor.update(120.0, False)
        self.assertTrue(first.reminder_due)

        monitor.update(121.0, True)
        suppressed = monitor.update(121.0 + 120.0, False)
        self.assertFalse(suppressed.reminder_due)

        # It must not fire late while the user is still away.
        still_away = monitor.update(700.0, False)
        self.assertFalse(still_away.reminder_due)
        self.assertEqual(still_away.reminder_count, 1)

    def test_new_reminder_after_cooldown_and_new_episode(self) -> None:
        monitor = make_monitor()
        monitor.update(0.0, True)
        first = monitor.update(120.0, False)
        self.assertTrue(first.reminder_due)

        monitor.update(400.0, True)  # face returns after cooldown
        second = monitor.update(520.0, False)  # new absence threshold

        self.assertTrue(second.reminder_due)
        self.assertEqual(second.reminder_kind, "away")
        self.assertEqual(second.reminder_count, 2)

    def test_reminder_does_not_fire_while_face_present(self) -> None:
        monitor = make_monitor(absence_seconds=5.0)
        for second in range(10):
            update = monitor.update(float(second), True)
            self.assertFalse(update.reminder_due)


class GazeAwayTests(unittest.TestCase):
    def test_focus_reminder_is_due_after_continuous_gaze_away(self) -> None:
        monitor = make_monitor(gaze_seconds=180)

        monitor.update(0.0, True, gaze_available=True, gaze_away=False)
        monitor.update(10.0, True, gaze_available=True, gaze_away=True)

        before = monitor.update(189.0, True, gaze_available=True, gaze_away=True)
        self.assertFalse(before.reminder_due)
        self.assertAlmostEqual(before.gaze_away_seconds, 179.0)

        at_threshold = monitor.update(
            190.0, True, gaze_available=True, gaze_away=True
        )
        self.assertTrue(at_threshold.reminder_due)
        self.assertEqual(at_threshold.reminder_kind, "focus")
        self.assertTrue(at_threshold.gaze_away)
        self.assertEqual(at_threshold.reminder_count, 1)

        later = monitor.update(250.0, True, gaze_available=True, gaze_away=True)
        self.assertFalse(later.reminder_due)

    def test_looking_back_resets_gaze_away_timer(self) -> None:
        monitor = make_monitor(gaze_seconds=180)

        monitor.update(0.0, True, True, True)  # start away
        monitor.update(170.0, True, True, False)  # back on screen

        back = monitor.update(180.0, True, True, True)
        self.assertAlmostEqual(back.gaze_away_seconds, 0.0)
        self.assertFalse(back.reminder_due)

        threshold = monitor.update(190.0, True, True, True)
        self.assertAlmostEqual(threshold.gaze_away_seconds, 10.0)
        self.assertFalse(threshold.reminder_due)

        not_yet = monitor.update(359.0, True, True, True)
        self.assertFalse(not_yet.reminder_due)
        due = monitor.update(360.0, True, True, True)
        self.assertTrue(due.reminder_due)
        self.assertEqual(due.reminder_kind, "focus")

    def test_gaze_unavailable_does_not_advance_timer(self) -> None:
        monitor = make_monitor(gaze_seconds=5)

        monitor.update(0.0, True, gaze_available=True, gaze_away=True)
        for second in range(1, 10):
            update = monitor.update(
                float(second), True, gaze_available=False, gaze_away=True
            )
            self.assertFalse(update.reminder_due)
            self.assertFalse(update.gaze_away)
            self.assertEqual(update.gaze_away_seconds, 0.0)

    def test_face_absence_resets_gaze_timer(self) -> None:
        monitor = make_monitor(gaze_seconds=10)

        monitor.update(0.0, True, True, True)
        monitor.update(100.0, False, True, True)  # face gone
        monitor.update(200.0, True, True, True)  # face returns looking away

        returned = monitor.update(200.0, True, True, True)
        self.assertAlmostEqual(returned.gaze_away_seconds, 0.0)

        after = monitor.update(209.0, True, True, True)
        self.assertFalse(after.reminder_due)
        self.assertAlmostEqual(after.gaze_away_seconds, 9.0)

    def test_shared_cooldown_suppresses_focus_reminder(self) -> None:
        monitor = make_monitor(absence_seconds=120, gaze_seconds=180)

        monitor.update(0.0, True)
        away = monitor.update(120.0, False)
        self.assertTrue(away.reminder_due)
        self.assertEqual(away.reminder_kind, "away")

        monitor.update(121.0, True, True, True)
        suppressed = monitor.update(301.0, True, True, True)
        self.assertFalse(suppressed.reminder_due)
        self.assertEqual(suppressed.reminder_count, 1)

        still_away = monitor.update(700.0, True, True, True)
        self.assertFalse(still_away.reminder_due)
        self.assertEqual(still_away.reminder_count, 1)

        monitor.update(800.0, True, True, False)
        monitor.update(810.0, True, True, True)
        second = monitor.update(990.0, True, True, True)
        self.assertTrue(second.reminder_due)
        self.assertEqual(second.reminder_kind, "focus")
        self.assertEqual(second.reminder_count, 2)

    def test_gaze_threshold_never_fires_while_face_absent(self) -> None:
        monitor = make_monitor(absence_seconds=1000, gaze_seconds=5)

        monitor.update(0.0, False, True, True)
        for second in range(1, 12):
            update = monitor.update(float(second), False, True, True)
            self.assertFalse(update.reminder_due)


class SettingsValidationTests(unittest.TestCase):
    def test_settings_validation(self) -> None:
        with self.assertRaises(ValueError):
            AttentionSettings(absence_seconds=0)
        with self.assertRaises(ValueError):
            AttentionSettings(gaze_seconds=0)
        with self.assertRaises(ValueError):
            AttentionSettings(cooldown_seconds=-1)
        with self.assertRaises(ValueError):
            AttentionSettings(presence_grace_seconds=-1)


if __name__ == "__main__":
    unittest.main()
