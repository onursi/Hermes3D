"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { SPACE_BLACK } from "@/features/v2/palette";
import { useV2 } from "@/features/v2/state";
import type { Project, ProjectNote } from "@/features/v2/useProjects";
import type { RosterAgent } from "@/features/v2/useRoster";
import type { VaultState } from "@/features/v2/useVault";
import { CameraDirector, HOME_VIEW, PROJECT_INSIDE_VIEW, viewFor, type CameraGoal } from "@/features/v2/world/CameraDirector";
import { BeamProbe, type BeamProbePoint } from "@/features/v2/jarvis/BeamProbe";
import { KnowledgeAreas } from "@/features/v2/knowledge/KnowledgeAreas";
import type { KnowledgeEdge, KnowledgeNode } from "@/features/v2/knowledge/knowledgeTypes";
import { HomeWorld } from "@/features/v2/world/HomeWorld";
import { LibraryWorld, type LibraryItem } from "@/features/v2/world/LibraryWorld";
import { GalaxyAtmosphere } from "@/features/v2/world/GalaxyAtmosphere";
import { Horizon } from "@/features/v2/world/Horizon";
import { WorldsScene, ROOM_WORLDS } from "../foundations/WorldsScene";
import { MemoryWorld, type MemoryMode } from "../spatial/MemoryWorld";
import type { MemoryEntry, ProjectMeta } from "../spatial/model";
import { ProjectWorld } from "@/features/v2/world/ProjectWorld";
import { TesseractDimensionWorld } from "@/features/v2/world/tesseract/TesseractDimensionWorld";
import { WarpStreaks } from "@/features/v2/world/WarpStreaks";
import { Silhouettes } from "@/features/v2/universe/Silhouettes";
import { UniverseWorld } from "@/features/v2/universe/UniverseWorld";
import { CockpitProjector, type MarkerRegistry } from "@/features/v2/universe/CockpitProjector";
import { FreeFlight } from "@/features/v2/universe/FreeFlight";
import { approachFor, type Place } from "@/features/v2/universe/places";

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
  metadata = {},
  dive = 0,
  onDive,
  memoryEntries = [],
  memoryMode = "saturn",
  memoryPhase = "Gegenwart",
  onMemoryPhase,
  onMemoryMode,
  onMemoryOpen,
  agents,
  rosterReachable,
  approvalsWaiting,
  vault,
  projects,
  libraryItems,
  query,
  onSelectAgent,
  onSelectSourceId,
  onSelectProject,
  openProject = null,
  openNotePath = null,
  onOpenProjectNote,
  places,
  onReachChange,
  cockpitMarkers,
  knowledge,
  focusRequest,
  queryHitIds,
  citedSourceIds,
  flyThrough = false,
  inputBlocked = false,
  onFrame,
  crashWorld,
}: {
  metadata?: Record<string, ProjectMeta>;
  dive?: number;
  onDive?: () => void;
  memoryEntries?: MemoryEntry[];
  memoryMode?: MemoryMode;
  memoryPhase?: string;
  onMemoryPhase?: (p: string) => void;
  onMemoryMode?: (m: MemoryMode) => void;
  onMemoryOpen?: (e: MemoryEntry) => void;
  agents: RosterAgent[];
  rosterReachable: boolean;
  approvalsWaiting: number;
  vault: VaultState;
  projects: Project[];
  /** What stands on the library shelf right now. Derived from the vault. */
  libraryItems: LibraryItem[];
  /** The cosmos search term. Empty everywhere else. */
  query: string;
  onSelectAgent: (id: string) => void;
  /** The library speaks in ids, not in nodes — the module knows nothing of the vault. */
  onSelectSourceId: (id: string) => void;
  onSelectProject: (project: Project) => void;
  /** Das betretene Projekt, oder null fuer die Werft mit allen Liegeplaetzen. */
  openProject?: Project | null;
  /** Die gerade gelesene Notiz, damit sie im Raum hervorsticht. */
  openNotePath?: string | null;
  onOpenProjectNote?: (note: ProjectNote) => void;
  /** The map of the universe, derived once by the screen. */
  places: Place[];
  /** What the flight is currently close enough to enter. Null most of the time. */
  onReachChange: (place: Place | null) => void;
  /** True while a DOM panel owns the keyboard — the reader, above all. */
  inputBlocked?: boolean;
  /** Die Cockpit-Marken im DOM. Werden in der Canvas bewegt, nicht neu gerendert. */
  cockpitMarkers: React.MutableRefObject<MarkerRegistry>;
  /** Der Vault in W1-Form, oben abgeleitet. */
  knowledge: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
  /** Eine Kamerabitte aus dem HUD. Null, solange keine gestellt wurde. */
  focusRequest: { center: [number, number, number]; radius: number; seq: number } | null;
  /** Volltexttreffer der Suche, damit der Wissenskoerper sie mitleuchten laesst. */
  queryHitIds?: Set<string>;
  /** Notizen, die Jarvis gerade zitiert — Ziel des Strahls, gemessen statt geraten. */
  citedSourceIds?: string[];
  /** Im Wissenskoerper fliegen statt umkreisen. */
  flyThrough?: boolean;
  onFrame?: (sample: { fps: number; calls: number; triangles: number; geometries: number; textures: number; loops: number }) => void;
  /** Test hook: makes the named world throw on entry. See V2Screen. */
  crashWorld?: string | null;
}) {
  const { world, journey, travelling, selection, focus, prefs, goTo, setTravelling, rememberCamera, getCamera } =
    useV2();
  /**
   * A place to fly to on the next journey effect.
   *
   * A ref and not state, because it is set in the same click that calls
   * `goTo`: state would arrive a render later, after the effect that needed
   * to read it had already run and sent the camera to the default view.
   */
  const pendingApproach = useRef<Place | null>(null);
  const [reachable, setReachable] = useState<Place | null>(null);
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void; enabled: boolean } | null>(
    null,
  );
  const [goal, setGoal] = useState<CameraGoal | null>(null);
  const [warpProgress, setWarpProgress] = useState(0);
  const warpStart = useRef(0);

  /**
   * A move sets the camera. Whether it flies there is the move's own business.
   *
   * `direct` puts the camera at the destination on the next frame: no streaks,
   * no travelling flag, nothing to sit through and nothing to interrupt. That
   * is the dock, and it is now the default.
   *
   * `travel` is the flight, and the flight owns the transition — the world is
   * swapped at the midpoint while the streaks are at their longest, so the
   * swap is never visible and the new world loads behind the brightest part of
   * the effect rather than behind a spinner.
   */
  useEffect(() => {
    const base = viewFor(journey.world);

    // A click on a silhouette: enter the universe and fly to that place. The
    // flight is his own choice here, so it is a flight and not a cut.
    const approach = pendingApproach.current;
    pendingApproach.current = null;
    if (approach && journey.world === "universe") {
      const view = approachFor(approach);
      setGoal({ ...view, duration: 1.6, instant: prefs.reducedMotion });
      setTravelling(false);
      setWarpProgress(0);
      return;
    }

    // Returning to a world means the view he left it from, not the one the
    // designer composed. Only for a direct return: a staged flight that lands
    // on a half-orbited angle looks like the camera slipped.
    const remembered = journey.transit === "direct" ? getCamera(journey.world) : null;
    const destination = remembered
      ? { position: remembered.position.clone(), target: remembered.target.clone(), duration: base.duration }
      : base;

    const cut = journey.transit === "direct" || prefs.reducedMotion;
    setGoal({ ...destination, instant: cut });

    if (cut) {
      // Whatever was in flight is over — pressing the dock mid-warp must land
      // immediately rather than fight the interpolation for another second.
      setTravelling(false);
      setWarpProgress(0);
      return;
    }

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
    // Keyed on the move itself. `seq` rather than `world`, so that pressing
    // "Zuhause" while already home still puts the view back — and a preference
    // change still never re-triggers a journey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.seq, vault.radius]);

  /**
   * Leaving the universe clears the entry offer.
   *
   * Without this the HUD would keep offering "Bibliothek betreten" while he is
   * standing in the library — the offer belongs to the flight, and the flight
   * is gone.
   */
  useEffect(() => {
    if (world === "universe") return;
    setReachable(null);
    onReachChange(null);
  }, [world, onReachChange]);

  const openFolder = openProject?.folder ?? null;
  useEffect(() => {
    if (world !== "projects") return;
    const view = openFolder
      ? PROJECT_INSIDE_VIEW
      : {
          position: new THREE.Vector3(
            0,
            31 * (1 - dive) + 5.5 * dive,
            78 * (1 - dive) + 20 * dive,
          ),
          target: new THREE.Vector3(0, 0, 0),
        };
    setGoal({
      position: view.position.clone(),
      target: view.target.clone(),
      duration: 1.1,
      instant: prefs.reducedMotion,
    });
  }, [openFolder, world, prefs.reducedMotion, dive]);

  useEffect(() => {
    if (world !== "memory") return;
    setGoal({
      position: new THREE.Vector3(
        0,
        memoryMode === "saturn" ? 17 : 3,
        memoryMode === "saturn" ? 34 : 24,
      ),
      target: new THREE.Vector3(0, 0, 0),
      duration: 1.2,
      instant: prefs.reducedMotion,
    });
  }, [world, memoryMode, prefs.reducedMotion]);

  const handleArrive = useCallback(() => {
    setGoal(null);
    setTravelling(false);
    setWarpProgress(0);
  }, [setTravelling]);

  const sampleCamera = useCallback(
    (position: THREE.Vector3, target: THREE.Vector3) => {
      rememberCamera(world, position, target);
    },
    [world, rememberCamera],
  );

  /**
   * Fly to a place he clicked.
   *
   * From inside the universe it is a flight from here. From anywhere else it
   * is "come outside, then fly" — which is why the pending place is stashed
   * before `goTo` rather than after: the journey effect reads it.
   */
  const handleFocusPlace = useCallback(
    (place: Place) => {
      pendingApproach.current = place;
      if (world === "universe") {
        const view = approachFor(place);
        setGoal({ ...view, duration: 1.6, instant: prefs.reducedMotion });
        pendingApproach.current = null;
        return;
      }
      goTo("universe", "direct");
    },
    [world, goTo, prefs.reducedMotion],
  );

  /**
   * The vault in W1's shape. Derived once per data change, never per frame.
   */
  /**
   * Was vom Deck aus am Himmel steht.
   *
   * Eine Station je Projekt ist im All richtig und zuhause falsch: aus
   * hundert Einheiten sind sechs Tore ein Fleck. Der Ort "Projekte" wird
   * durch das naechstgelegene vertreten — angesteuert wird trotzdem jedes
   * einzelne, sobald man draussen ist.
   */
  const homePlaces = useMemo(() => {
    const seen = new Set<string>();
    return places.filter((place) => {
      if (place.kind !== "project") return true;
      if (seen.has("project")) return false;
      seen.add("project");
      return true;
    });
  }, [places]);

  /**
   * W1 asks the camera to look at an area; the camera stays mine.
   *
   * That split is the module contract and it is the right one — a component
   * that moved the camera itself would fight the director the moment two
   * things wanted it. So this is a request, granted as a flight.
   */
  const handleFocusArea = useCallback(
    (focus: { center: [number, number, number]; radius: number }) => {
      const centre = new THREE.Vector3(...focus.center);
      setGoal({
        position: centre.clone().add(new THREE.Vector3(0, focus.radius * 0.8, focus.radius * 2.6)),
        target: centre,
        duration: 1.1,
        instant: prefs.reducedMotion,
      });
    },
    [prefs.reducedMotion],
  );

  /**
   * Eine Kamerabitte aus dem HUD ausfuehren.
   *
   * Auf  geschluesselt, nicht auf den Inhalt: derselbe Ort zweimal
   * angeklickt soll zweimal hinfliegen. Auf den Inhalt geschluesselt saehe
   * React beim zweiten Mal denselben Wert und taete nichts — und der Klick
   * waere ohne erkennbaren Grund wirkungslos.
   */
  useEffect(() => {
    if (!focusRequest) return;
    handleFocusArea({ center: focusRequest.center, radius: focusRequest.radius });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.seq]);

  const handleReachChange = useCallback(
    (place: Place | null) => {
      setReachable(place);
      onReachChange(place);
    },
    [onReachChange],
  );

  const selectedSourceId = selection.kind === "source" ? selection.id : null;
  const selectedProjectFolder = selection.kind === "project" ? selection.folder : null;

  /**
   * Wo die zitierten Notizen liegen — in der Welt, in der man gerade steht.
   *
   * Dieselbe Notiz hat zwei Orte: im Wissenskoerper ihre Graphenposition, im
   * Zuhause ihren Platz am Himmel. Welcher gilt, entscheidet die Welt — sonst
   * zeigt der Strahl im Zuhause auf einen Punkt, der nur im Kosmos existiert.
   */
  const beamPoints = useMemo<BeamProbePoint[]>(() => {
    if (!citedSourceIds || citedSourceIds.length === 0) return [];
    const points: BeamProbePoint[] = [];
    for (const id of citedSourceIds) {
      const node = vault.byId.get(id);
      if (!node) continue;
      points.push({
        id: node.id,
        label: node.name,
        position: world === "home" ? node.skyPosition : node.position,
      });
    }
    return points;
  }, [citedSourceIds, vault.byId, world]);

  /**
   * Die Tastflaeche fuer den Scandurchlauf: echte Notizen, gleichmaessig ueber
   * den Vault verteilt.
   *
   * Gedeckelt, weil pro Bild jede davon projiziert wird — bei dreihundert
   * Notizen waere das dreihundert Matrixmultiplikationen fuer einen Effekt.
   * Jede n-te statt der ersten n: sonst tastet der Scan nur einen Ordner ab,
   * weil der Graph nach Ordnern sortiert liegt.
   */
  const sweepPoints = useMemo<BeamProbePoint[]>(() => {
    const alle = vault.nodes;
    const ziel = 70;
    const schritt = Math.max(1, Math.floor(alle.length / ziel));
    const points: BeamProbePoint[] = [];
    for (let i = 0; i < alle.length && points.length < ziel; i += schritt) {
      const node = alle[i];
      points.push({
        id: node.id,
        label: node.name,
        position: world === "home" ? node.skyPosition : node.position,
      });
    }
    return points;
  }, [vault.nodes, world]);

  return (
    <Canvas
      dpr={[1, 1.35]}
      // Explicit, because the default is PCFSoftShadowMap and this version of
      // three deprecates it: every frame logged a warning and silently fell
      // back to exactly this. Naming the fallback removes the noise without
      // changing a single pixel — the console has to stay readable, or the
      // one warning that matters gets lost among a thousand that do not.
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: HOME_VIEW.position.toArray(), fov: 46, near: 0.1, far: 40000 }}
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
        gl.setClearColor(SPACE_BLACK);
      }}
    >
      {/* The stage lighting belongs to the three open worlds. The library
          brings its own — it is an interior, lit from inside, and stacking the
          outdoor key light on top of it washes out exactly the thing that
          makes it read as a room. One lighting concept at a time. */}
      {world !== "library" && world !== "universe" ? (
        <>
      {/* Key light, low and from the side, so the figures get a rim rather
          than being lit flat from above. One shadow caster, 1024 map. */}
      <directionalLight
        position={[6.5, 7.5, 5]}
        intensity={1.45}
        // Warmweiß statt Blauweiß. Ein blaues Hauptlicht färbt jede
        // Oberfläche im Raum, und drei blaue Entscheidungen übereinander
        // waren der Grund, dass alles blau wirkte.
        color="#ffeedd"
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
      <hemisphereLight args={["#7b7468", "#0a0a0c", 0.55]} />
        </>
      ) : null}

      {/*
        Die Messstelle fuer den Jarvis-Strahl.
        Sie zeichnet nichts — sie rechnet die Weltposition der zitierten Notizen
        in Bildschirmkoordinaten um, damit der Strahl im DOM sie treffen kann.
        Im Zuhause liegen dieselben Notizen als Himmelssterne weit draussen,
        deshalb je nach Welt die andere Position derselben Notiz.
      */}
      <BeamProbe points={beamPoints} sweepPoints={sweepPoints} />

      <CameraDirector
        goal={goal}
        controlsRef={controlsRef}
        speed={world === "projects" || world === "memory" ? 1 : prefs.flightSpeed}
        reducedMotion={prefs.reducedMotion}
        onArrive={handleArrive}
        onSampleHome={sampleCamera}
      />

      {/* OrbitControls orbits a point, which is right for looking at a place
          and wrong for leaving one. The universe has its own controller, and
          the two must never be mounted together — both write the camera, and
          the result is a fight rather than a compromise. */}
      {world !== "universe" && !(world === "cosmos" && flyThrough) ? (
        <OrbitControls
          ref={controlsRef as never}
          target={HOME_VIEW.target.toArray()}
          enabled={!inputBlocked && !(world === "memory" && memoryMode === "carousel")}
          enablePan={false}
          minDistance={world === "projects" && !openProject ? 7.8 : 3.2}
          maxDistance={world === "cosmos" ? Math.max(80, vault.radius * 3) : world === "home" ? 800 : world === "projects" ? 180 : world === "memory" ? 85 : ROOM_WORLDS.includes(world) ? 160 : 30}
          maxPolarAngle={world === "projects" || world === "memory" || ROOM_WORLDS.includes(world) ? Math.PI * 0.94 : Math.PI * 0.52}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
          zoomSpeed={0.85}
        />
      ) : null}

      <Suspense fallback={null}>
        {world !== "library" && !ROOM_WORLDS.includes(world) && !(world === "projects" && !openProject) && <GalaxyAtmosphere reducedMotion={prefs.reducedMotion} dimmed={world === "cosmos"} />}
        {crashWorld === world ? <Boom world={world} /> : null}
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
            {/* The rest of the universe, seen from the deck. Same file, same
                coordinates, same shapes as when he is out there — which is
                the entire claim: the library on the horizon *is* the library
                he flies to, not a picture of it. */}
            {/* Zuhause nur die grossen Ziele, nicht jede einzelne Station.
                Sechs Projekttore am Horizont sind sechs winzige Ringe, die
                nebeneinander zu einem Fleck werden — und sie kosten, was ein
                Fleck nicht wert ist. Wer ein einzelnes Projekt ansteuern will,
                fliegt hinaus; dort stehen sie alle. */}
            <Silhouettes
              places={homePlaces}
              activeId="home"
              reachableId={null}
              reducedMotion={prefs.reducedMotion}
              onFocus={handleFocusPlace}
            />
          </>
        ) : world === "universe" ? (
          <>
          <CockpitProjector places={places} markers={cockpitMarkers} />
          <UniverseWorld
            places={places}
            activeId={null}
            reachableId={reachable?.id ?? null}
            speed={prefs.flightSpeed}
            reducedMotion={prefs.reducedMotion}
            // The flight stands down while the director is flying somewhere,
            // and takes over the moment it lands.
            flightEnabled={goal === null && !inputBlocked}
            onReachChange={handleReachChange}
            onSample={sampleCamera}
            onFocusPlace={handleFocusPlace}
          />
          </>
        ) : world === "cosmos" ? (
          /* W1, with the real vault. The module knows nothing about vaults,
             fetching or cameras — it is handed nodes, edges and a selection,
             and it hands back an id. That is the whole contract, and keeping
             it that narrow is why swapping the knowledge world in took one
             prop list rather than a rewrite. */
          <>
          {flyThrough && !inputBlocked && goal === null ? (
            /* Dieselbe Steuerung wie im All, nur langsamer und mit enger
               Grenze: der Koerper misst zwanzig Einheiten, nicht zweihundert.
               Wer hier mit Reisetempo losfliegt, ist in einer Sekunde drausen
               und sieht einen Punkt. */
            <FreeFlight
              places={[]}
              speed={Math.min(3, prefs.flightSpeed)}
              boundary={80}
              baseSpeed={7.5}
              onReachChange={() => {}}
              onSample={sampleCamera}
            />
          ) : null}
          <KnowledgeAreas
            nodes={knowledge.nodes}
            edges={knowledge.edges}
            selectedId={selectedSourceId}
            query={query}
            queryHitIds={queryHitIds}
            reducedMotion={prefs.reducedMotion}
            onSelect={onSelectSourceId}
            onFocusRequest={handleFocusArea}
          />
          </>
        ) : world === "memory" ? (
          <MemoryWorld
            entries={memoryEntries}
            mode={memoryMode}
            phase={memoryPhase}
            reducedMotion={prefs.reducedMotion}
            onPhase={onMemoryPhase ?? (() => {})}
            onFree={() => onMemoryMode?.("free")}
            onOpen={onMemoryOpen ?? (() => {})}
          />
        ) : world === "projects" ? (
          openProject ? (
            <ProjectWorld
              project={openProject}
              openPath={openNotePath}
              onOpenNote={onOpenProjectNote ?? (() => {})}
            />
          ) : (
            <WorldsScene onDive={onDive}/>
          )
        ) : ROOM_WORLDS.includes(world) ? (
          <WorldsScene/>
        ) : world === "tesseract" ? (
          <TesseractDimensionWorld onExit={() => goTo("home")} />
        ) : (
          <LibraryWorld
            items={libraryItems}
            selectedId={selectedSourceId}
            onSelect={onSelectSourceId}
            reducedMotion={prefs.reducedMotion}
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
 * The deliberate failure behind ?boom=<welt>.
 *
 * Throws during render, which is the case that matters: a throw in a callback
 * would never reach an error boundary, so a hook that used one would test
 * nothing. See WorldBoundary.
 */
function Boom({ world }: { world: string }): null {
  throw new Error("Absichtlicher Testfehler in der Welt: " + world);
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
  onSample: (sample: { fps: number; calls: number; triangles: number; geometries: number; textures: number; loops: number }) => void;
}) {
  const gl = useThree((state) => state.gl);
  /**
   * Wie viele Frame-Schleifen gerade laufen.
   *
   * Die eine Zahl, die den Fehler sichtbar macht, gegen den V2 gebaut ist:
   * eine Welt, die abgebaut wurde und trotzdem weiterrechnet, aendert keinen
   * einzigen Zeichenaufruf und halbiert trotzdem die Bildrate. R3F fuehrt
   * seine Abonnenten in ; waechst diese Zahl mit jedem
   * Weltwechsel, ist genau das passiert.
   */
  const internal = useThree((state) => state.internal);
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
      // Was der Renderer noch hält. Draw Calls sagen nichts über ein Leck —
      // eine Szene kann bei gleicher Zahl von Zeichenaufrufen langsam werden,
      // weil Geometrien und Texturen sich stapeln, die niemand mehr braucht.
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      loops: internal.subscribers.length,
    });
    frames.current = 0;
    elapsed.current = 0;
  });

  return null;
}
