"""Local vision worker for Focus.

The worker opens the camera itself, runs MediaPipe face/iris landmark detection
locally, calibrates a centre-screen gaze baseline, and writes newline-delimited
JSON events to stdout. It never records or uploads frames. The Tauri shell owns
the process lifecycle and starts/stops it around a focus session.
"""

from __future__ import annotations

import argparse
import json
import signal
import sys
import threading
import time
import traceback
from pathlib import Path
from typing import Any

import cv2

from .attention_monitor import AttentionMonitor, AttentionSettings
from .camera import Camera, CameraError
from .face_detector import FaceDetector, FaceDetectorError
from .gaze_estimator import (
    CalibrationCollector,
    GazeEstimator,
    extract_eye_metrics,
)

DEFAULT_MODEL = Path(__file__).resolve().parent / "models" / "face_landmarker.task"
DEFAULT_FPS = 10.0
DEFAULT_CALIBRATION_SECONDS = 3.0
GAZE_RELIABILITY_TIMEOUT_SECONDS = 8.0
CALIBRATION_EVENT_INTERVAL = 0.25


def emit(payload: dict[str, Any]) -> None:
    """Write one protocol event to the parent process."""
    try:
        print(json.dumps(payload, separators=(",", ":")), flush=True)
    except (BrokenPipeError, OSError):
        # The parent window may have closed while a detection pass was running.
        pass


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Focus local vision worker")
    parser.add_argument("--camera", type=int, default=0, help="Camera index")
    parser.add_argument(
        "--absence-seconds",
        type=float,
        default=120.0,
        help="Seconds without a face before an away reminder is due",
    )
    parser.add_argument(
        "--gaze-seconds",
        type=float,
        default=180.0,
        help="Seconds looking away before a focus reminder is due",
    )
    parser.add_argument(
        "--cooldown-seconds",
        type=float,
        default=300.0,
        help="Minimum seconds between reminders",
    )
    parser.add_argument(
        "--calibration-seconds",
        type=float,
        default=DEFAULT_CALIBRATION_SECONDS,
        help="Duration of the centre-screen gaze calibration",
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=DEFAULT_MODEL,
        help="Path to the MediaPipe face_landmarker.task model",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=DEFAULT_FPS,
        help="Detection passes per second",
    )
    args = parser.parse_args(argv)

    if args.camera < 0:
        parser.error("--camera must be zero or greater")
    if args.absence_seconds <= 0:
        parser.error("--absence-seconds must be positive")
    if args.gaze_seconds <= 0:
        parser.error("--gaze-seconds must be positive")
    if args.cooldown_seconds < 0:
        parser.error("--cooldown-seconds must be zero or positive")
    if args.calibration_seconds < 1 or args.calibration_seconds > 10:
        parser.error("--calibration-seconds must be between 1 and 10")
    if args.fps <= 0 or args.fps > 30:
        parser.error("--fps must be between 0 and 30")

    return args


def watch_stdin(stop_event: threading.Event) -> None:
    """Stop cleanly when the parent asks, or when the parent pipe closes."""
    try:
        for line in sys.stdin:
            try:
                command = json.loads(line)
            except json.JSONDecodeError:
                continue
            if command.get("type") == "stop":
                break
    finally:
        stop_event.set()


def install_signal_handlers(stop_event: threading.Event) -> None:
    def handle(_signum: int, _frame: object) -> None:
        stop_event.set()

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)


def calibration_failure_reason(
    sample_count: int, minimum_samples: int
) -> str:
    if sample_count < minimum_samples:
        return (
            "Calibration could not see your eyes clearly. "
            "Using face presence only."
        )
    return "Calibration was not steady enough. Using face presence only."


def run(args: argparse.Namespace, stop_event: threading.Event) -> int:
    detector: FaceDetector | None = None
    camera: Camera | None = None

    try:
        detector = FaceDetector(args.model)
        camera = Camera(index=args.camera)
        camera.open()
        started_at = time.monotonic()
        monitor = AttentionMonitor(
            AttentionSettings(
                absence_seconds=args.absence_seconds,
                gaze_seconds=args.gaze_seconds,
                cooldown_seconds=args.cooldown_seconds,
            ),
            started_at=started_at,
        )

        minimum_samples = max(
            8, int(args.calibration_seconds * args.fps * 0.35)
        )
        collector = CalibrationCollector(minimum_samples=minimum_samples)
        calibration_started_at = time.monotonic()
        calibration_active = True
        last_calibration_emit = 0.0
        gaze_estimator: GazeEstimator | None = None
        gaze_available = False
        gaze_reason = "Calibration in progress."
        last_gaze_valid_at: float | None = None

        emit(
            {
                "type": "ready",
                "camera": args.camera,
                "absenceThresholdSeconds": args.absence_seconds,
                "gazeThresholdSeconds": args.gaze_seconds,
                "cooldownSeconds": args.cooldown_seconds,
                "calibrationSeconds": args.calibration_seconds,
            }
        )

        frame_interval = 1.0 / args.fps
        last_status_at = 0.0
        force_status = False

        while not stop_event.is_set():
            loop_started = time.monotonic()
            frame = camera.read()
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            now = time.monotonic()

            observation = detector.detect(rgb_frame, int(now * 1000))
            metrics = (
                extract_eye_metrics(observation.landmarks)
                if observation.present
                else None
            )

            if calibration_active:
                if metrics is not None:
                    collector.add(metrics)

                progress = min(
                    1.0,
                    max(
                        0.0,
                        (now - calibration_started_at)
                        / args.calibration_seconds,
                    ),
                )
                if (
                    now - last_calibration_emit >= CALIBRATION_EVENT_INTERVAL
                    or progress >= 1.0
                ):
                    emit(
                        {
                            "type": "calibration",
                            "progress": round(progress, 3),
                            "facePresent": observation.present,
                            "sampleCount": collector.sample_count,
                        }
                    )
                    last_calibration_emit = now

                if progress >= 1.0:
                    result = collector.finish()
                    calibration_active = False
                    if result is not None:
                        gaze_estimator = GazeEstimator(result)
                        gaze_available = True
                        gaze_reason = ""
                        last_gaze_valid_at = now
                        emit(
                            {
                                "type": "calibrated",
                                "enabled": True,
                                "sampleCount": result.sample_count,
                                "facePresent": observation.present,
                            }
                        )
                    else:
                        gaze_available = False
                        gaze_reason = calibration_failure_reason(
                            collector.sample_count, minimum_samples
                        )
                        emit(
                            {
                                "type": "calibrated",
                                "enabled": False,
                                "reason": gaze_reason,
                                "sampleCount": collector.sample_count,
                                "facePresent": observation.present,
                            }
                        )
                    force_status = True

            gaze_away = False
            if not calibration_active:
                if not observation.present:
                    if gaze_estimator is not None:
                        gaze_estimator.reset_tracking()
                    last_gaze_valid_at = None
                elif gaze_available and gaze_estimator is not None:
                    if metrics is not None:
                        gaze_observation = gaze_estimator.update(metrics, now)
                        gaze_away = gaze_observation.looking_away
                        last_gaze_valid_at = now
                    else:
                        # A blink or brief landmark miss should hold the last
                        # state; a long run of misses disables gaze and falls
                        # back to face presence.
                        gaze_observation = gaze_estimator.update(None, now)
                        gaze_away = gaze_observation.looking_away
                        if (
                            last_gaze_valid_at is not None
                            and now - last_gaze_valid_at
                            > GAZE_RELIABILITY_TIMEOUT_SECONDS
                        ):
                            gaze_available = False
                            gaze_reason = (
                                "Iris landmarks are not reliable right now. "
                                "Using face presence only."
                            )
                            gaze_estimator.reset_tracking()
                            gaze_away = False
                            force_status = True

            update = monitor.update(
                now,
                observation.present,
                gaze_available=gaze_available,
                gaze_away=gaze_away,
            )

            if update.reminder_due:
                if update.reminder_kind == "away":
                    trigger_seconds = update.absence_seconds
                else:
                    trigger_seconds = update.gaze_away_seconds
                emit(
                    {
                        "type": "reminder",
                        "kind": update.reminder_kind,
                        "seconds": round(trigger_seconds, 1),
                        "reminderCount": update.reminder_count,
                    }
                )

            if not calibration_active and (
                force_status or now - last_status_at >= 1.0
            ):
                emit(
                    {
                        "type": "status",
                        "facePresent": update.face_present,
                        "absenceSeconds": round(update.absence_seconds, 1),
                        "gazeAvailable": update.gaze_available,
                        "gazeAway": update.gaze_away,
                        "gazeAwaySeconds": round(update.gaze_away_seconds, 1),
                        "gazeReason": gaze_reason,
                        "reminderCount": update.reminder_count,
                    }
                )
                last_status_at = now
                force_status = False

            elapsed = time.monotonic() - loop_started
            remaining = frame_interval - elapsed
            if remaining > 0:
                stop_event.wait(remaining)

        return 0

    except CameraError as exc:
        emit({"type": "error", "code": "camera_unavailable", "message": str(exc)})
        return 1
    except FaceDetectorError as exc:
        emit({"type": "error", "code": "model_unavailable", "message": str(exc)})
        return 1
    except Exception as exc:  # noqa: BLE001 - keep the worker clean on failure
        traceback.print_exc(file=sys.stderr)
        emit(
            {
                "type": "error",
                "code": "vision_failure",
                "message": f"Vision worker stopped unexpectedly: {exc}",
            }
        )
        return 1
    finally:
        if camera is not None:
            camera.release()
        if detector is not None:
            detector.close()
        emit({"type": "stopped"})


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    stop_event = threading.Event()
    install_signal_handlers(stop_event)
    stdin_thread = threading.Thread(
        target=watch_stdin,
        args=(stop_event,),
        name="stdin-watcher",
        daemon=True,
    )
    stdin_thread.start()
    return run(args, stop_event)


if __name__ == "__main__":
    raise SystemExit(main())
