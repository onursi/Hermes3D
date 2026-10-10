importScripts('./vision_bundle.js');
const { FaceLandmarker, FilesetResolver } = Vision;

let detector;
self.onmessage = async event => {
  const data = event.data;
  if (data.type === 'init') {
    try {
      const files = await FilesetResolver.forVisionTasks(new URL('./wasm', self.location.href).href);
      detector = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./face_landmarker.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1,
        minFaceDetectionConfidence: .6, minFacePresenceConfidence: .6, minTrackingConfidence: .6,
      });
      self.postMessage({ type: 'ready' });
    } catch (error) { console.error('Jarvis tracker init:', String(error)); self.postMessage({ type: 'error' }); }
    return;
  }
  if (data.type === 'frame') {
    try {
      const face = detector?.detectForVideo(data.frame, data.time).faceLandmarks[0];
      // The flat mesh stays in the page for the local scan overlay; it is never uploaded.
      const mesh = face ? new Float32Array(face.length * 2) : null;
      if (mesh) for (let i = 0; i < face.length; i++) { mesh[i * 2] = face[i].x; mesh[i * 2 + 1] = face[i].y; }
      self.postMessage({ type: 'face', points: face ? [1, 33, 263, 10, 152].map(i => face[i]) : null, mesh, time: data.time }, mesh ? [mesh.buffer] : []);
    } catch { self.postMessage({ type: 'error' }); }
    finally { data.frame.close(); }
  }
};
