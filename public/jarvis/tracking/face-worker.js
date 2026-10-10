importScripts('./vision_bundle.js');
const { FaceLandmarker, PoseLandmarker, FilesetResolver } = Vision;

let detector, pose, frames = 0;
const MASK_WIDTH = 160;
self.onmessage = async event => {
  const data = event.data;
  if (data.type === 'init') {
    let files;
    try {
      files = await FilesetResolver.forVisionTasks(new URL('./wasm', self.location.href).href);
      detector = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./face_landmarker.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1,
        minFaceDetectionConfidence: .6, minFacePresenceConfidence: .6, minTrackingConfidence: .6,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) { console.error('Jarvis tracker init:', String(error)); self.postMessage({ type: 'error' }); return; }
    // The body scan is optional: gaze tracking keeps working when it cannot load.
    if (data.body) try {
      pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./pose_landmarker_lite.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1, outputSegmentationMasks: true,
      });
      self.postMessage({ type: 'body-ready' });
    } catch (error) { console.error('Jarvis body scan init:', String(error)); pose = undefined; self.postMessage({ type: 'body-unavailable' }); }
    return;
  }
  if (data.type === 'frame') {
    try {
      const face = detector?.detectForVideo(data.frame, data.time).faceLandmarks[0];
      // The flat mesh stays in the page for the local scan overlay; it is never uploaded.
      const mesh = face ? new Float32Array(face.length * 2) : null;
      if (mesh) for (let i = 0; i < face.length; i++) { mesh[i * 2] = face[i].x; mesh[i * 2 + 1] = face[i].y; }
      self.postMessage({ type: 'face', points: face ? [1, 33, 263, 10, 152].map(i => face[i]) : null, mesh, time: data.time }, mesh ? [mesh.buffer] : []);
      // Every second frame is enough for the silhouette and keeps the gaze responsive.
      if (pose && frames++ % 2 === 0) try {
        pose.detectForVideo(data.frame, data.time, result => {
          const marks = result.landmarks[0], source = result.segmentationMasks && result.segmentationMasks[0];
          if (!marks || !source) { self.postMessage({ type: 'body', points: null }); return; }
          const points = new Float32Array(marks.length * 3);
          for (let i = 0; i < marks.length; i++) { points[i * 3] = marks[i].x; points[i * 3 + 1] = marks[i].y; points[i * 3 + 2] = marks[i].visibility ?? 0; }
          const values = source.getAsFloat32Array(), sw = source.width, sh = source.height;
          const width = Math.min(MASK_WIDTH, sw), height = Math.max(1, Math.round(sh / sw * width)), mask = new Uint8Array(width * height);
          for (let y = 0; y < height; y++) { const row = Math.min(sh - 1, Math.floor(y / height * sh)) * sw; for (let x = 0; x < width; x++) mask[y * width + x] = Math.round(Math.max(0, Math.min(1, values[row + Math.min(sw - 1, Math.floor(x / width * sw))])) * 255); }
          self.postMessage({ type: 'body', points, mask, width, height }, [points.buffer, mask.buffer]);
        });
      } catch (error) { console.error('Jarvis body scan:', String(error)); pose = undefined; self.postMessage({ type: 'body-unavailable' }); }
    } catch { self.postMessage({ type: 'error' }); }
    finally { data.frame.close(); }
  }
};
