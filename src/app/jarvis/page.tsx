"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { JarvisConsole } from "@/features/jarvis/JarvisConsole";
import { FirstFrameSignal } from "@/features/retro-office/scene/FirstFrameSignal";
import {
  Obsidian3DGraphCore,
  type GraphNode,
  type ObsidianGraphData,
} from "@/features/retro-office/scene/Obsidian3DGraphCore";

/**
 * Jarvis, full size.
 *
 * As a panel it covered the thing it explained; here the graph and the console
 * get their own halves and neither has to yield. The console itself is the
 * same component the brain window mounts — one implementation, two frames,
 * after watching how fast two copies of it came apart.
 *
 * The canvas lighting is copied from the brain window rather than reinvented.
 * The first attempt here had ambient light only and the graph rendered black:
 * the nodes are standard materials, and without the three point lights there
 * is nothing for them to reflect.
 */

export default function JarvisPage() {
  const [data, setData] = useState<ObsidianGraphData | null>(null);
  /** True once the scene has actually drawn, not merely once data arrived. */
  const [graphVisible, setGraphVisible] = useState(false);
  const [flyToNode, setFlyToNode] = useState<GraphNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const controlsRef = useRef<never>(null);

  useEffect(() => {
    fetch("/api/obsidian-graph")
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.nodes?.length) setData(payload);
      })
      .catch(() => undefined);
  }, []);

  /**
   * The indicator gives up after eight seconds, whatever the scene is doing.
   *
   * The frame signal inside the canvas is the good measurement and the wrong
   * place for a safety net: while that subtree is suspended none of its
   * children mount, so a timer in there never runs either. A cover that can
   * outlive the thing it covers is worse than no cover at all.
   */
  useEffect(() => {
    const timer = setTimeout(() => setGraphVisible(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const flyTo = useCallback(
    (sourceId: string) => {
      const node = data?.nodes.find((candidate) => candidate.id === sourceId);
      if (!node) return;
      setSelectedId(node.id);
      setFlyToNode(node);
    },
    [data],
  );

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#05070a] text-white">
      <section className="relative min-w-0 flex-1">
        {data ? (
          <>
            <Canvas
              camera={{ position: [0, 5, 22], fov: 48, near: 0.1, far: 500 }}
              dpr={[1, 2]}
              gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
            >
              <color attach="background" args={["#020409"]} />
              <ambientLight intensity={0.45} />
              <pointLight position={[12, 16, 12]} intensity={1.4} color="#ffffff" />
              <pointLight position={[-12, -8, -12]} intensity={0.8} color="#38bdf8" />
              <pointLight position={[0, -10, 0]} intensity={0.5} color="#ec4899" />
              <Obsidian3DGraphCore
                data={data}
                selectedNodeId={selectedId}
                onSelectNode={(node) => setSelectedId(node.id)}
                flyToNode={flyToNode}
                focusShiftX={1.2}
                activeSourceIds={sourceIds}
                controlsRef={controlsRef}
              />
              <FirstFrameSignal onReady={() => setGraphVisible(true)} />
              <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.05}
                maxDistance={70}
              />
            </Canvas>
            {!graphVisible ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#020409]">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
                <span className="text-[12px] text-white/45">
                  {data.nodes.length} Notizen werden zu Neuronen — das dauert einen Moment.
                </span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-white/40">
            Wissensgraph wird geladen…
          </div>
        )}

        <Link
          href="/office"
          className="absolute left-6 top-6 rounded-full border border-white/[0.09] bg-[#0e1013]/60 px-3 py-1.5 text-[11px] font-medium text-white/60 backdrop-blur-2xl hover:text-white/90"
        >
          ← Zurück ins Büro
        </Link>
      </section>

      <aside className="flex w-[420px] shrink-0 flex-col border-l border-white/[0.07] bg-[#0b0d10]/80 backdrop-blur-2xl">
        <JarvisConsole
          onFlyToSource={flyTo}
          onSourcesChange={setSourceIds}
          noteCount={data?.nodes.length ?? 0}
        />
      </aside>
    </main>
  );
}
