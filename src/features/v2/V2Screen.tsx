"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { JarvisConsole } from "@/features/jarvis/JarvisConsole";
import { shelfFor } from "@/features/v2/libraryItems";
import { useV2 } from "@/features/v2/state";
import { WorldBoundary } from "@/features/v2/WorldBoundary";
import { useProjects, type Project } from "@/features/v2/useProjects";
import { useRoster } from "@/features/v2/useRoster";
import { useHermesLive } from "@/features/v2/useHermesLive";
import { useVault, type VaultNode } from "@/features/v2/useVault";
import { Approvals, type PendingApproval } from "@/features/v2/hud/Approvals";
import { Dock } from "@/features/v2/hud/Dock";
import { Inspector } from "@/features/v2/hud/Inspector";
import { AreaPanel, type AreaEntry } from "@/features/v2/hud/AreaPanel";
import { Cockpit } from "@/features/v2/hud/Cockpit";
import { Neighbourhood } from "@/features/v2/hud/Neighbourhood";
import { Reader } from "@/features/v2/hud/Reader";
import { SearchField } from "@/features/v2/hud/SearchField";
import { Settings } from "@/features/v2/hud/Settings";
import { AtmosphereAudio } from "@/features/v2/hud/AtmosphereAudio";
import { StatusBar } from "@/features/v2/hud/StatusBar";
import { SystemState } from "@/features/v2/hud/SystemState";
import { TravelBar } from "@/features/v2/hud/TravelBar";
import { neighboursOf } from "@/features/v2/graph";
import { areaRadius, BRAIN_CENTERS } from "@/features/v2/knowledge/brainLayout";
import { adaptVaultToKnowledge } from "@/features/v2/knowledge/adaptVault";
import { playArrive, playSelect } from "@/features/v2/sound";
import type { MarkerRegistry } from "@/features/v2/universe/CockpitProjector";
import { placesFor, type Place } from "@/features/v2/universe/places";
import { V2Scene } from "@/features/v2/world/V2Scene";
import { JarvisCompanion } from "@/features/v2/jarvis";

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
  /**
   * Die offene Leitung zu Hermes.
   *
   * Bisher hat V2 gefragt und Antworten aufgehoben. Was gerade passiert —
   * ein Agent, der arbeitet, eine Freigabe, die eintrifft — kommt über diese
   * Verbindung, oder es kommt gar nicht. Sie erzeugt keinen zweiten
   * Zustandsspeicher: der Roster bleibt der Roster.
   */
  const [liveMode, setLiveMode] = useState(false);
  const live = useHermesLive(liveMode);
  const { world, selection, select, goTo, prefs, clearSelection, setTravelling } = useV2();

  const [jarvisOpen, setJarvisOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [meter, setMeter] = useState({ fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, loops: 0 });
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** What the flight is close enough to enter. Owned here, because the offer is HUD. */
  const [reachable, setReachable] = useState<Place | null>(null);
  /**
   * Die Cockpit-Marken: HTML-Knoten, die in der Canvas bewegt werden.
   *
   * Ein Ref und kein Zustand, und das ist der ganze Trick: die Positionen
   * aendern sich sechzig Mal pro Sekunde, der Aufbau der Anzeige nie. Ueber
   * React-Zustand waeren das sechzig Renderdurchlaeufe fuer eine Zahl.
   */
  const cockpitMarkers = useRef<MarkerRegistry>(new Map());
  /**
   * Eine Kamerabitte aus dem HUD, mit Zaehler.
   *
   * Der Zaehler macht denselben Klick zweimal wirksam: wer ein Areal anwaehlt,
   * hinfliegt, sich umsieht und wieder klickt, will wieder hin — ohne ihn
   * saehe React zweimal denselben Wert und taete nichts.
   */
  const [focusRequest, setFocusRequest] = useState<{
    center: [number, number, number];
    radius: number;
    seq: number;
  } | null>(null);
  /**
   * The note being read, by id. Null when the reader is closed.
   *
   * Separate from the selection on purpose: selecting a star in the knowledge
   * world should light up its neighbours, not shove a document over half the
   * screen. Reading is a second, deliberate step — and closing the reader
   * leaves the selection standing where it was.
   */
  const [readerId, setReaderId] = useState<string | null>(null);
  /**
   * Die Notiz, deren Nachbarschaft er zugeklappt hat — nicht ein Ja/Nein.
   *
   * Ein Schalter müsste beim Wechsel der Auswahl zurückgesetzt werden, und
   * das wäre wieder ein Effekt, der Zustand schreibt. Die weggeklickte ID zu
   * merken beantwortet dieselbe Frage beim Rendern: das Netz ist offen,
   * solange die Auswahl nicht die ist, die er geschlossen hat.
   */
  const [dismissedGraphId, setDismissedGraphId] = useState<string | null>(null);
  /**
   * Durch den Wissenskoerper fliegen statt ihn zu umkreisen.
   *
   * Onurs Einwand war richtig: man stand davor. Umkreisen zeigt die Form,
   * Durchfliegen zeigt, dass es ein Inneres gibt — zwischen den Arealen
   * hindurch, an den Bahnen entlang. Es ist dieselbe Steuerung wie im All,
   * nur langsamer und mit einer engeren Grenze, weil hier alles nah steht.
   */
  const [flyThrough, setFlyThrough] = useState(false);
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
    // `?live=1` schaltet die offene Leitung zu Hermes ein.
    //
    // Sie funktioniert — der Server nimmt sie an, die Methodenliste kommt an,
    // und der Council waere darueber erreichbar. Sie kostet in meiner Messung
    // aber reproduzierbar Bildrate: 56 fps ohne, 32 fps mit, nach vier
    // Weltwechseln, bei gleicher Draw- und Geometriezahl. Warum, weiss ich
    // noch nicht. Etwas Ungeklaertes, das die Haelfte der Bildrate kostet,
    // gehoert nicht als Standard in ein Produkt — also hinter einen Schalter,
    // bis die Ursache bekannt ist.
    setLiveMode(params.get("live") === "1");
    setCrashWorld(params.get("boom"));
  }, []);

  const [saturnSubView, setSaturnSubView] = useState<"saturn" | "orbit">("saturn");

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
      // Arriving somewhere is worth a sound; it is silent unless he turned it
      // on, and the entry offer said the same thing in text a moment ago.
      playArrive(prefs.sound);
      if (place.projectFolder) {
        const project = projects.projects.find((item) => item.folder === place.projectFolder);
        // The station he flew to becomes the selection, so the yard opens on
        // the project he actually aimed at rather than on nothing.
        if (project) select({ kind: "project", folder: project.folder, name: project.name });
      }
      goTo(place.world, "direct");
    },
    [projects.projects, select, goTo, prefs.sound],
  );

  /** The library and the knowledge areas hand back an id; the vault turns it into a selection. */
  const selectSourceId = useCallback(
    (id: string) => {
      const node = vault.byId.get(id);
      if (!node) return;
      select({ kind: "source", id: node.id, title: node.name, folder: node.folder });
      playSelect(prefs.sound);
    },
    [vault.byId, select, prefs.sound],
  );

  /**
   * The note in the reader, and its real neighbours.
   *
   * Neighbours come from the graph's own links — the same links the knowledge
   * world draws. Nothing is inferred: if the vault records no connection, the
   * footer is empty rather than filled with things that merely look related.
   */
  const readerNode = readerId ? (vault.byId.get(readerId) ?? null) : null;
  const readerNeighbours = useMemo(
    () => (readerId ? neighboursOf(readerId, vault.links, vault.byId) : []),
    [readerId, vault.links, vault.byId],
  );

  /**
   * Die Areale, wie sie im Raum stehen.
   *
   * Aus denselben Quellen wie der Koerper selbst: die Zentren und die Groesse
   * aus brainLayout.ts, die Anzahl aus den echten Notizen. Die Liste kann
   * deshalb nicht behaupten, was der Raum nicht zeigt.
   */
  /**
   * Der Vault in der Form, die W1 braucht — einmal, hier oben.
   *
   * Lag vorher in der Szene. Jetzt brauchen ihn zwei: der Raum zum Zeichnen
   * und die Menueleiste zum Zaehlen. Zweimal rechnen hiesse zwei Antworten
   * auf "wie viele Notizen liegen in Projekte".
   */
  const knowledge = useMemo(
    () => adaptVaultToKnowledge(vault.nodes, vault.links),
    [vault.nodes, vault.links],
  );

  const areas = useMemo<AreaEntry[]>(() => {
    const counts = new Map<string, number>();
    for (const node of knowledge.nodes) {
      const id = node.groupId ?? "Ungeordnet";
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        label: id,
        count,
        center: (BRAIN_CENTERS[id] ?? [9, 0, 0]) as [number, number, number],
        radius: areaRadius(count),
      }))
      .sort((a, b) => b.count - a.count);
  }, [knowledge.nodes]);

  /** Die Notiz, um die das flache Netz gerade gezeichnet wird. */
  const graphNode =
    selection.kind === "source" && selection.id !== dismissedGraphId
      ? (vault.byId.get(selection.id) ?? null)
      : null;

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
  /**
   * Open a note — here, in the room.
   *
   * This used to set `window.location.href` to an `obsidian://` link, which
   * is the behaviour V6-05 asks us to end: the note arrives in front of him
   * instead of handing the whole session to another application. Obsidian is
   * still reachable from inside the reader, as a choice.
   */
  const openSource = useCallback((id: string) => setReaderId(id), []);

  const openInObsidian = useCallback((id: string) => {
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
  const escapeState = useRef({ readerId, settingsOpen, approvalsOpen, query, selection, jarvisOpen, world });
  // Written in an effect, not during render. Assigning to a ref while
  // rendering is a rule this project has broken before, and the reason it is
  // a rule is that React may render without committing — the handler would
  // then act on a state that never reached the screen.
  useEffect(() => {
    escapeState.current = { readerId, settingsOpen, approvalsOpen, query, selection, jarvisOpen, world };
  }, [readerId, settingsOpen, approvalsOpen, query, selection, jarvisOpen, world]);

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
      // The reader is the topmost layer and the largest, so it closes first.
      // Escape means "undo the last thing", and opening a document is the
      // most recent thing that can be open.
      if (state.readerId) {
        setReaderId(null);
        return;
      }
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
        onSelectSourceId={selectSourceId}
        onSelectProject={selectProject}
        places={places}
        onReachChange={setReachable}
        cockpitMarkers={cockpitMarkers}
        knowledge={knowledge}
        focusRequest={focusRequest}
        flyThrough={flyThrough}
        inputBlocked={readerId !== null}
        onFrame={devOpen ? setMeter : undefined}
        crashWorld={crashWorld}
      />
      </WorldBoundary>

      <AtmosphereAudio />
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

      {/* Eine rechte Spalte statt zweier Kästen, die sich um dieselbe Ecke
          streiten. Vorher stand der Inspektor absolut oben rechts und die
          Arealliste absolut unten rechts; beide wuchsen aufeinander zu, und
          sobald sie sich trafen, landete ein Klick auf dem Inspektor in der
          Arealliste — die steht später im Dokument und gewann bei gleichem z.
          Ein höheres z hätte den Fehler nur umgedreht statt behoben. Hier
          liegen sie untereinander, also kann sich nichts mehr überdecken.

          Der Inspektor schrumpft zuerst (`shrink` und `min-h-0`), weil die
          Arealliste ihre Höhe selbst kennt; so bleibt die Spalte auch auf
          niedrigen Fenstern innerhalb ihrer Grenzen. */}
      {world !== "saturn" ? (
      <div className="pointer-events-none absolute right-4 top-16 bottom-20 z-30 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
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
            councilAvailable={live.methods.includes("council.start")}
          />
        )}

        {/* Die Areale gehoeren in die Wissenswelt und nirgendwo sonst: dort
            stehen sie im Raum, und dort ist die Liste die zweite Art, sich zu
            bewegen. */}
        {world === "cosmos" ? (
          <AreaPanel
            areas={areas}
            flying={flyThrough}
            onToggleFlight={() => setFlyThrough((value) => !value)}
            activeId={
              selection.kind === "source"
                ? (vault.byId.get(selection.id)?.folder ?? null)
                : null
            }
            onFocus={(area) =>
              setFocusRequest((previous) => ({
                center: area.center,
                radius: area.radius,
                seq: (previous?.seq ?? 0) + 1,
              }))
            }
          />
        ) : null}
      </div>
      ) : null}

      <Reader
        node={readerNode}
        onClose={() => setReaderId(null)}
        onOpenExternally={openInObsidian}
        onOpenNeighbour={(id) => {
          // Reading a neighbour also selects it, so the room behind the panel
          // keeps up: close the reader and the star he just read about is the
          // one that is lit.
          selectSourceId(id);
          setReaderId(id);
        }}
        neighbours={readerNeighbours}
      />

      {/* Flach neben dem Raum: der Raum sagt, wo etwas liegt, das Netz sagt,
          woran es hängt. In 3D ist die zweite Frage nicht beantwortbar —
          zwei Punkte überdecken sich oder verstecken sich hintereinander. */}
      <Neighbourhood
        node={graphNode}
        links={vault.links}
        byId={vault.byId}
        onSelect={selectSourceId}
        onRead={setReaderId}
        onClose={() => setDismissedGraphId(graphNode?.id ?? null)}
      />

      {world === "universe" ? (
        <>
          <Cockpit places={places} markers={cockpitMarkers} reachableId={reachable?.id ?? null} />
          <TravelBar reachable={reachable} onEnter={enterPlace} />
        </>
      ) : null}

      {world === "saturn" ? (
        <div className="absolute inset-0 z-20 bg-[#03050b]">
          <div className="pointer-events-auto absolute top-16 right-6 z-40 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a1018]/90 p-1.5 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setSaturnSubView("saturn")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                saturnSubView === "saturn"
                  ? "bg-cyan-500/25 text-cyan-200 border border-cyan-500/30 font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              🪐 Memory Saturn
            </button>
            <button
              type="button"
              onClick={() => setSaturnSubView("orbit")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                saturnSubView === "orbit"
                  ? "bg-purple-500/25 text-purple-200 border border-purple-500/30 font-semibold"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              💫 Erinnerungsorbit
            </button>
          </div>
          <iframe
            src={saturnSubView === "saturn" ? "/memory_saturn.html" : "/erinnerungsorbit.html"}
            className="h-full w-full border-0 pb-16"
            title="Memory Space"
          />
        </div>
      ) : null}

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
          {meter.fps} fps · {meter.calls} Draws · {(meter.triangles / 1000).toFixed(0)}k Dreiecke ·{" "}
          {meter.geometries} Geo · {meter.textures} Tex · {meter.loops} Loops ·{" "}
          <span title="Zustand der Live-Verbindung zu Hermes">Live: {live.status}</span>
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
          // Die Leitung taucht nur auf, wenn sie ueberhaupt eingeschaltet ist.
          // Vorher meldete sie "wird geladen", waehrend sie schlicht aus war —
          // und "aus" und "laedt" sind genau die zwei Zustaende, die diese
          // Anzeige auseinanderhalten soll.
          ...(liveMode
            ? [
                {
                  label: "Live-Verbindung",
                  loading: live.status === "idle" || live.status === "connecting",
                  reachable: live.status === "connected",
                  count: live.methods.length,
                  error: live.detail,
                },
              ]
            : []),
          {
            label: "Projekte",
            loading: projects.loading,
            reachable: projects.reachable,
            count: projects.projects.length,
            error: projects.error,
          },
        ]}
      />

      {/* Globaler, ausblendbarer Jarvis Companion unten rechts (Hologramm-Gesicht & Arc Reactor Core) */}
      <JarvisCompanion
        currentWorld={world}
        onFlyToNote={(id) => {
          flyToSource(id);
          const node = vault.byId.get(id);
          if (node) select({ kind: "source", id: node.id, title: node.name, folder: node.folder });
        }}
        onNavigateWorld={(w) => goTo(w)}
      />
    </main>
  );
}
