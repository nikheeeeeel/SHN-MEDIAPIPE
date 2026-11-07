# Face Landmarker model

`face_landmarker.task` is the MediaPipe Face Landmarker model used by the local
vision worker.

- Source: <https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task>
- Model card / documentation: <https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker>
- SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`

The model is bundled so the application can process frames entirely offline.
Only detection results (a face-present boolean and timing statistics) leave the
worker process; frames are never written to disk or sent over a network.
