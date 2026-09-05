"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import type { Project } from "@/features/v2/useProjects";
import type { RosterAgent } from "@/features/v2/useRoster";
import type { VaultNode, VaultState } from "@/features/v2/useVault";
import { CameraDirector, HOME_VIEW, viewFor, type CameraGoal } from "@/features/v2/world/CameraDirector";
import { CosmosWorld } from "@/features/v2/world/CosmosWorld";
import { HomeWorld } from "@/features/v2/world/HomeWorld";
import { Horizon } from "@/features/v2/world/Horizon";
import { ProjectsWorld } from "@/features/v2/world/ProjectsWorld";
import { WarpStreaks } from "@/features/v2/world/WarpStreaks";

/**
 * One renderer, one active world.
 *
 * The budget rule from the plan, made structural: exactly one 3D world is
 * mounted at a time. Not hidden — unmounted, so its geometry, its materials
 * and above all its per-frame callbacks stop existing. A hidden world that
 * keeps running is the shape of the bug that cost V1 its frame rate, and it is
 * invisible by definition.
 *
 * The horizon is the exception and it is deliberate: it belongs to home, it is
 * one draw call, and it is what makes the cosmos feel like somewhere you can
 * already see rather than a room behind a door.
 */

export function V2Scene({
  agents,
  rosterReachable,
  approvalsWaiting,
  vault,
  projects,
  query,
  onSelectAgent,
  onSelectSource,
  onSelectProject,
  onFrame,
}: {
  agents: RosterAgent[];
  rosterReachable: boolean;
  approvalsWaiting: number;
  vault: VaultState;
  projects: Project[];
  /** The cosmos search term. Empty everywhere else. */
  query: string;
  onSelectAgent: (id: string) => void;
  onSelectSource: (node: VaultNode) => void;
  onSelectProject: (project: Project) => void;
  onFrame?: (sample: { fps: number; calls: number; triangles: number }) => void;
}) {
  const { world, travelling, selection, focus, prefs, setTravelling, rememberHomeCamera } = useV2();
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void; enabled: boolean } | null>(
    null,
  );
  const [goal, setGoal] = useState<CameraGoal | null>(null);
  const [warpProgress, setWarpProgress] = useState(0);
  const warpStart = useRef(0);

  /**
   * A change of world starts a flight, and the flight owns the transition.
   *
   * The world itself is swapped at the midpoint, while the streaks are at
   * their longest — so the swap is never visible, and the loading of the new
   * world happens behind the brightest part of the effect rather than behind a
   * spinner.
   */
  useEffect(() => {
    setGoal(viewFor(world, vault.radius, vault.centre));
    if (prefs.reducedMotion) return;
    setTravelling(true);
    warpStart.current = performance.now();
    let raf = 0;
    const tick = () => {
      const seconds = (performance.now() - warpStart.current) / 1000;
      const progress = Math.min(1, seconds / 1.15);
      setWarpProgress(progress);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setTravelling(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Intentionally keyed on the world alone: a preference change must not
    // re-trigger a journey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, vault.radius]);

  const handleArrive = useCallback(() => {
    setGoal(null);
    setTravelling(false);
    setWarpProgress(0);
  }, [setTravelling]);

  const sampleHome = useCallback(
    (position: THREE.Vector3, target: THREE.Vector3) => {
      if (world === "home") rememberHomeCamera(position, target);
    },
    [world, rememberHomeCamera],
  );

  const selectedSourceId = selection.kind === "source" ? selection.id : null;
  const selectedProjectFolder = selection.kind === "project" ? selection.folder : null;

  return (
    <Canvas
      dpr={[1, 1.35]}
      // Explicit, because the default is PCFSoftShadowMap and this version of
      // three deprecates it: every frame logged a warning and silently fell
      // back to exactly this. Naming the fallback removes the noise without
      // changing a single pixel — the console has to stay readable, or the
      // one warning that matters gets lost among a thousand that do not.
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: HOME_VIEW.position.toArray(), fov: 46, near: 0.1, far: 260 }}
      gl={{
        // Inert while the composer is mounted, which is why it is tied to the
        // bloom preference rather than left permanently on: with a composer
        // the multisampled default framebuffer is allocated and never
        // resolved, which is pure bandwidth on a shared-memory GPU.
        antialias: !prefs.bloom,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
      }}
      onCreated={({ gl }) => {
        // No fog. The dome sits at 58 units, and any fog thick enough to give
        // the stage depth also fades the whole sky into the background. The
        // horizon has to stay legible; the stage gets its depth from light.
        gl.setClearColor("#05080d");
      }}
    >
      {/* Key light, low and from the side, so the figures get a rim rather
          than being lit flat from above. One shadow caster, 1024 map. */}
      <directionalLight
        position={[6.5, 7.5, 5]}
        intensity={1.55}
        color="#e8f2ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={26}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0012}
      />
      {/* Cool fill from below-left, so the graphite does not go pure black. */}
      <hemisphereLight args={["#5b7fa6", "#080c12", 0.55]} />

      <CameraDirector
        goal={goal}
        controlsRef={controlsRef}
        speed={prefs.flightSpeed}
        reducedMotion={prefs.reducedMotion}
        onArrive={handleArrive}
        onSampleHome={sampleHome}
      />

      <OrbitControls
        ref={controlsRef as never}
        target={HOME_VIEW.target.toArray()}
        enablePan={false}
        minDistance={3.2}
        maxDistance={world === "cosmos" ? Math.max(30, vault.radius * 3) : 18}
        maxPolarAngle={Math.PI * 0.52}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.55 * prefs.flightSpeed}
        zoomSpeed={0.85 * prefs.flightSpeed}
      />

      <Suspense fallback={null}>
        {world === "home" ? (
          <>
            <HomeWorld
              agents={agents}
              rosterReachable={rosterReachable}
              approvalsWaiting={approvalsWaiting}
              onSelectAgent={onSelectAgent}
            />
            <Horizon
              nodes={vault.nodes}
              byId={vault.byId}
              dimmed={focus}
              highlightId={selectedSourceId}
            />
          </>
        ) : world === "cosmos" ? (
          <CosmosWorld
            nodes={vault.nodes}
            links={vault.links}
            radius={vault.radius}
            selectedId={selectedSourceId}
            query={query}
            onSelect={onSelectSource}
          />
        ) : (
          <ProjectsWorld
            projects={projects}
            selectedFolder={selectedProjectFolder}
            onSelect={onSelectProject}
          />
        )}
      </Suspense>

      {travelling && !prefs.reducedMotion ? <WarpStreaks progress={warpProgress} /> : null}

      {prefs.bloom ? (
        <EffectComposer multisampling={2}>
          {/* Bloom only. Ambient occlusion samples the depth buffer many times
              per pixel and was measured at 7 fps against 60 without it on this
              machine — it is the one effect that cannot be afforded. */}
          <Bloom intensity={0.62} luminanceThreshold={0.55} luminanceSmoothing={0.25} mipmapBlur />
        </EffectComposer>
      ) : null}

      {onFrame ? <FrameProbe onSample={onFrame} /> : null}
    </Canvas>
  );
}

/**
 * fps, draws and triangles — read after the frame, not before it.
 *
 * useFrame runs ahead of the render and three.js clears gl.info at the start
 * of each one, so reading there reports the state before anything was drawn.
 * With autoReset off the counters accumulate and each frame reads what the
 * previous one cost.
 */
function FrameProbe({
  onSample,
}: {
  onSample: (sample: { fps: number; calls: number; triangles: number }) => void;
}) {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  const elapsed = useRef(0);
  const calls = useRef(0);
  const triangles = useRef(0);

  useEffect(() => {
    // The renderer's own counters, switched from per-frame reset to manual.
    // This is the documented way to read draw calls, and the object belongs to
    // three.js rather than to React — the immutability rule cannot see that.
    /* eslint-disable react-hooks/immutability */
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
    /* eslint-enable react-hooks/immutability */
  }, [gl]);

  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    calls.current = gl.info.render.calls;
    triangles.current = gl.info.render.triangles;
    gl.info.reset();
    if (elapsed.current < 0.5) return;
    onSample({
      fps: Math.round(frames.current / elapsed.current),
      calls: calls.current,
      triangles: triangles.current,
    });
    frames.current = 0;
    elapsed.current = 0;
  });

  return null;
}
