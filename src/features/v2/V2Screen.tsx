"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { JarvisConsole } from "@/features/jarvis/JarvisConsole";
import { useV2 } from "@/features/v2/state";
import { useRoster } from "@/features/v2/useRoster";
import { useVault, type VaultNode } from "@/features/v2/useVault";
import { Dock } from "@/features/v2/hud/Dock";
import { Inspector } from "@/features/v2/hud/Inspector";
import { Settings } from "@/features/v2/hud/Settings";
import { StatusBar } from "@/features/v2/hud/StatusBar";
import { V2Scene } from "@/features/v2/world/V2Scene";

/**
 * V2, assembled.
 *
 * The 3D layer shows where things are and what state they are in. Every word
 * longer than a name lives in the DOM above it, sharp and selectable. That
 * split is the plan's, and it is also the only way text stays readable while
 * the renderer is free to drop its internal resolution.
 *
 * Nothing here fabricates. An unreachable Hermes shows as unreachable, a note
 * the graph does not know does not fly, and the council — which Hermes is
 * building in parallel — is named as not yet connected rather than simulated.
 */

/** Poll interval for approvals. Slow: a decision is not a per-second event. */
const APPROVAL_POLL_MS = 45_000;

export function V2Screen() {
  const roster = useRoster();
  const vault = useVault();
  const { world, selection, select, goTo, prefs, clearSelection } = useV2();

  const [jarvisOpen, setJarvisOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [meter, setMeter] = useState({ fps: 0, calls: 0, triangles: 0 });
  const [approvals, setApprovals] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch("/api/approvals")
        .then((response) => response.json())
        .then((data: { ok?: boolean; count?: number }) => {
          // Only a successful answer changes the number. A failed request must
          // never clear an amber light that is genuinely lit.
          if (!cancelled && data.ok) setApprovals(data.count ?? 0);
        })
        .catch(() => undefined);
    };
    poll();
    const timer = window.setInterval(poll, APPROVAL_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const selectAgent = useCallback(
    (id: string) => {
      select({ kind: "agent", id });
      setJarvisOpen(false);
    },
    [select],
  );

  const selectSource = useCallback(
    (node: VaultNode) => select({ kind: "source", id: node.id, title: node.name, folder: node.folder }),
    [select],
  );

  /**
   * Opening a note uses the path that already exists.
   *
   * `obsidian://` is how V1 opens a note and it is the right answer: the file
   * opens in Obsidian, with its own links and its own editor, instead of in a
   * viewer this project would then have to maintain.
   */
  const openSource = useCallback((id: string) => {
    window.location.href = `obsidian://open?vault=Life%20OS&file=${encodeURIComponent(id)}`;
  }, []);

  /** From home into the cosmos, with the note already chosen. */
  const diveToSource = useCallback(
    (id: string) => {
      const node = vault.byId.get(id);
      if (node) select({ kind: "source", id: node.id, title: node.name, folder: node.folder });
      goTo("cosmos");
    },
    [vault.byId, select, goTo],
  );

  /**
   * A Jarvis source can be flown to.
   *
   * This is the join between the two halves of section B: Jarvis names a note,
   * the sky flies it in, and the same id opens the same star in the cosmos.
   * One identifier throughout — which is why the selection survives the trip.
   */
  const flyToSource = useCallback(
    (id: string) => {
      const node = vault.byId.get(id);
      if (!node) return;
      select({ kind: "source", id: node.id, title: node.name, folder: node.folder });
      goTo("cosmos");
    },
    [vault.byId, select, goTo],
  );

  /**
   * Escape, as one chain with one owner.
   *
   * Settings, then the inspector, then Jarvis, then home — closing what is
   * open before leaving where you are. The plan asks for exactly this order,
   * and for Escape never to be taken out of a text field.
   *
   * The current values are read from a ref rather than from the closure. The
   * first version split this across two components and the second one saw the
   * state as it had been at its last render, so Escape closed the panel and
   * then declined to go home because it still believed something was selected.
   * A keyboard shortcut that depends on render timing is a shortcut that works
   * on the developer's machine.
   */
  const escapeState = useRef({ settingsOpen, selection, jarvisOpen, world });
  // Written in an effect, not during render. Assigning to a ref while
  // rendering is a rule this project has broken before, and the reason it is
  // a rule is that React may render without committing — the handler would
  // then act on a state that never reached the screen.
  useEffect(() => {
    escapeState.current = { settingsOpen, selection, jarvisOpen, world };
  }, [settingsOpen, selection, jarvisOpen, world]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const state = escapeState.current;
      if (state.settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (state.selection.kind !== "none") {
        clearSelection();
        return;
      }
      if (state.jarvisOpen) {
        setJarvisOpen(false);
        return;
      }
      if (state.world !== "home") goTo("home");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, clearSelection]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#05080d]">
      <V2Scene
        agents={roster.agents}
        rosterReachable={roster.reachable}
        approvalsWaiting={approvals}
        vault={vault}
        onSelectAgent={selectAgent}
        onSelectSource={selectSource}
        onFrame={devOpen ? setMeter : undefined}
      />

      <StatusBar
        agentCount={roster.agents.length}
        rosterReachable={roster.reachable}
        vaultCount={vault.nodes.length}
        vaultReachable={vault.reachable}
        approvalsWaiting={approvals}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleDev={() => setDevOpen((open) => !open)}
        devOpen={devOpen}
      />

      <Inspector
        agents={roster.agents}
        nodes={vault.nodes}
        onOpenSource={openSource}
        onDiveToSource={diveToSource}
      />

      <Dock jarvisOpen={jarvisOpen} onToggleJarvis={() => setJarvisOpen((open) => !open)} />

      {jarvisOpen ? (
        <section className="pointer-events-auto absolute bottom-20 left-1/2 z-30 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0a1018]/95 shadow-[0_18px_60px_rgba(0,0,0,.6)] backdrop-blur-md">
          <JarvisConsole
            compact
            noteCount={vault.nodes.length}
            onFlyToSource={flyToSource}
            onSourcesChange={(ids) => {
              // The first cited source becomes the selection, so the inspector
              // has something to show the moment an answer lands.
              const first = ids[0];
              if (!first) return;
              const node = vault.byId.get(first);
              if (node) select({ kind: "source", id: node.id, title: node.name, folder: node.folder });
            }}
          />
        </section>
      ) : null}

      {settingsOpen ? <Settings onClose={() => setSettingsOpen(false)} /> : null}

      {/* Developer values live behind their own switch, as the plan requires —
          fps and draw calls are not part of the room. */}
      {devOpen ? (
        <div className="pointer-events-none absolute bottom-5 right-5 z-30 rounded-xl border border-white/10 bg-[#0a1018]/90 px-3 py-2 font-mono text-[11px] text-cyan-200/80 backdrop-blur-md">
          {meter.fps} fps · {meter.calls} Draws · {(meter.triangles / 1000).toFixed(0)}k Dreiecke
          <span className="ml-2 text-white/25">
            {prefs.bloom ? "Bloom an" : "Bloom aus"}
          </span>
        </div>
      ) : null}

      {/* A dark room is the design. A dark room that is still loading has to
          say so — otherwise the two are indistinguishable. */}
      {roster.loading || vault.loading ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-20 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-white/35">
          Verbindung wird hergestellt…
        </div>
      ) : null}
    </main>
  );
}
