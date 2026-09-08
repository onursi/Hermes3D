"use client";

import { useEffect, useState } from "react";

import {PanelWindow} from "./PanelWindow";
import {useDocument} from "../useDocument";
import {matchingExcerpt,termPattern} from "./foundText";
import { useV2 } from "@/features/v2/state";
import type { Project } from "@/features/v2/useProjects";
import type { RosterAgent } from "@/features/v2/useRoster";
import type { VaultNode } from "@/features/v2/useVault";
import { providerTone } from "@/features/v2/world/AgentDeck";

/**
 * One inspector, opened by a selection, closed by Escape.
 *
 * The plan asks for exactly one context panel rather than the several
 * simultaneous bars V1 kept open, and for sharp 2D text rather than words in
 * 3D. This is that panel: it is the only place in V2 where prose lives.
 *
 * What it will not do is fill a gap with something plausible. A model Hermes
 * did not report reads "unbekannt", because a wrong model name is
 * indistinguishable from a right one until it matters.
 */

export function Inspector({
  agents,
  nodes,
  projects,
  onOpenSource,
  onDiveToSource,
  councilAvailable = false,
  query = "",
}: {
  agents: RosterAgent[];
  nodes: VaultNode[];
  projects: Project[];
  /** Opens the note through the existing safe file route. */
  onOpenSource: (id: string) => void;
  /** Travels to the cosmos with this note selected. */
  onDiveToSource: (id: string) => void;
  /**
   * Ob der Upstream  tatsächlich anbietet.
   *
   * Vorher stand hier ein fest geschriebener Satz. Ein fest geschriebener
   * Satz über den Zustand eines anderen Systems ist genau so lange wahr, wie
   * niemand das andere System ändert — und dann sagt die Oberfläche etwas
   * Falsches, ohne dass es jemandem auffällt. Jetzt kommt die Antwort aus der
   * Methodenliste, die der Server beim Verbinden selbst nennt.
   */
  councilAvailable?: boolean;
  query?: string;
}) {
  const { selection, focus, setFocus, clearSelection, world } = useV2();

  // Escape is handled in exactly one place, in V2Screen. This panel used to
  // listen as well, and the two handlers disagreed: the capture-phase one
  // cleared the selection, and the bubble-phase one then read the *previous*
  // value from its own closure and did nothing. Escape closed the inspector
  // and then refused to go home — one key, two owners, a stale answer.

  if (selection.kind === "none") return null;

  return (
    <PanelWindow key={JSON.stringify(selection)} title="Auswahl" slot="right" onClose={clearSelection}><aside className="pointer-events-auto relative z-30 min-h-0 w-full shrink overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1018]/95 shadow-[0_18px_60px_rgba(0,0,0,.6)] backdrop-blur-md">
      {selection.kind === "agent" ? (
        <AgentBody agent={agents.find((a) => a.id === selection.id)} councilAvailable={councilAvailable} />
      ) : null}

      {selection.kind === "source" ? (
        <SourceBody
          node={nodes.find((n) => n.id === selection.id)}
          id={selection.id}
          title={selection.title}
          world={world}
          query={query}
          onOpen={() => onOpenSource(selection.id)}
          onDive={() => onDiveToSource(selection.id)}
        />
      ) : null}

      {selection.kind === "project" ? (
        <ProjectBody
          project={projects.find((p) => p.folder === selection.folder)}
          name={selection.name}
          onOpenNote={onOpenSource}
        />
      ) : null}

      <footer className="flex items-center justify-between border-t border-white/8 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setFocus(!focus)}
          className={`rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
            focus
              ? "bg-cyan-400/20 text-cyan-100"
              : "text-white/45 hover:bg-white/5 hover:text-white/75"
          }`}
        >
          {focus ? "Fokus an" : "Fokus"}
        </button>
        <button
          type="button"
          onClick={clearSelection}
          className="rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45 transition-colors hover:bg-white/5 hover:text-white/75"
        >
          Esc · schließen
        </button>
      </footer>
    </aside></PanelWindow>
  );
}

function AgentBody({ agent, councilAvailable }: { agent?: RosterAgent; councilAvailable: boolean }) {
  if (!agent) {
    return <Empty text="Dieser Agent ist nicht mehr im Roster." />;
  }
  const tone = providerTone(agent.provider);
  return (
    <div className="px-4 pb-3 pt-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
        />
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-white">{agent.name}</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            {agent.isDefault ? "Standardprofil" : "Spezialprofil"}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2">
        <Row label="Modell" value={agent.model} />
        <Row label="Anbieter" value={agent.provider} />
        <Row label="Skills" value={agent.skillCount === null ? null : String(agent.skillCount)} />
      </dl>

      {agent.role ? (
        <p className="mt-3 border-t border-white/8 pt-3 text-[13px] leading-relaxed text-white/60">
          {agent.role}
        </p>
      ) : null}

      {/* Honest about what is not built yet. The plan says the room stays
          truthful about single agents while Hermes builds the council. */}
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-white/25">
        Gespräch mit einzelnen Agenten läuft über das bestehende HQ.{" "}
        {councilAvailable
          ? "Council ist verbunden, hat hier aber noch keine Oberfläche."
          : "Council nicht verbunden — der Upstream bietet council.start nicht an."}
      </p>
    </div>
  );
}

function SourceBody({
  node,
  id,
  title,
  world,
  query,
  onOpen,
  onDive,
}: {
  node?: VaultNode;
  id: string;
  title: string;
  world: string;
  query: string;
  onOpen: () => void;
  onDive: () => void;
}) {
  const doc=useDocument(query.trim()?id:null);
  const excerpt=doc.status==='ready'?matchingExcerpt(doc.content,query):'';
  const pattern=termPattern(query);
  return (
    <div className="px-4 pb-3 pt-4">
      {excerpt&&<div className="source-found"><small>FUNDSTELLE · {query}</small><p>{pattern?excerpt.split(pattern).map((part,i)=>i%2?<mark key={i}>{part}</mark>:part):excerpt}</p><button onClick={onOpen}>Direkt zur Fundstelle →</button></div>}
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/55">
        Quelle
      </p>
      <h2 className="mt-1 text-[15px] font-semibold leading-snug text-white">
        {node?.name ?? title}
      </h2>
      <p className="mt-1 truncate font-mono text-[10px] text-white/30">{id}</p>

      {node ? (
        <dl className="mt-4 space-y-2">
          <Row label="Ordner" value={node.folder || null} />
          <Row label="Verbindungen" value={String(node.degree)} />
        </dl>
      ) : null}

      {node?.excerpt ? (
        <p className="mt-3 line-clamp-6 border-t border-white/8 pt-3 text-[13px] leading-relaxed text-white/55">
          {node.excerpt}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        {/* This used to hand the note to Obsidian and show "Wird geöffnet…"
            while another application took over. It opens the reader now, in
            this room — Obsidian is still one click away, inside the reader,
            as a choice rather than as the only way. */}
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-[12px] font-medium text-cyan-100 transition-colors hover:bg-cyan-400/20"
        >
          Notiz lesen
        </button>
        {world === "home" && node ? (
          <button
            type="button"
            onClick={onDive}
            className="rounded-lg border border-white/12 px-3 py-2 text-[12px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Eintauchen
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A project, with only what the disk can prove.
 *
 * No progress bar, and the reason is written into the panel itself rather than
 * left implicit: the project notes use no checkboxes, so a percentage would be
 * a number with nothing behind it. Notes, tasks where they genuinely exist,
 * recency and the documents last touched are all provable — that is the list.
 */
function ProjectBody({
  project,
  name,
  onOpenNote,
}: {
  project?: Project;
  name: string;
  onOpenNote: (path: string) => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, [project?.lastTouched]);

  if (!project) return <Empty text={`„${name}" liegt nicht mehr im Vault.`} />;

  const touched = project.lastTouched ? new Date(project.lastTouched) : null;
  // The clock is read after mount, not during render. Reading it while
  // rendering makes the same panel produce two different answers across two
  // renders it did not ask for — the rule is right, and "vor 3 Tagen" is
  // exactly the kind of value that would flicker.
  const ageDays =
    touched && now !== null ? Math.floor((now - touched.getTime()) / 86_400_000) : null;

  return (
    <div className="px-4 pb-3 pt-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/55">Projekt</p>
      <h2 className="mt-1 text-[15px] font-semibold leading-snug text-white">{project.name}</h2>
      <p className="mt-1 truncate font-mono text-[10px] text-white/30">{project.folder}</p>

      <dl className="mt-4 space-y-2">
        <Row label="Notizen" value={String(project.noteCount)} />
        <Row
          label="Zuletzt bearbeitet"
          value={
            touched
              ? ageDays === 0
                ? "heute"
                : ageDays === 1
                  ? "gestern"
                  : `vor ${ageDays} Tagen`
              : null
          }
        />
        {/* Tasks appear only where they exist. A row reading "0 offen" in a
            project that never used checkboxes would state something false
            about the project rather than about the data. */}
        {project.openTasks + project.doneTasks > 0 ? (
          <Row
            label="Aufgaben"
            value={`${project.openTasks} offen · ${project.doneTasks} erledigt`}
          />
        ) : null}
      </dl>

      {project.openTasks + project.doneTasks === 0 ? (
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-white/25">
          Diese Notizen benutzen keine Checkboxen. Das heißt: kein messbarer
          Fortschritt — und auch nicht, dass nichts offen wäre.
        </p>
      ) : null}

      {project.recentNotes.length > 0 ? (
        <div className="mt-3 border-t border-white/8 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">
            Zuletzt geändert
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {project.recentNotes.map((note) => (
              <li key={note.path}>
                <button
                  type="button"
                  onClick={() => onOpenNote(note.path)}
                  className="w-full truncate rounded-md px-1 py-1 text-left text-[12.5px] text-white/65 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {note.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">{label}</dt>
      <dd
        className={`truncate text-right text-[13px] ${value ? "text-white/85" : "text-white/30 italic"}`}
      >
        {value ?? "unbekannt"}
      </dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-5 text-[13px] text-white/45">{text}</p>;
}
