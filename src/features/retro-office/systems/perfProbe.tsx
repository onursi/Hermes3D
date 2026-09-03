"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type * as THREE from "three";

declare global {
  interface Window {
    __hermes3d?: {
      gl: THREE.WebGLRenderer;
      scene: THREE.Scene;
      camera: THREE.Camera;
    };
  }
}

/**
 * Publishes the live renderer, scene and camera on `window.__hermes3d` so the
 * frame budget can be measured from the console.
 *
 * A background tab throttles requestAnimationFrame to a crawl, which makes the
 * obvious "count frames per second" measurement useless whenever the window is
 * not in front. Driving the renderer by hand is not throttled, so the numbers
 * stay comparable across runs:
 *
 *   const { gl, scene, camera } = window.__hermes3d;
 *   gl.info.autoReset = false; gl.info.reset(); gl.render(scene, camera);
 *   gl.info.render;  // drawCalls, triangles
 *
 * Costs one effect on mount and nothing per frame.
 */
export function PerfProbe() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__hermes3d = { gl, scene, camera };
    return () => {
      delete window.__hermes3d;
    };
  }, [gl, scene, camera]);

  return null;
}
