# SHN-MEDIAPIPE
![Project Cover](assets/cover.jpeg)
# LookMan

A local-first desktop focus assistant that watches for face presence and approximate gaze, gently nudges you back, and draws a hangman when you drift.

### 💡 What's the idea?
- An attention tracker that gamifies your attention span.
- You set an intention and a session duration. LookMan keeps the countdown while a local Python/MediaPipe worker checks whether you are present and roughly where you are looking.
- Every away or gaze flag draws one hangman part. If the hangman is completed, the session ends on its own with a “You lost.” summary.
- Everything stays on your machine: webcam frames are processed locally, never recorded, and never uploaded.

### 🌐 Check it out!
- **Live Website:** NA
- **GitHub Repo:** [SHN-MEDIAPIPE](https://github.com/nikheeeeeel/SHN-MEDIAPIPE)

### 🛠️ What did you use?
- **Desktop:** Tauri 2, Rust
- **UI:** React, TypeScript, Vite, Tailwind CSS, Lucide icons
- **Vision:** Python 3, MediaPipe Face Landmarker (face + iris landmarks), OpenCV
- **Communication:** Local child-process stdio with newline-delimited JSON
- **Storage:** SQLite via rusqlite

### 👥 The Humans Behind It
- Nikhil Kishore – [nikheeeeeel](https://github.com/nikheeeeeel)

### ⚙️ Hardware Corner
NA

### 📸 Show Us What You Built!

[Watch the demo video](assets/demo.mp4)

https://github.com/user-attachments/assets/cb0dfa80-0998-4618-8557-9728d9795111

### ✨ Cool Things It Does
- Local face-presence and iris-based gaze estimation with centre-screen calibration.
- Configurable away and gaze-away thresholds, shared reminder cooldown, and calm popup reminders.
- A hangman game that draws a part per flag and automatically ends the session on the sixth flag.
- SQLite-backed session history and settings, with estimated attentive/away time.
- Privacy-first local processing: no footage is saved or uploaded, and the camera is released when monitoring stops.

---

**Built with curiosity at Saturday Hack Night 💜**
