"""Pure attention state machine for face-presence and gaze monitoring.

No camera or MediaPipe dependency lives here, so timing rules can be tested
deterministically. Face absence and gaze-away episodes share one reminder
cooldown so the user is never interrupted twice in quick succession.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

ReminderKind = Literal["away", "focus"]


@dataclass(frozen=True)
class AttentionSettings:
    """Timing configuration shared by face and gaze monitoring."""

    absence_seconds: float = 120.0
    gaze_seconds: float = 180.0
    cooldown_seconds: float = 300.0
    presence_grace_seconds: float = 2.0

    def __post_init__(self) -> None:
        if not math.isfinite(self.absence_seconds) or self.absence_seconds <= 0:
            raise ValueError("absence_seconds must be a positive number")
        if not math.isfinite(self.gaze_seconds) or self.gaze_seconds <= 0:
            raise ValueError("gaze_seconds must be a positive number")
        if not math.isfinite(self.cooldown_seconds) or self.cooldown_seconds < 0:
            raise ValueError("cooldown_seconds must be zero or positive")
        if (
            not math.isfinite(self.presence_grace_seconds)
            or self.presence_grace_seconds < 0
        ):
            raise ValueError("presence_grace_seconds must be zero or positive")


@dataclass(frozen=True)
class AttentionUpdate:
    face_present: bool
    absence_seconds: float
    gaze_available: bool
    gaze_away: bool
    gaze_away_seconds: float
    reminder_due: bool
    reminder_kind: ReminderKind | None
    reminder_count: int


class AttentionMonitor:
    """Tracks face absence and gaze-away episodes.

    Rules:
    - A face is treated as present during a short grace window to absorb
      detector flicker.
    - Face absence is measured from the last confirmed detection.
    - Gaze-away time only advances while a face is present and gaze estimation
      is available. Brief blink frames are handled by the gaze estimator.
    - At most one reminder is raised per away or gaze-away episode.
    - All reminders share one cooldown. If a threshold is crossed during the
      cooldown, that episode is marked handled and no delayed reminder fires.
    - Returning attention resets the matching episode.
    """

    def __init__(self, settings: AttentionSettings, started_at: float) -> None:
        self.settings = settings
        self._last_face_seen = started_at
        self._last_reminder_at = float("-inf")
        self._absence_reminder_sent = False
        self._gaze_reminder_sent = False
        self._gaze_away_since: float | None = None
        self._reminder_count = 0

    @property
    def reminder_count(self) -> int:
        return self._reminder_count

    def update(
        self,
        now: float,
        face_detected: bool,
        gaze_available: bool = False,
        gaze_away: bool = False,
    ) -> AttentionUpdate:
        if face_detected:
            self._last_face_seen = now
            self._absence_reminder_sent = False

        since_face = max(0.0, now - self._last_face_seen)
        face_present = (
            face_detected or since_face <= self.settings.presence_grace_seconds
        )
        absence_seconds = 0.0 if face_present else since_face

        gaze_active = bool(face_present and gaze_available and gaze_away)
        if gaze_active:
            if self._gaze_away_since is None:
                self._gaze_away_since = now
            gaze_away_seconds = max(0.0, now - self._gaze_away_since)
        else:
            self._gaze_away_since = None
            self._gaze_reminder_sent = False
            gaze_away_seconds = 0.0

        reminder_kind: ReminderKind | None = None

        # Face absence takes precedence: if the user is not there, an away
        # reminder is more appropriate than a gaze reminder.
        if (
            not face_present
            and absence_seconds >= self.settings.absence_seconds
            and not self._absence_reminder_sent
        ):
            # Mark handled even when cooldown suppresses the notification, so
            # no delayed reminder appears later in the same episode.
            self._absence_reminder_sent = True
            if now - self._last_reminder_at >= self.settings.cooldown_seconds:
                reminder_kind = "away"

        if (
            reminder_kind is None
            and gaze_active
            and gaze_available
            and gaze_away_seconds >= self.settings.gaze_seconds
            and not self._gaze_reminder_sent
        ):
            self._gaze_reminder_sent = True
            if now - self._last_reminder_at >= self.settings.cooldown_seconds:
                reminder_kind = "focus"

        if reminder_kind is not None:
            self._last_reminder_at = now
            self._reminder_count += 1

        return AttentionUpdate(
            face_present=face_present,
            absence_seconds=absence_seconds,
            gaze_available=gaze_available,
            gaze_away=gaze_active,
            gaze_away_seconds=gaze_away_seconds,
            reminder_due=reminder_kind is not None,
            reminder_kind=reminder_kind,
            reminder_count=self._reminder_count,
        )
