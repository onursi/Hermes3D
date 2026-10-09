"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { Maximize, RotateCcw } from "lucide-react";
import type { ObsidianGraphData } from "@/features/retro-office/scene/Obsidian3DGraphCore";
import { KnowledgeAreas } from "@/features/v2/knowledge/KnowledgeAreas";
import type { FocusRequest, KnowledgeNode, KnowledgeEdge } from "@/features/v2/knowledge/knowledgeTypes";
import { useKnowledgeScan } from "./useKnowledgeScan";
import "./knowledge.css";

function Sweep({ at, enabled }: { at: number; enabled: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ring.current) return;
    const age = (Date.now() - at) / 1000;
    ring.current.visible = enabled && age >= 0 && age < 2;
    ring.current.position.y = 12 - Math.min(1, age / 2) * 22;
  });
  return <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]} visible={false}><torusGeometry args={[13, .045, 8, 120]} /><meshBasicMaterial color="#78dfff" toneMapped={false} /></mesh>;
}
const AREAS: Record<string, string> = { projects: "05 🚀 Projekte", system: "02⚙️ System", inbox: "00📥Inbox", raw: "01📦RAW", knowledge: "07🧠Wissen", ideas: "09🅿️Ideenparkplatz", identity: "03🪪 Identität", profile: "04📖 Lebensprofil", sources: "08📚Quellen", interests: "06💡Interessen" };
function CameraFly({ destination }: { destination: FocusRequest | null }) {
  const controls = useRef<ComponentRef<typeof OrbitControls> | null>(null);
  const { camera, size } = useThree();
  const motion = useRef<{ end: THREE.Vector3; target: THREE.Vector3; remaining: number } | null>(null);
  useEffect(() => {
    const target = new THREE.Vector3(...(destination?.center || [0, 1, 0]));
    const distance = destination ? 13 : size.width < size.height ? 68 : 38;
    motion.current = { target, end: target.clone().add(new THREE.Vector3(0, distance * .18, distance)), remaining: 2.3 };
    const orbit = controls.current;
    return () => { if (orbit) orbit.enabled = true; };
  }, [destination, size.width, size.height]);
  useFrame((_, delta) => {
    const fly = motion.current, orbit = controls.current;
    if (!fly || !orbit) return;
    orbit.enabled = false;
    camera.position.lerp(fly.end, 1 - Math.exp(-delta * 3));
    orbit.target.lerp(fly.target, 1 - Math.exp(-delta * 3));
    orbit.update(); fly.remaining -= delta;
    if (fly.remaining <= 0) { motion.current = null; orbit.enabled = true; }
  });
  return <OrbitControls ref={controls} enableDamping dampingFactor={.06} minDistance={4} maxDistance={80} />;
}
export function KnowledgeMonitor() {
  const { state, connected } = useKnowledgeScan();
  const [data, setData] = useState<ObsidianGraphData | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [destination, setDestination] = useState<FocusRequest | null>(null);
  const [retry, setRetry] = useState(0);
  const focusNode = useCallback((focus: FocusRequest) => setDestination(focus), []);
  const { nodes, edges } = useMemo(() => ({
    nodes: (data?.nodes || []).map(n => ({ id: n.id, title: "", groupId: AREAS[n.group] || "Ungeordnet", degree: n.val } as KnowledgeNode)),
    edges: (data?.links || []).map(l => ({ sourceId: l.source, targetId: l.target } as KnowledgeEdge)),
  }), [data]);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/jarvis/knowledge?view=graph", { signal: abort.signal }).then(async response => { if (!response.ok) throw new Error(); return response.json(); }).then(value => { if (!abort.signal.aborted) { setData(value); setError(""); } }).catch(() => { if (!abort.signal.aborted) setError("Das Wissensnetz konnte nicht geladen werden."); });
    return () => abort.abort();
  }, [retry]);
  useEffect(() => {
    const reset = setTimeout(() => { setSelected(null); setDestination(null); }, 0);
    const timer = setTimeout(() => {
      if (state.phase !== "found") return;
      const node = data?.nodes.find(n => n.id === state.ids[0]);
      if (node) setSelected(node.id);
    }, state.phase === "found" ? Math.max(0, state.at + 1800 - Date.now()) : 0);
    return () => { clearTimeout(reset); clearTimeout(timer); };
  }, [state, data]);
  const label = !connected ? "VERBINDUNG WIRD GEPRÜFT" : state.phase === "found" ? "WISSEN GEFUNDEN" : state.phase === "searching" ? "ICH SUCHE IN DEINEN NOTIZEN" : state.phase === "missing" ? "KEINE PASSENDE DREHQUELLE" : state.phase === "error" ? "SUCHE NICHT VERFÜGBAR" : "DEIN WISSEN. VERBUNDEN.";
  return <main className="jk" data-phase={state.phase} data-version={state.version} data-hits={state.count}>
    <header><div>SECOND BRAIN<span>HERMES × JARVIS</span></div><nav><button aria-label="Gesamtes Gehirn zeigen" onClick={() => { setSelected(null); setDestination({ center: [0, 1, 0], radius: 12 }); requestAnimationFrame(() => setDestination(null)); }}><RotateCcw size={18} /></button><button aria-label="Gehirn Vollbild" onClick={() => { void document.documentElement.requestFullscreen?.().catch(() => {}); }}><Maximize size={18} /></button></nav></header>
    {data ? <Canvas camera={{ position: [0, 8, 38], fov: 42, near: .1, far: 500 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
      <color attach="background" args={["#02070e"]} /><ambientLight intensity={.6} /><pointLight position={[12, 16, 12]} intensity={2} color="#bce9ff" /><pointLight position={[-12, -8, -12]} intensity={1} color="#38bdf8" />
      <KnowledgeAreas nodes={nodes} edges={edges} selectedId={selected} onFocusRequest={focusNode} hideLabels autoRotate={false} focusSelected />
      <Sweep at={state.at} enabled={state.phase !== "idle" && state.phase !== "error"} />
      <CameraFly destination={destination} />
      <EffectComposer multisampling={0}><Bloom intensity={.55} luminanceThreshold={1.1} mipmapBlur /></EffectComposer>
    </Canvas> : <div className="jk-loading">{error || "DEIN WISSENSNETZ WIRD GELADEN"}{error && <button onClick={() => setRetry(n => n + 1)}>Erneut laden</button>}</div>}
    <footer role="status"><i /><span>{label}</span>{state.phase === "found" && <small>{state.count} {state.count === 1 ? "PASSENDE QUELLE" : "PASSENDE QUELLEN"}</small>}</footer>
    <aside>{data?.nodes.length || "—"} NOTIZEN · {data?.links.length || "—"} VERBINDUNGEN</aside>
  </main>;
}
