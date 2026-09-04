"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BookmarkPlus, CornerDownLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { JarvisCore, type JarvisPhase } from "@/features/jarvis/JarvisCore";
import {
  Obsidian3DGraphCore,
  type GraphNode,
  type ObsidianGraphData,
} from "@/features/retro-office/scene/Obsidian3DGraphCore";

/**
 * Jarvis, on its own page.
 *
 * It lived as a panel inside the brain window, where it covered the thing it
 * was explaining — three separate fixes went into shoving the graph out from
 * behind it. That is the shape of a layout fighting itself. Here the two get
 * their own halves: the graph is the room, Jarvis is the column beside it,
 * and neither has to yield.
 *
 * The answer arrives as it is written, and the reactor shows which of four
 * real states the system is in. Both come from the same event stream, so the
 * display cannot claim to be thinking while nothing is happening.
 *
 * The canvas lighting is copied from the brain window rather than reinvented.
 * The first attempt here had ambient light only and the graph rendered black:
 * the nodes are standard materials, and without the three point lights there
 * is nothing for them to reflect.
 */

type Source = { id: string; title: string; folder: string; excerpt: string };

export default function JarvisPage() {
  const [data, setData] = useState<ObsidianGraphData | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [phase, setPhase] = useState<JarvisPhase>("idle");
  const [flyToNode, setFlyToNode] = useState<GraphNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Where a remembered answer landed, so the panel can say so and stop. */
  const [savedAs, setSavedAs] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const controlsRef = useRef<never>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetch("/api/obsidian-graph")
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.nodes?.length) setData(payload);
      })
      .catch(() => undefined);
  }, []);

  // A stream left open after the page closes keeps Hermes working on an
  // answer nobody will read.
  useEffect(() => () => streamRef.current?.close(), []);

  const ask = useCallback(() => {
    const text = question.trim();
    if (!text || phase === "searching" || phase === "thinking" || phase === "speaking") return;
    streamRef.current?.close();
    setAnswer("");
    setSources([]);
    setReason(null);
    setSavedAs(null);
    setPhase("searching");

    const source = new EventSource(`/api/jarvis/stream?q=${encodeURIComponent(text)}`);
    streamRef.current = source;

    source.addEventListener("state", (event) => {
      setPhase(JSON.parse((event as MessageEvent).data).phase as JarvisPhase);
    });
    source.addEventListener("sources", (event) => {
      setSources(JSON.parse((event as MessageEvent).data).sources ?? []);
    });
    source.addEventListener("delta", (event) => {
      setAnswer((prev) => prev + JSON.parse((event as MessageEvent).data).text);
    });
    source.addEventListener("done", () => {
      setPhase("idle");
      source.close();
    });
    source.addEventListener("error", (event) => {
      // Two different errors arrive on this name: ours, which carries a
      // reason, and the browser's when the connection drops. Only the first
      // has anything worth showing.
      const raw = (event as MessageEvent).data;
      if (raw) {
        try {
          setReason(JSON.parse(raw).reason ?? "Unbekannter Fehler.");
        } catch {
          setReason("Unbekannter Fehler.");
        }
        setPhase("error");
      } else if (phase !== "idle") {
        setPhase("idle");
      }
      source.close();
    });
  }, [question, phase]);

  /**
   * Follow the answer while it is being written, then return to the top.
   *
   * Following the tail is right during writing — you watch it arrive. It is
   * wrong the moment it stops, because then you are parked at the end of a
   * text you have not read yet and have to scroll up to start it.
   */
  useEffect(() => {
    if (!answerRef.current) return;
    if (phase === "speaking") {
      answerRef.current.scrollTop = answerRef.current.scrollHeight;
    } else if (phase === "idle" && answer) {
      answerRef.current.scrollTop = 0;
    }
  }, [answer, phase]);

  /**
   * Keep this answer as a note in the vault.
   *
   * Asking only reads. Without a way back in, everything worked out in a
   * conversation is gone when the tab closes, and the second brain quietly
   * falls behind what you actually know. The note lands in the Inbox with
   * the question and the sources it was built from, so it can be checked
   * later rather than trusted now.
   */
  const remember = useCallback(async () => {
    if (!answer || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/jarvis/remember", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer, question, sources }),
      });
      const data = await res.json();
      setSavedAs(data.ok ? data.file : null);
      if (!data.ok) setReason(data.reason ?? "Konnte nicht gespeichert werden.");
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [answer, question, sources, saving]);

  const flyTo = useCallback(
    (sourceId: string) => {
      const node = data?.nodes.find((candidate) => candidate.id === sourceId);
      if (!node) return;
      setSelectedId(node.id);
      setFlyToNode(node);
    },
    [data],
  );

  const busy = phase === "searching" || phase === "thinking" || phase === "speaking";

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#05070a] text-white">
      <section className="relative min-w-0 flex-1">
        {data ? (
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
              controlsRef={controlsRef}
            />
            <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} maxDistance={70} />
          </Canvas>
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
        <div className="flex flex-col items-center gap-1 border-b border-white/[0.07] px-6 py-6">
          <JarvisCore phase={phase} />
          <p className="mt-3 text-center text-[11px] leading-relaxed text-white/35">
            Antworten kommen ausschließlich aus deinen {data?.nodes.length ?? 0} Notizen — mit
            Quellen, oder gar nicht.
          </p>
        </div>

        <div className="border-b border-white/[0.07] p-4">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-black/40 px-3 py-2.5">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") ask();
              }}
              placeholder="Was denke ich über…?"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/25"
            />
            <button
              type="button"
              onClick={ask}
              disabled={busy || !question.trim()}
              className="shrink-0 text-white/50 hover:text-white disabled:opacity-25"
              title="Fragen"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CornerDownLeft size={15} />}
            </button>
          </div>
        </div>

        <div ref={answerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {answer ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/95">
              {answer}
              {phase === "speaking" ? (
                <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-cyan-300/70 align-middle" />
              ) : null}
            </p>
          ) : null}

          {reason ? (
            <p className="text-[12px] leading-relaxed text-amber-200/80">{reason}</p>
          ) : null}

          {answer && phase === "idle" ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void remember()}
                disabled={saving || Boolean(savedAs)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/60 transition hover:border-white/20 hover:text-white/90 disabled:opacity-40"
                title="Legt diese Antwort mit Frage und Quellen als Notiz in der Inbox ab"
              >
                <BookmarkPlus size={11} />
                <span>{savedAs ? "gemerkt" : saving ? "speichert…" : "Merken"}</span>
              </button>
              {savedAs ? (
                <span className="truncate text-[10px] text-white/35" title={savedAs}>
                  {savedAs}
                </span>
              ) : null}
            </div>
          ) : null}

          {sources.length > 0 ? (
            <div className="mt-5 border-t border-white/[0.07] pt-3">
              <p className="pb-2 text-[10px] font-semibold tracking-[-0.005em] text-white/40">
                Quellen — anklicken, um hinzufliegen
              </p>
              <ol className="space-y-0.5">
                {sources.map((source, index) => (
                  <li key={source.id}>
                    <button
                      type="button"
                      onClick={() => flyTo(source.id)}
                      className={`flex w-full gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06] ${
                        selectedId === source.id ? "bg-white/[0.08]" : ""
                      }`}
                      title={source.folder}
                    >
                      <span className="shrink-0 font-mono text-[11px] text-white/35">
                        [{index + 1}]
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-white/80">
                        {source.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      </aside>
    </main>
  );
}
