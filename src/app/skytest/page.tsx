"use client";

import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Suspense, useEffect, useRef, useState } from "react";

import { SceneAtmosphere } from "@/features/retro-office/systems/atmosphere";
import { FrameMeter } from "@/features/retro-office/systems/FrameMeter";
import { getGraphicsQualityConfig } from "@/features/retro-office/core/graphicsQuality";

/**
 * The sky on its own, so it can be measured.
 *
 * The office page needs a live gateway and never gets past "Wird geladen" in
 * an automated browser, which is why every performance claim in this project
 * so far has been arithmetic rather than measurement. The atmosphere needs no
 * gateway. Mounted alone it answers the one question that matters right now:
 * what does the sky cost, and how much of that is the galaxies.
 *
 * This is a measuring instrument, not a feature. It is deliberately at its own
 * route and linked from nowhere.
 */

export default function SkyTestPage() {
  /**
   * The canvas is mounted only after the client is running.
   *
   * A client component is still server-rendered by Next, and a WebGL canvas
   * cannot match between the two — React aborts hydration on the mismatch and
   * then nothing on the page mounts at all, which is why both probes stayed
   * silent while the overlay rendered perfectly.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [sample, setSample] = useState({ fps: 0, calls: 0, triangles: 0 });
  const [history, setHistory] = useState<number[]>([]);
  const samples = useRef<number[]>([]);

  useEffect(() => {
    // Published for an automated reader, which cannot see the DOM text as
    // reliably as it can read a value.
    (window as unknown as { __skytest?: unknown }).__skytest = sample;
  }, [sample]);

  useEffect(() => {
    if (sample.fps <= 0) return;
    samples.current = [...samples.current, sample.fps].slice(-20);
    setHistory(samples.current);
  }, [sample]);

  const median =
    history.length > 0
      ? [...history].sort((a, b) => a - b)[Math.floor(history.length / 2)]
      : 0;

  return (
    <main className="h-screen w-screen bg-black">
      {mounted ? (
      <Canvas
        camera={{ position: [0, 3, 12], fov: 50, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ gl, scene, camera }) => {
          // Outside every Suspense boundary on purpose. Components inside the
          // canvas do not mount while the atmosphere is loading, which is why
          // both probes stayed silent; onCreated fires as soon as the renderer
          // exists and cannot be suspended away.
          (window as unknown as { __hermes3d?: unknown }).__hermes3d = { gl, scene, camera };
        }}
      >
        {/* The atmosphere loads textures and therefore suspends. A meter
            beside it inside the same boundary does not mount while that
            happens — the same trap that made the loading overlay outlive the
            graph. Its own Suspense keeps the meter running throughout. */}
        <Suspense fallback={null}>
          <SceneAtmosphere config={getGraphicsQualityConfig("ultra")} projects={[]} />
        </Suspense>
        <FrameMeter onSample={setSample} />
      </Canvas>
      ) : null}

      <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-black/70 px-4 py-3 font-mono text-[13px] text-white/90">
        <div>{sample.fps} fps (Median {median})</div>
        <div>{sample.calls} Draws</div>
        <div>{(sample.triangles / 1000).toFixed(0)}k Dreiecke</div>
        <div className="mt-1 text-[11px] text-white/40">{history.length} Messungen</div>
      </div>
    </main>
  );
}
