"use client";

import { Html, PointerLockControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";

import { useV2 } from "@/features/v2/state";
import { useHermesLive } from "@/features/v2/useHermesLive";
import { useRoster, type RosterAgent } from "@/features/v2/useRoster";
import type { VaultNode } from "@/features/v2/useVault";
import { GalaxyAtmosphere } from "@/features/v2/world/GalaxyAtmosphere";
import { HermesOrb } from "@/features/v2/world/HermesOrb";
import { AgentDeck, providerTone, type Seat as DeckSeat } from "@/features/v2/world/AgentDeck";

import { useAgentActivity, type AgentActivity } from "./agentActivity";
import { KnowledgeCloud } from "./KnowledgeCloud";
import { PerspectivesPanel } from "@/features/perspectives/PerspectivesPanel";
import { FirstPersonHands, type PlayerMotion } from "./FirstPersonHands";
import { GESTURES, isWalkInputTarget, type Gesture, type GestureClip } from "./gestures";
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

const ROBOT_SCALE = 1.45;

/** Same instanced robots as the Council; only their walking destinations differ. */
function WalkFigures({ agents, seats, goals, activity, selected, onSelect }: {
  agents: RosterAgent[]; seats: Seat[]; goals: THREE.Vector3[];
  activity: Record<string, AgentActivity>; selected: string | null; onSelect: (id: string) => void;
}) {
  const layout = useMemo<DeckSeat[]>(() => agents.map((agent, i) => ({ agent, position: seats[i].desk.clone().divideScalar(ROBOT_SCALE), angle: Math.PI / 2 - Math.atan2(-seats[i].desk.x, -seats[i].desk.z) })), [agents, seats]);
  const liveLayout = useRef(layout);
  useEffect(() => { liveLayout.current = layout; }, [layout]);
  const gaze = useMemo(() => Object.fromEntries(agents.map(a => [a.id, new THREE.Vector3()])), [agents]);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, .05);
    liveLayout.current.forEach((seat, i) => {
      target.copy(goals[i]).divideScalar(ROBOT_SCALE).sub(seat.position).setY(0);
      const distance = target.length();
      const walking = distance > .03;
      const yaw = walking ? Math.atan2(target.x, target.z) : Math.atan2(-seat.position.x, -seat.position.z);
      const desired = Math.PI / 2 - yaw;
      const difference = Math.atan2(Math.sin(desired - seat.angle), Math.cos(desired - seat.angle));
      seat.angle += difference * Math.min(1, dt * 6);
      if (walking) seat.position.add(target.multiplyScalar(Math.min(1, dt * 1.6 / ROBOT_SCALE / distance)));
      gaze[seat.agent.id].copy(camera.position).divideScalar(ROBOT_SCALE);
    });
  }, -1);
  return <>
    <group scale={ROBOT_SCALE}><AgentDeck seats={layout} selectedId={selected} focus={false} onSelect={onSelect} gazeTargetById={gaze} showLabels={false} followPositions /></group>
    {layout.map((seat, i) => <AgentWindows key={seat.agent.id} agent={seat.agent} seat={seats[i]} deckSeat={seat} activity={activity[seat.agent.id] ?? { phase: "bereit", step: null, text: "", since: null }} onSelect={() => onSelect(seat.agent.id)} />)}
  </>;
}

function AgentWindows({
  agent, seat, activity, deckSeat, onSelect,
}: {
  agent: RosterAgent; seat: Seat; activity: AgentActivity; deckSeat: DeckSeat;
  onSelect: () => void;
}) {
  const body = useRef<THREE.Group>(null);
  const busy = activity.phase === "denkt" || activity.phase === "arbeitet";
  const [, tick] = useState(0);

  // Re-render once a second while busy so the timer in the window runs.
  useEffect(() => {
    if (!busy) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [busy]);

  useFrame(() => { body.current?.position.copy(deckSeat.position).multiplyScalar(ROBOT_SCALE); });

  return (
    <group ref={body} position={seat.desk.toArray()}>
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
type Motion = PlayerMotion;

function Player({ moveRef, lookRef, jumpRef, motionRef, locked, overview, enabled }: {
  moveRef: React.MutableRefObject<MoveInput>; lookRef: React.MutableRefObject<{ dx: number; dy: number }>;
  jumpRef: React.MutableRefObject<boolean>; motionRef: React.MutableRefObject<Motion>; locked: boolean; overview: boolean; enabled: boolean;
}) {
  const { camera } = useThree();
  const keys = useRef(new Set<string>());
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const vertical = useRef({ y: 0, v: 0 });
  const inputEnabled = useRef(enabled);
  useEffect(() => { inputEnabled.current = enabled; if (!enabled) keys.current.clear(); }, [enabled]);

  useEffect(() => {
    // Start between two agents (not inside one), facing the orb.
    camera.position.set(Math.cos(Math.PI / 2 + Math.PI / 6) * 4.8, EYE, Math.sin(Math.PI / 2 + Math.PI / 6) * 4.8);
    camera.lookAt(0, 1.4, 0);
    const down = (e: KeyboardEvent) => {
      if (!inputEnabled.current || isWalkInputTarget(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        jumpRef.current = true;
      }
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => { keys.current.clear(); moveRef.current = { x: 0, y: 0 }; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [camera, jumpRef, moveRef]);

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

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, .05);
    if (overview || !enabled) {
      motionRef.current.moving = false;
      jumpRef.current = false;
      lookRef.current.dx = 0; lookRef.current.dy = 0;
      moveRef.current = { x: 0, y: 0 };
      return;
    }
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
  const motionRef = useRef<Motion>({ moving: false, airborne: false, pointing: 0, gesture: null });
  const lookRef = useRef({ dx: 0, dy: 0 });
  const lastTouch = useRef<{ x: number; y: number } | null>(null);
  const controls = useRef<{ lock: () => void; unlock: () => void } | null>(null);
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

  const seats = useMemo(() => seatsFor(roster.agents.length).map((seat, i) => ({ ...seat, color: providerTone(roster.agents[i].provider) })), [roster.agents]);
  const chosen = roster.agents.find((a) => a.id === selected) ?? null;
  const chosenActivity = chosen ? activity[chosen.id] : undefined;
  const controlsEnabled = !overview && !chosen && !note && !teamChat && !councilAsk && !perspectives;
  const [gesture, setGesture] = useState<GestureClip | null>(null);
  const triggerGesture = useCallback((kind: Gesture) => {
    if (!controlsEnabled) return;
    const clip = { kind, started: performance.now() };
    motionRef.current.gesture = clip;
    setGesture(clip);
  }, [controlsEnabled]);
  useEffect(() => {
    if (!gesture) return;
    const duration = GESTURES.find(g => g.id === gesture.kind)!.duration;
    const timer = window.setTimeout(() => { motionRef.current.gesture = null; setGesture(null); }, duration * 1000);
    return () => window.clearTimeout(timer);
  }, [gesture]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || !controlsEnabled || isWalkInputTarget(event.target)) return;
      const action = GESTURES.find(g => event.key === g.key || event.code === `Digit${g.key}` || event.code === `Numpad${g.key}`);
      if (action) { event.preventDefault(); triggerGesture(action.id); }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [controlsEnabled, triggerGesture]);

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
    <div className="walk-root" data-walk-gesture={gesture?.kind ?? "idle"}
      onPointerDown={(e) => { if (touch && controlsEnabled && (e.target as HTMLElement).tagName === "CANVAS") lastTouch.current = { x: e.clientX, y: e.clientY }; }}
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
        <WalkFigures agents={roster.agents} seats={seats} goals={goals} activity={activity} selected={selected} onSelect={select} />
        <Suspense fallback={null}><KnowledgeCloud onSelect={(n) => { setNote(n); setSelected(null); setTeamChat(false); controls.current?.unlock(); }} /></Suspense>
        {councilTopic ? (
          <Html position={[0, 4.3, 0]} center distanceFactor={9} zIndexRange={[18, 0]}>
            <div className="walk-topic"><small>Rat tagt</small>{councilTopic}</div>
          </Html>
        ) : null}
        <Player moveRef={moveRef} lookRef={lookRef} jumpRef={jumpRef} motionRef={motionRef} locked={locked} overview={overview} enabled={controlsEnabled} />
        <FirstPersonHands motionRef={motionRef} visible={controlsEnabled} />
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
        <button id="walk-start" type="button" className={`walk-start${gesture ? " is-hidden" : ""}`}>
          Klicken zum Laufen<br /><small>W A S D bewegen · Maus schauen · Shift schneller · Leertaste springen · 1 Daumen · 2 Fäuste · 3 Boxen · Esc Maus frei</small>
        </button>
      ) : null}
      {!touch && locked ? <div className="walk-crosshair" /> : null}
      {touch && controlsEnabled ? <Joystick moveRef={moveRef} /> : null}
      {touch && controlsEnabled ? (
        <button type="button" className="walk-jump" onPointerDown={(e) => { e.stopPropagation(); jumpRef.current = true; }}>Springen</button>
      ) : null}

      {controlsEnabled && <div className="walk-gestures" role="group" aria-label="Handgesten">
        {GESTURES.map(g => <button key={g.id} type="button" aria-label={g.label} aria-pressed={gesture?.kind === g.id} onClick={() => triggerGesture(g.id)}><span aria-hidden="true">{g.icon}</span><span>{g.label}</span>{!touch && <kbd>{g.key}</kbd>}</button>)}
        <span className="walk-gesture-status" role="status">{gesture ? GESTURES.find(g => g.id === gesture.kind)?.label : ""}</span>
      </div>}

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

      {perspectives ? createPortal(<div className="pr-overlay" role="dialog" aria-label="Perspektivenrat" aria-modal="true"><PerspectivesPanel onClose={() => setPerspectives(false)} /></div>, document.body) : null}

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
