"use client";

import { Html, PointerLockControls, RoundedBox, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import { useHermesLive } from "@/features/v2/useHermesLive";
import { useRoster, type RosterAgent } from "@/features/v2/useRoster";
import type { VaultNode } from "@/features/v2/useVault";
import { GalaxyAtmosphere } from "@/features/v2/world/GalaxyAtmosphere";
import { HermesOrb } from "@/features/v2/world/HermesOrb";

import { useAgentActivity, type AgentActivity } from "./agentActivity";
import { KnowledgeCloud } from "./KnowledgeCloud";
import { PerspectivesPanel } from "@/features/perspectives/PerspectivesPanel";
import "./walk.css";

/**
 * Walk mode: the council platform floating in space, the Hermes orb in its
 * centre, the agents as figures around it, each with a live window that shows
 * what it is doing right now. First person on desktop (click, WASD, mouse),
 * joystick + drag on the phone. "Rat einberufen" walks everyone to the orb.
 */

/** The command platform is scaled so its rim sits at this radius. */
const ROOM_RADIUS = 9;
const DESK_RADIUS = 6.4;
const TABLE_RADIUS = 2.4;
const EYE = 1.6;
const COLORS = ["#4f7cff", "#f2a33a", "#8b5cf6", "#22c55e", "#ef4444", "#eab308", "#06b6d4", "#ec4899"];

type Seat = { desk: THREE.Vector3; table: THREE.Vector3; color: string };

function seatsFor(count: number): Seat[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / Math.max(count, 1)) * Math.PI * 2 + Math.PI / 2;
    const b = (i / Math.max(count, 1)) * Math.PI * 2;
    return {
      desk: new THREE.Vector3(Math.cos(a) * DESK_RADIUS, 0, Math.sin(a) * DESK_RADIUS),
      table: new THREE.Vector3(Math.cos(b) * TABLE_RADIUS, 0, Math.sin(b) * TABLE_RADIUS),
      color: COLORS[i % COLORS.length],
    };
  });
}

const PROVIDER_LABEL: Record<string, string> = {
  "openai-codex": "über ChatGPT",
  openai: "direkt bei OpenAI",
  anthropic: "direkt bei Anthropic",
  openrouter: "über OpenRouter",
  gemini: "direkt bei Google",
  custom: "lokal auf deinem PC",
  ollama: "lokal auf deinem PC",
};

const LIVE_LABEL: Record<string, string> = {
  idle: "Live: startet",
  connecting: "Live: verbindet …",
  connected: "live verbunden",
  lost: "Live: Verbindung weg, versuche neu",
  unavailable: "Live: nicht verfügbar",
};

function displayName(agent: RosterAgent) {
  if (agent.isDefault) return "Hermes";
  return agent.name.replace(/\bLocal\b/i, "lokal");
}

function displayRole(agent: RosterAgent) {
  return agent.role ?? (agent.isDefault ? "Hauptagent: plant, verteilt Aufgaben und antwortet dir." : "wartet auf eine Aufgabe");
}

function providerLabel(provider: string | null) {
  return provider ? PROVIDER_LABEL[provider] ?? provider : "";
}

const PHASE_LABEL: Record<AgentActivity["phase"], string> = {
  bereit: "bereit",
  denkt: "denkt nach",
  arbeitet: "arbeitet",
  fertig: "fertig",
  fehler: "Fehler",
};

function elapsed(since: number | null) {
  if (!since) return "";
  const s = Math.max(0, Math.round((Date.now() - since) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/* ------------------------------------------------------------------ figures */

function Robot({
  agent, seat, activity, goal, onSelect, selected,
}: {
  agent: RosterAgent; seat: Seat; activity: AgentActivity; goal: THREE.Vector3;
  onSelect: () => void; selected: boolean;
}) {
  const body = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.MeshStandardMaterial>(null);
  const busy = activity.phase === "denkt" || activity.phase === "arbeitet";
  const [, tick] = useState(0);

  // Re-render once a second while busy so the timer in the window runs.
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  useFrame((state, dt) => {
    const g = body.current;
    if (!g) return;
    const target = goal;
    const toTarget = target.clone().sub(g.position);
    const dist = toTarget.length();
    const walking = dist > 0.05;
    if (walking) g.position.add(toTarget.multiplyScalar(Math.min(1, (dt * 1.6) / Math.max(dist, 0.001))));
    // Face where it walks; otherwise face the centre (over its desk, or across the table).
    const look = walking ? target : new THREE.Vector3(0, 0, 0);
    const yaw = Math.atan2(look.x - g.position.x, look.z - g.position.z);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, yaw, Math.min(1, dt * 6));
    const t = state.clock.elapsedTime;
    g.position.y = walking ? Math.abs(Math.sin(t * 9)) * 0.06 : Math.sin(t * 1.6 + seat.desk.x) * 0.02;
    if (eyes.current) eyes.current.emissiveIntensity = busy ? 2.2 + Math.sin(t * 8) * 1.2 : 1.6;
  });

  return (
    <group ref={body} position={seat.desk.toArray()}>
      <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        {/* body */}
        <mesh position={[0, 0.62, 0]} castShadow>
          <capsuleGeometry args={[0.32, 0.5, 8, 20]} />
          <meshStandardMaterial color={seat.color} roughness={0.35} metalness={0.15} />
        </mesh>
        {/* head */}
        <RoundedBox args={[0.78, 0.56, 0.62]} radius={0.2} smoothness={5} position={[0, 1.32, 0]} castShadow>
          <meshStandardMaterial color={seat.color} roughness={0.3} metalness={0.15} />
        </RoundedBox>
        {/* visor */}
        <RoundedBox args={[0.62, 0.34, 0.08]} radius={0.12} smoothness={4} position={[0, 1.32, 0.3]}>
          <meshStandardMaterial color="#0b0f14" roughness={0.2} />
        </RoundedBox>
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} position={[x, 1.33, 0.35]}>
            <capsuleGeometry args={[0.035, 0.06, 4, 8]} />
            <meshStandardMaterial ref={x < 0 ? eyes : undefined} color="#bdf3ff" emissive="#5fe3ff" emissiveIntensity={1.6} />
          </mesh>
        ))}
        {/* selection / status ring */}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.5, 0.58, 40]} />
          <meshBasicMaterial color={selected ? "#ffffff" : busy ? "#5fe3ff" : "#3a4652"} transparent opacity={selected || busy ? 0.9 : 0.5} />
        </mesh>
      </group>

      {/* 1 · work window: while the agent works, a larger hologram beside it shows the
          tool it is using and the text as it is written — like the floating app windows in SAMS. */}
      {busy || activity.phase === "fertig" ? (
        <Html position={[1.15, 1.55, 0]} transform sprite distanceFactor={2.6} zIndexRange={[19, 0]}>
          <div className={`walk-work ${busy ? "is-busy" : "is-done"}`} onClick={onSelect}>
            <div className="walk-work__bar">
              <span className="walk-work__lights"><i /><i /><i /></span>
              <span>{activity.step ?? (busy ? "schreibt Antwort" : "Ergebnis")}</span>
              <span className="walk-work__time">{busy ? elapsed(activity.since) : "fertig"}</span>
            </div>
            <pre className="walk-work__body">{activity.text ? activity.text.slice(-700) : "…"}</pre>
          </div>
        </Html>
      ) : null}

      {/* live window */}
      <Html position={[0, 2.35, 0]} center distanceFactor={6} zIndexRange={[20, 0]}>
        <div className={`walk-window ${busy ? "is-busy" : ""} phase-${activity.phase}`} onClick={onSelect}>
          <div className="walk-window__head">
            <span className="walk-window__dot" style={{ background: seat.color }} />
            <b>{displayName(agent)}</b>
            <span className="walk-window__phase">{PHASE_LABEL[activity.phase]} {busy ? elapsed(activity.since) : ""}</span>
          </div>
          <div className="walk-window__meta">{agent.model ?? "Modell unbekannt"}{agent.provider ? ` · ${providerLabel(agent.provider)}` : ""}</div>
          {activity.step ? <div className="walk-window__step">{activity.step}</div> : null}
          {activity.text ? <div className="walk-window__text">{activity.text.slice(-220)}</div> : (
            <div className="walk-window__idle">{displayRole(agent)}</div>
          )}
        </div>
      </Html>
    </group>
  );
}

/** The Hermes command consoles and rails (the model has no floor of its own), scaled to the council. */
function SpacePlatform() {
  const { scene } = useGLTF("/models/hermes-command-r37.glb");
  const platform = useMemo(() => {
    const copy = scene.clone(true);
    const box = new THREE.Box3().setFromObject(copy);
    const size = box.getSize(new THREE.Vector3());
    const scale = (ROOM_RADIUS * 1.15) / Math.max(size.x, size.z, 0.001);
    copy.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(copy);
    const centre = scaled.getCenter(new THREE.Vector3());
    copy.position.set(-centre.x, 0, -centre.z);
    copy.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true; });
    return copy;
  }, [scene]);
  return <primitive object={platform} dispose={null} />;
}

/** The council floor: a dark metal disc floating in space. */
function PlainDisc() {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <circleGeometry args={[ROOM_RADIUS, 96]} />
      <meshStandardMaterial color="#121a22" roughness={0.6} metalness={0.3} />
    </mesh>
  );
}

function CouncilRings() {
  const lines = useMemo(() => [TABLE_RADIUS + 0.9, DESK_RADIUS + 0.9].map((r) =>
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * r, 0.04, Math.sin(a) * r);
      })),
      new THREE.LineBasicMaterial({ color: "#5fe3ff", transparent: true, opacity: 0.55 }),
    )), []);
  return <>{lines.map((l, i) => <primitive key={i} object={l} />)}</>;
}

/** Hermes himself in the middle of the council: click to talk to him. */
function CouncilOrb({ onSelect, reachable }: { onSelect: () => void; reachable: boolean }) {
  const { prefs } = useV2();
  return (
    <group
      position={[0, -0.2, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <HermesOrb intensity={prefs.coreIntensity} reachable={reachable} waiting={0} />
      {/* generous invisible hit area around the orb */}
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[1.1, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ player */

type MoveInput = { x: number; y: number };

const WALK_SPEED = 5.6;
const RUN_SPEED = 10.3;
const JUMP_SPEED = 4.6;
const GRAVITY = 13;

/** Shared with the hands, so they can bob while walking and lift on a jump. */
type Motion = { moving: boolean; airborne: boolean; pointing: number };

function Player({ moveRef, lookRef, jumpRef, motionRef, locked, overview }: {
  moveRef: React.MutableRefObject<MoveInput>; lookRef: React.MutableRefObject<{ dx: number; dy: number }>;
  jumpRef: React.MutableRefObject<boolean>; motionRef: React.MutableRefObject<Motion>; locked: boolean; overview: boolean;
}) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const vertical = useRef({ y: 0, v: 0 });

  useEffect(() => {
    // Start between two agents (not inside one), facing the orb.
    camera.position.set(Math.cos(Math.PI / 2 + Math.PI / 6) * 4.8, EYE, Math.sin(Math.PI / 2 + Math.PI / 6) * 4.8);
    camera.lookAt(0, 1.4, 0);
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        jumpRef.current = true;
      }
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [camera, jumpRef]);

  // Overview: lift the camera above the room; back down where it was when leaving.
  const saved = useRef<{ pos: THREE.Vector3; quat: THREE.Quaternion } | null>(null);
  useEffect(() => {
    if (overview) {
      saved.current = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
      camera.position.set(0, 13, 12.5);
      camera.lookAt(0, 0.5, 0);
    } else if (saved.current) {
      camera.position.copy(saved.current.pos);
      camera.quaternion.copy(saved.current.quat);
      saved.current = null;
    }
  }, [overview, camera]);

  useFrame((_, dt) => {
    if (overview) return;
    const k = keys.current;
    let fx = moveRef.current.x, fz = moveRef.current.y;
    if (k.has("KeyW") || k.has("ArrowUp")) fz += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) fz -= 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) fx -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) fx += 1;

    // Touch look (pointer lock handles the mouse itself).
    if (!locked && (lookRef.current.dx || lookRef.current.dy)) {
      const euler = eulerRef.current;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= lookRef.current.dx * 0.005;
      euler.x = THREE.MathUtils.clamp(euler.x - lookRef.current.dy * 0.004, -1.2, 1.2);
      camera.quaternion.setFromEuler(euler);
      lookRef.current.dx = 0; lookRef.current.dy = 0;
    }

    // Jump: a simple vertical velocity with gravity; landing snaps back to eye height.
    const vert = vertical.current;
    if (jumpRef.current && vert.y <= 0.0001) vert.v = JUMP_SPEED;
    jumpRef.current = false;
    if (vert.v !== 0 || vert.y > 0) {
      vert.v -= GRAVITY * dt;
      vert.y = Math.max(0, vert.y + vert.v * dt);
      if (vert.y === 0) vert.v = 0;
    }
    motionRef.current.moving = Boolean(fx || fz);
    motionRef.current.airborne = vert.y > 0;

    if (fx || fz) {
      const speed = (k.has("ShiftLeft") || k.has("ShiftRight") ? RUN_SPEED : WALK_SPEED) * dt;
      const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const step = forward.multiplyScalar(fz).add(right.multiplyScalar(fx));
      if (step.lengthSq() > 1) step.normalize();
      camera.position.addScaledVector(step, speed);
      // Stay inside the room and out of the table.
      const flat = new THREE.Vector2(camera.position.x, camera.position.z);
      if (flat.length() > ROOM_RADIUS - 0.8) flat.setLength(ROOM_RADIUS - 0.8);
      if (flat.length() < 2.4) flat.setLength(2.4);
      camera.position.set(flat.x, EYE + vert.y, flat.y);
    } else {
      camera.position.setY(EYE + vert.y);
    }
  });
  return null;
}

/* ------------------------------------------------------------------ hands */

const SKIN = "#c98d63";
const SLEEVE = "#121a24";

function Finger({ x, length, curl, thumb = false }: { x: number; length: number; curl: number; thumb?: boolean }) {
  return (
    <group position={[x, thumb ? -0.005 : 0.0, thumb ? 0.01 : -0.045]} rotation={thumb ? [0.2, 0, x > 0 ? -0.9 : 0.9] : [-curl, 0, 0]}>
      <mesh position={[0, 0, -length / 2]} rotation-x={Math.PI / 2}>
        <capsuleGeometry args={[0.0105, length, 4, 8]} />
        <meshStandardMaterial color={SKIN} roughness={0.65} />
      </mesh>
    </group>
  );
}

/** One stylised hand: palm, four fingers, thumb, dark cuff with a cyan seam. */
function Hand({ side, pointing }: { side: 1 | -1; pointing: boolean }) {
  // Right hand points with the index finger; the others curl in.
  const curls = pointing && side === 1 ? [0.05, 1.3, 1.35, 1.4] : [0.35, 0.4, 0.45, 0.5];
  return (
    <group scale={[side, 1, 1]}>
      <RoundedBox args={[0.085, 0.028, 0.1]} radius={0.012} smoothness={3}>
        <meshStandardMaterial color={SKIN} roughness={0.65} />
      </RoundedBox>
      {[-0.03, -0.01, 0.01, 0.03].map((x, i) => (
        <Finger key={x} x={x} length={[0.055, 0.06, 0.056, 0.045][i]} curl={curls[i]} />
      ))}
      <Finger x={-0.045} length={0.04} curl={0} thumb />
      <mesh position={[0, 0, 0.085]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.042, 0.048, 0.08, 16]} />
        <meshStandardMaterial color={SLEEVE} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.046]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.043, 0.004, 6, 24]} />
        <meshBasicMaterial color="#5fe3ff" />
      </mesh>
    </group>
  );
}

/** First-person hands that follow the camera, bob while walking and point on click. */
function Hands({ motionRef, visible }: { motionRef: React.MutableRefObject<Motion>; visible: boolean }) {
  const { camera } = useThree();
  const rig = useRef<THREE.Group>(null);
  const [pointing, setPointing] = useState(false);
  const phase = useRef(0);
  const lift = useRef(0);

  useEffect(() => {
    const point = () => { motionRef.current.pointing = performance.now(); setPointing(true); };
    window.addEventListener("pointerdown", point);
    const t = window.setInterval(() => {
      if (performance.now() - motionRef.current.pointing > 450) setPointing(false);
    }, 150);
    return () => { window.removeEventListener("pointerdown", point); window.clearInterval(t); };
  }, [motionRef]);

  useFrame((_, dt) => {
    const g = rig.current;
    if (!g) return;
    const m = motionRef.current;
    phase.current += dt * (m.moving ? 9 : 1.6);
    lift.current = THREE.MathUtils.lerp(lift.current, m.airborne ? 0.05 : 0, Math.min(1, dt * 10));
    const bob = Math.sin(phase.current) * (m.moving ? 0.012 : 0.003);
    const sway = Math.cos(phase.current * 0.5) * (m.moving ? 0.008 : 0.002);
    g.position.copy(camera.position);
    g.quaternion.copy(camera.quaternion);
    g.translateX(sway);
    g.translateY(bob + lift.current);
  });

  if (!visible) return null;
  return (
    <group ref={rig}>
      <group scale={0.85}>
      <group position={[-0.19, -0.21, -0.42]} rotation={[0.35, 0.25, 0.35]}>
        <Hand side={-1} pointing={false} />
      </group>
      <group position={[0.19, -0.2, -0.42 - (pointing ? 0.06 : 0)]} rotation={[0.35 - (pointing ? 0.15 : 0), -0.25, -0.35]}>
        <Hand side={1} pointing={pointing} />
      </group>
      </group>
    </group>
  );
}

function Joystick({ moveRef }: { moveRef: React.MutableRefObject<MoveInput> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const handle = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.min(1, Math.hypot(x, y)) / (Math.hypot(x, y) || 1);
    setKnob({ x: x * len, y: y * len });
    moveRef.current = { x: x * len, y: -y * len };
  };
  const reset = () => { setKnob({ x: 0, y: 0 }); moveRef.current = { x: 0, y: 0 }; };
  return (
    <div ref={base} className="walk-joystick"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handle(e); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") handle(e); }}
      onPointerUp={reset} onPointerCancel={reset}>
      <div className="walk-joystick__knob" style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ screen */

export function WalkRoom() {
  const roster = useRoster();
  const live = useHermesLive(true);
  const activity = useAgentActivity(live);
  const [council, setCouncil] = useState(false);
  const [councilTopic, setCouncilTopic] = useState("");
  const [councilDraft, setCouncilDraft] = useState("");
  const [councilAsk, setCouncilAsk] = useState(false);
  const [perspectives, setPerspectives] = useState(false);
  const [teamChat, setTeamChat] = useState(false);
  const [note, setNote] = useState<VaultNode | null>(null);
  const [overview, setOverview] = useState(false);
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendState, setSendState] = useState<string | null>(null);
  const moveRef = useRef<MoveInput>({ x: 0, y: 0 });
  const jumpRef = useRef(false);
  const motionRef = useRef<Motion>({ moving: false, airborne: false, pointing: 0 });
  const lookRef = useRef({ dx: 0, dy: 0 });
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const controls = useRef<{ lock: () => void; unlock: () => void } | null>(null);
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const seats = useMemo(() => seatsFor(roster.agents.length), [roster.agents.length]);
  const chosen = roster.agents.find((a) => a.id === selected) ?? null;
  const chosenActivity = chosen ? activity[chosen.id] : undefined;

  const select = (id: string) => {
    setSelected(id);
    setNote(null);
    setTeamChat(false);
    setSendState(null);
    controls.current?.unlock();
  };

  // 3 · who goes where: the council table, a shared team spot when several agents
  // work at once, a step towards the orb when one works alone, otherwise its place.
  const busyIds = roster.agents.filter((a) => ["denkt", "arbeitet"].includes(activity[a.id]?.phase ?? "")).map((a) => a.id);
  const busyKey = busyIds.join(",");
  const goals = useMemo(() => {
    const busy = busyKey ? busyKey.split(",") : [];
    const indexOf = (id: string) => roster.agents.findIndex((a) => a.id === id);
    let teamSpot: THREE.Vector3 | null = null;
    if (busy.length >= 2) {
      const dir = new THREE.Vector3();
      busy.forEach((id) => dir.add(seats[indexOf(id)]?.desk ?? new THREE.Vector3()));
      if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
      teamSpot = dir.setY(0).normalize().multiplyScalar(4.3);
    }
    return roster.agents.map((agent, i) => {
      const seat = seats[i];
      if (!seat) return new THREE.Vector3();
      if (council) return seat.table;
      const k = busy.indexOf(agent.id);
      if (k >= 0 && teamSpot) {
        const a = (k / busy.length) * Math.PI * 2;
        return teamSpot.clone().add(new THREE.Vector3(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95));
      }
      if (k >= 0) return seat.desk.clone().multiplyScalar(0.72);
      return seat.desk;
    });
  }, [roster.agents, seats, council, busyKey]);

  // 2 · a council round with a topic: every agent gets the same question.
  const convene = async () => {
    const topic = councilDraft.trim();
    if (!topic) return;
    setCouncilTopic(topic);
    setCouncil(true);
    setCouncilAsk(false);
    setCouncilDraft("");
    const prompt = `Ratssitzung. Thema: ${topic}\nGib deine Einschätzung aus deiner Rolle in höchstens fünf Sätzen, auf Deutsch.`;
    await Promise.allSettled(roster.agents.map((agent) => live.call("chat.send", {
      sessionKey: `agent:${agent.id}:main`,
      message: prompt,
      idempotencyKey: `rat-${agent.id}-${Date.now()}`,
    })));
  };
  const dismissCouncil = () => { setCouncil(false); setCouncilTopic(""); };

  // 5 · team chat: everything the agents said, newest first; the input goes to Hermes.
  const feed = roster.agents
    .map((agent) => ({ agent, a: activity[agent.id] }))
    .filter((x) => x.a?.text)
    .sort((x, y) => (y.a?.since ?? 0) - (x.a?.since ?? 0));
  const hermes = roster.agents.find((a) => a.isDefault) ?? null;
  const [chatDraft, setChatDraft] = useState("");
  const sendTeam = async () => {
    if (!hermes || !chatDraft.trim()) return;
    await live.call("chat.send", { sessionKey: `agent:${hermes.id}:main`, message: chatDraft.trim(), idempotencyKey: `team-${Date.now()}` }).catch(() => undefined);
    setChatDraft("");
  };

  const send = async () => {
    if (!chosen || !draft.trim()) return;
    setSendState("wird gesendet …");
    try {
      await live.call("chat.send", {
        sessionKey: `agent:${chosen.id}:main`,
        message: draft.trim(),
        idempotencyKey: `walk-${Date.now()}`,
      });
      setDraft("");
      setSendState("gesendet – schau aufs Live-Fenster");
    } catch (error) {
      setSendState(error instanceof Error ? error.message : "Senden fehlgeschlagen");
    }
  };

  return (
    <div className="walk-root"
      onPointerDown={(e) => { if (touch && (e.target as HTMLElement).tagName === "CANVAS") lastTouch.current = { x: e.clientX, y: e.clientY }; }}
      onPointerMove={(e) => {
        if (!lastTouch.current) return;
        lookRef.current.dx += e.clientX - lastTouch.current.x;
        lookRef.current.dy += e.clientY - lastTouch.current.y;
        lastTouch.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => { lastTouch.current = null; }}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 70, near: 0.05, far: 80 }}>
        <color attach="background" args={["#03060b"]} />
        <GalaxyAtmosphere reducedMotion={false} />
        <hemisphereLight args={["#b8d8ff", "#0a1220", 0.9]} />
        <pointLight position={[0, 6, 0]} intensity={30} distance={22} color="#9fe8ff" />
        <directionalLight position={[6, 12, 5]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
        <PlainDisc />
        <Suspense fallback={null}><SpacePlatform /></Suspense>
        <CouncilRings />
        <Suspense fallback={null}><CouncilOrb reachable={roster.reachable} onSelect={() => { const hermes = roster.agents.find((a) => a.isDefault); if (hermes) select(hermes.id); }} /></Suspense>
        {roster.agents.map((agent, i) => (
          <Robot key={agent.id} agent={agent} seat={seats[i]} goal={goals[i] ?? seats[i].desk}
            activity={activity[agent.id] ?? { phase: "bereit", step: null, text: "", since: null }}
            selected={selected === agent.id} onSelect={() => select(agent.id)} />
        ))}
        <Suspense fallback={null}><KnowledgeCloud onSelect={(n) => { setNote(n); setSelected(null); setTeamChat(false); controls.current?.unlock(); }} /></Suspense>
        {councilTopic ? (
          <Html position={[0, 4.3, 0]} center distanceFactor={9} zIndexRange={[18, 0]}>
            <div className="walk-topic"><small>Rat tagt</small>{councilTopic}</div>
          </Html>
        ) : null}
        <Player moveRef={moveRef} lookRef={lookRef} jumpRef={jumpRef} motionRef={motionRef} locked={locked} overview={overview} />
        <Hands motionRef={motionRef} visible={!overview} />
        {!touch ? (
          <PointerLockControls ref={controls as never} selector="#walk-start"
            onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
        ) : null}
      </Canvas>

      <div className="walk-hud">
        <div className="walk-hud__title">Hermes · Walk-In</div>
        <div className="walk-hud__sub">
          {roster.loading ? "Agenten werden geladen …" : `${roster.agents.length} Agenten`} ·{" "}
          {LIVE_LABEL[live.status] ?? live.status}
        </div>
      </div>

      <div className="walk-actions">
        <button type="button" onClick={() => setOverview((o) => !o)}>{overview ? "Hineingehen" : "Von oben"}</button>
        <button type="button" onClick={() => { setTeamChat((t) => !t); setSelected(null); setNote(null); controls.current?.unlock(); }}>Teamchat</button>
        <button type="button" onClick={() => { if (council) dismissCouncil(); else { setCouncilAsk(true); controls.current?.unlock(); } }}>{council ? "Rat auflösen" : "Rat einberufen"}</button>
        <button type="button" onClick={() => { setPerspectives(true); controls.current?.unlock(); }}>Perspektivenrat</button>
        <Link href="/v2">Zurück zu Hermes</Link>
      </div>

      {!touch && !locked && !chosen && !overview && !note && !teamChat && !councilAsk && !perspectives ? (
        <button id="walk-start" type="button" className="walk-start">
          Klicken zum Laufen<br /><small>W A S D bewegen · Maus schauen · Shift schneller · Leertaste springen · Esc Maus frei · Agent anklicken (Esc, dann Klick)</small>
        </button>
      ) : null}
      {!touch && locked ? <div className="walk-crosshair" /> : null}
      {touch ? <Joystick moveRef={moveRef} /> : null}
      {touch && !overview ? (
        <button type="button" className="walk-jump" onPointerDown={(e) => { e.stopPropagation(); jumpRef.current = true; }}>Springen</button>
      ) : null}

      <nav className="walk-list" aria-label="Agenten">
        {roster.agents.map((agent, i) => {
          const a = activity[agent.id];
          return (
            <button key={agent.id} type="button" className={`walk-list__item ${selected === agent.id ? "is-on" : ""}`} onClick={() => select(agent.id)}>
              <i style={{ background: seats[i]?.color }} data-busy={["denkt", "arbeitet"].includes(a?.phase ?? "") || undefined} />
              <span>{displayName(agent)}</span>
              <small>{PHASE_LABEL[a?.phase ?? "bereit"]}</small>
            </button>
          );
        })}
      </nav>

      {perspectives ? <div className="pr-overlay" role="dialog" aria-label="Perspektivenrat" aria-modal="true"><PerspectivesPanel onClose={() => setPerspectives(false)} /></div> : null}

      {councilAsk ? (
        <div className="walk-dialog" role="dialog" aria-label="Rat einberufen">
          <h2>Rat einberufen</h2>
          <p>Worüber soll der Rat beraten? Alle {roster.agents.length} Agenten bekommen die Frage und antworten in ihren Fenstern.</p>
          <textarea autoFocus value={councilDraft} onChange={(e) => setCouncilDraft(e.target.value)} rows={3} placeholder="z. B. Soll ich diese Woche zuerst das Portfolio oder die Bewerbungen machen?"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void convene(); } }} />
          <div className="walk-dialog__row">
            <button type="button" onClick={() => setCouncilAsk(false)}>Abbrechen</button>
            <button type="button" className="is-primary" disabled={!councilDraft.trim() || live.status !== "connected"} onClick={() => void convene()}>Rat beginnt</button>
          </div>
        </div>
      ) : null}

      {note && !chosen ? (
        <aside className="walk-panel">
          <button type="button" className="walk-panel__close" onClick={() => setNote(null)} aria-label="Schließen">×</button>
          <p className="walk-panel__meta">Notiz · {note.folder || "Vault"} · {note.degree} Verbindungen</p>
          <h2>{note.name}</h2>
          {note.excerpt ? <p>{note.excerpt}</p> : <p>Keine Vorschau vorhanden.</p>}
        </aside>
      ) : null}

      {teamChat && !chosen && !note ? (
        <aside className="walk-panel">
          <button type="button" className="walk-panel__close" onClick={() => setTeamChat(false)} aria-label="Schließen">×</button>
          <h2>Teamchat</h2>
          <div className="walk-feed">
            {feed.length ? feed.map(({ agent, a }) => (
              <div key={agent.id} className="walk-feed__msg">
                <b>{displayName(agent)}</b> <small>{PHASE_LABEL[a!.phase]}</small>
                <p>{a!.text.slice(-500)}</p>
              </div>
            )) : <p className="walk-panel__hint">Noch keine Nachrichten. Sobald ein Agent arbeitet, erscheint es hier.</p>}
          </div>
          <textarea value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} rows={2} placeholder="Nachricht an Hermes …"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendTeam(); } }} />
          <button type="button" disabled={!chatDraft.trim() || live.status !== "connected"} onClick={() => void sendTeam()}>An Hermes senden</button>
        </aside>
      ) : null}

      {chosen ? (
        <aside className="walk-panel">
          <button type="button" className="walk-panel__close" onClick={() => setSelected(null)} aria-label="Schließen">×</button>
          <h2>{displayName(chosen)}</h2>
          <p className="walk-panel__meta">{chosen.model} · {providerLabel(chosen.provider)}{chosen.skillCount ? ` · ${chosen.skillCount} Fähigkeiten` : ""}</p>
          <p>{displayRole(chosen)}</p>
          <p className="walk-panel__status">Status: <b>{PHASE_LABEL[chosenActivity?.phase ?? "bereit"]}</b>{chosenActivity?.step ? ` · ${chosenActivity.step}` : ""}</p>
          {chosenActivity?.text ? <pre className="walk-panel__text">{chosenActivity.text}</pre> : null}
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Aufgabe für ${displayName(chosen)} …`} rows={3}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button type="button" onClick={() => void send()} disabled={!draft.trim() || live.status !== "connected"}>Senden</button>
          {sendState ? <p className="walk-panel__hint">{sendState}</p> : null}
        </aside>
      ) : null}
    </div>
  );
}
