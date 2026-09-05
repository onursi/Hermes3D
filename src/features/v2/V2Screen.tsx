"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { JarvisConsole } from "@/features/jarvis/JarvisConsole";
import { shelfFor } from "@/features/v2/libraryItems";
import { useV2 } from "@/features/v2/state";
import { WorldBoundary } from "@/features/v2/WorldBoundary";
import { useProjects, type Project } from "@/features/v2/useProjects";
import { useRoster } from "@/features/v2/useRoster";
import { useVault, type VaultNode } from "@/features/v2/useVault";
import { Approvals, type PendingApproval } from "@/features/v2/hud/Approvals";
import { Dock } from "@/features/v2/hud/Dock";
import { Inspector } from "@/features/v2/hud/Inspector";
import { SearchField } from "@/features/v2/hud/SearchField";
import { Settings } from "@/features/v2/hud/Settings";
import { StatusBar } from "@/features/v2/hud/StatusBar";
import { SystemState } from "@/features/v2/hud/SystemState";
import { TravelBar } from "@/features/v2/hud/TravelBar";
import { placesFor, type Place } from "@/features/v2/universe/places";
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
  const projects = useProjects();
  const { world, selection, select, goTo, prefs, clearSelection, setTravelling } = useV2();

  const [jarvisOpen, setJarvisOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [meter, setMeter] = useState({ fps: 0, calls: 0, triangles: 0 });
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** What the flight is close enough to enter. Owned here, because the offer is HUD. */
  const [reachable, setReachable] = useState<Place | null>(null);
  /**
   * `?lab=1` — read after mount, never during render.
   *
   * V1 aborted its tree three separate times by reading a URL flag while
   * rendering: the server has no `window`, so the two passes disagreed. The
   * flag defaults to off, which is also the correct answer for the server.
   */
  const [labMode, setLabMode] = useState(false);
  /**
   * `?boom=<welt>` — the only way to prove the error boundary works.
   *
   * A boundary nobody has ever seen catch anything is a claim, not a feature.
   * This makes the named world throw on entry, so the acceptance run can check
   * that the HUD survives and that leaving and returning rebuilds the room.
   * It does nothing without the parameter, and the parameter is only ever
   * typed on purpose.
   */
  const [crashWorld, setCrashWorld] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLabMode(params.get("lab") === "1");
    setCrashWorld(params.get("boom"));
  }, []);
  /**
   * The queue itself, not just its length.
   *
   * The count alone was enough to make the core pulse and not enough to answer
   * the only question the pulse raises. `reachable` is carried beside the list
   * because a failed request must never clear an amber light that is genuinely
   * lit — nor render as an empty queue.
   */
  const [approvalState, setApprovalState] = useState<{
    items: PendingApproval[];
    reachable: boolean;
  }>({ items: [], reachable: true });
  const approvals = approvalState.items.length;

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      fetch("/api/approvals")
        .then((response) => response.json())
        .then((data: { ok?: boolean; approvals?: PendingApproval[] }) => {
          if (cancelled) return;
          if (data.ok) setApprovalState({ items: data.approvals ?? [], reachable: true });
          // A failed poll keeps the last known list and says it is stale,
          // rather than reporting an empty queue it never actually saw.
          else setApprovalState((previous) => ({ ...previous, reachable: false }));
        })
        .catch(() => {
          if (!cancelled) setApprovalState((previous) => ({ ...previous, reachable: false }));
        });
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

  /**
   * The shelf, derived rather than fetched.
   *
   * The library reads the same vault the cosmos and the horizon read — one
   * source, three ways of standing in front of it. There is no second request
   * and no second copy; a shelf that fetched its own notes could disagree with
   * the sky about what the vault contains.
   */
  const libraryItems = useMemo(
    () => shelfFor(vault.nodes, vault.links, selection.kind === "source" ? selection.id : null),
    [vault.nodes, vault.links, selection],
  );

  /**
   * The map of the universe, derived once from the real projects.
   *
   * The library appears out there only under `?lab=1`, for the same reason it
   * is not in the dock: it is Antigravity's room, integrated but not yet seen
   * by ASTRA. A silhouette on the horizon is a promise that the place is
   * finished, and that promise is not ours to make yet.
   */
  const places = useMemo(
    () => placesFor(projects.projects, labMode),
    [projects.projects, labMode],
  );

  /**
   * Entering a place from the flight.
   *
   * Direct, always. He has already flown there — making him watch a warp on
   * arrival would be the forced transition, reintroduced at the one moment he
   * has most clearly earned the opposite.
   */
  const enterPlace = useCallback(
    (place: Place) => {
      if (place.projectFolder) {
        const project = projects.projects.find((item) => item.folder === place.projectFolder);
        // The station he flew to becomes the selection, so the yard opens on
        // the project he actually aimed at rather than on nothing.
        if (project) select({ kind: "project", folder: project.folder, name: project.name });
      }
      goTo(place.world, "direct");
    },
    [projects.projects, select, goTo],
  );

  /** The library hands back an id; the vault turns it into a selection. */
  const selectSourceId = useCallback(
    (id: string) => {
      const node = vault.byId.get(id);
      if (node) select({ kind: "source", id: node.id, title: node.name, folder: node.folder });
    },
    [vault.byId, select],
  );

  const selectProject = useCallback(
    (project: Project) => select({ kind: "project", folder: project.folder, name: project.name }),
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
  const escapeState = useRef({ settingsOpen, approvalsOpen, query, selection, jarvisOpen, world });
  // Written in an effect, not during render. Assigning to a ref while
  // rendering is a rule this project has broken before, and the reason it is
  // a rule is that React may render without committing — the handler would
  // then act on a state that never reached the screen.
  useEffect(() => {
    escapeState.current = { settingsOpen, approvalsOpen, query, selection, jarvisOpen, world };
  }, [settingsOpen, approvalsOpen, query, selection, jarvisOpen, world]);

  /**
   * Enter enters. Same ref discipline as Escape, and for the same reason.
   *
   * Kept separate from the Escape chain rather than folded into one handler:
   * one is "undo the last layer" and the other is "act on what is in front of
   * me", and merging two different questions into one switch is how a
   * shortcut table becomes something you have to memorise.
   */
  const enterState = useRef({ reachable, world });
  useEffect(() => {
    enterState.current = { reachable, world };
  }, [reachable, world]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const state = enterState.current;
      if (state.world !== "universe" || !state.reachable) return;
      // A focused button treats Enter as a click, and the button he most
      // likely focused last is the dock's "Reisen" — so entering a place and
      // being thrown straight back out into the universe happened in the same
      // keystroke. Claiming the key stops the second half.
      event.preventDefault();
      enterPlace(state.reachable);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enterPlace]);

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
      if (state.approvalsOpen) {
        setApprovalsOpen(false);
        return;
      }
      // A search is a layer too: clearing it before the selection means Escape
      // undoes the last thing done, which is the only order a person can
      // predict without learning a table.
      if (state.query) {
        setQuery("");
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
      {/* Only the canvas is inside the boundary. Everything below it — status
          bar, dock, inspector — stays mounted when a world dies, so the way
          home is still where it always is. */}
      <WorldBoundary
        resetKey={world}
        onError={() => {
          // The dock disables itself while a journey is in progress, and the
          // journey is ended by the scene — which has just been unmounted for
          // throwing. Without this the buttons stay dead for good: the crash
          // screen said "use the dock below" next to a dock that could not be
          // clicked. An escape hatch that locks on the way out is worse than
          // none, because it is trusted.
          setTravelling(false);
        }}
      >
      <V2Scene
        agents={roster.agents}
        rosterReachable={roster.reachable}
        approvalsWaiting={approvals}
        vault={vault}
        projects={projects.projects}
        libraryItems={libraryItems}
        query={world === "cosmos" ? query : ""}
        onSelectAgent={selectAgent}
        onSelectSource={selectSource}
        onSelectSourceId={selectSourceId}
        onSelectProject={selectProject}
        places={places}
        onReachChange={setReachable}
        onFrame={devOpen ? setMeter : undefined}
        crashWorld={crashWorld}
      />
      </WorldBoundary>

      <StatusBar
        agentCount={roster.agents.length}
        rosterReachable={roster.reachable}
        vaultCount={vault.nodes.length}
        vaultReachable={vault.reachable}
        approvalsWaiting={approvals}
        approvalsReachable={approvalState.reachable}
        onOpenApprovals={() => setApprovalsOpen((open) => !open)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleDev={() => setDevOpen((open) => !open)}
        devOpen={devOpen}
      />

      {/* The search belongs to the cosmos: it is the world with 273 things in
          it and no other way to ask where one of them is. */}
      {world === "cosmos" ? (
        <SearchField
          nodes={vault.nodes}
          query={query}
          onQuery={setQuery}
          onPick={selectSource}
          selectedId={selection.kind === "source" ? selection.id : null}
        />
      ) : null}

      {approvalsOpen ? (
        <Approvals
          approvals={approvalState.items}
          reachable={approvalState.reachable}
          onClose={() => setApprovalsOpen(false)}
        />
      ) : (
        <Inspector
          agents={roster.agents}
          nodes={vault.nodes}
          projects={projects.projects}
          onOpenSource={openSource}
          onDiveToSource={diveToSource}
        />
      )}

      {world === "universe" ? <TravelBar reachable={reachable} onEnter={enterPlace} /> : null}

      <Dock
        jarvisOpen={jarvisOpen}
        onToggleJarvis={() => setJarvisOpen((open) => !open)}
        showLibrary={labMode}
      />

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

      {/* A dark room is the design. A dark room that is still loading, one
          whose backend is down, and one that is genuinely empty produced the
          same picture — which is the most common way a system lies quietly. */}
      <SystemState
        sources={[
          {
            label: "Hermes",
            loading: roster.loading,
            reachable: roster.reachable,
            count: roster.agents.length,
            error: roster.error,
          },
          {
            label: "Vault",
            loading: vault.loading,
            reachable: vault.reachable,
            count: vault.nodes.length,
          },
          {
            label: "Projekte",
            loading: projects.loading,
            reachable: projects.reachable,
            count: projects.projects.length,
            error: projects.error,
          },
        ]}
      />
    </main>
  );
}
