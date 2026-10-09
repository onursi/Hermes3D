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
      self.postMessage({ type: 'face', points: face ? [1, 33, 263, 10, 152].map(i => face[i]) : null, time: data.time });
    } catch { self.postMessage({ type: 'error' }); }
    finally { data.frame.close(); }
  }
};
