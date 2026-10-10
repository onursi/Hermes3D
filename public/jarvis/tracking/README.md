# Local face tracking assets

MediaPipe Tasks Vision 1.1.0 (Apache-2.0). Runtime and WASM copied from the pinned npm package.
Face Landmarker float16 model v1 downloaded from https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
Documentation https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js

All inference runs in a local browser Worker. Camera frames are neither stored nor sent by this tracker. The separate, explicitly started Live conversation retains its own media consent.

Pose Landmarker lite float16 v1 downloaded 2026-10-10 from https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task (SHA-256 59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a). It adds the optional local body silhouette and joints for the scan view.
