"use client";
import { useEffect, type RefObject, type MutableRefObject } from "react";
import { gazeFromFace, neutralGaze, type GazeTarget } from "./tracking";

export type TrackingState = "off" | "loading" | "searching" | "following" | "unavailable";
export type FaceMesh = { points: Float32Array | null; seen: number };
export function useFaceTracking(video: RefObject<HTMLVideoElement | null>, enabled: boolean, mirror: boolean, targetRef: MutableRefObject<GazeTarget>, onState: (state: TrackingState) => void, meshRef?: MutableRefObject<FaceMesh>) {
  useEffect(() => {
    targetRef.current = neutralGaze();
    if (!enabled) { onState("off"); return; }
    let stopped = false, busy = false, ready = false, lastVideo = -1, lastSent = 0;
    let frame = 0, timeout = 0;
    let worker: Worker;
    let state: TrackingState = "loading";
    const status = (next: TrackingState) => { if (!stopped && next !== state) { state = next; onState(next); } };
    onState("loading");
    const fail = () => { ready = false; clearTimeout(timeout); status("unavailable"); worker?.terminate(); };
    try {
      worker = new Worker("/jarvis/tracking/face-worker.js", { type: "classic" });
      worker.onerror = fail;
      worker.onmessage = event => {
        if (stopped) return;
        clearTimeout(timeout); busy = false;
        if (event.data.type === "ready") { ready = true; status("searching"); }
        else if (event.data.type === "face") {
          if (meshRef && event.data.mesh instanceof Float32Array) meshRef.current = { points: event.data.mesh, seen: performance.now() };
          const gaze = event.data.points && gazeFromFace(event.data.points, mirror, event.data.time);
          if (gaze) { targetRef.current = gaze; status("following"); }
          else status("searching");
        } else fail();
      };
      worker.postMessage({ type: "init" });
      timeout = window.setTimeout(fail, 30000);
    } catch { status("unavailable"); return; }
    const tick = (now: number) => {
      if (stopped) return;
      const source = video.current;
      // One outstanding frame only; inference lives off the audio/UI thread.
      if (ready && !busy && !document.hidden && source?.srcObject && source.readyState >= 2 && source.currentTime !== lastVideo && now - lastSent >= 85) {
        busy = true; lastSent = now; lastVideo = source.currentTime;
        void createImageBitmap(source, { resizeWidth: 480 }).then(bitmap => {
          if (stopped || !ready) { bitmap.close(); busy = false; return; }
          worker.postMessage({ type: "frame", frame: bitmap, time: now }, [bitmap]);
          timeout = window.setTimeout(fail, 8000);
        }).catch(() => { busy = false; fail(); });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { stopped = true; clearTimeout(timeout); cancelAnimationFrame(frame); worker.terminate(); targetRef.current = neutralGaze(); if (meshRef) meshRef.current = { points: null, seen: 0 }; };
  }, [video, enabled, mirror, targetRef, onState, meshRef]);
}
