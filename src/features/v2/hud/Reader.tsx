"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {PanelWindow} from "./PanelWindow";
import {highlightFoundText} from "./foundText";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { SELECTION_COLOR } from "@/features/v2/palette";
import { useDocument } from "@/features/v2/useDocument";
import type { VaultNode } from "@/features/v2/useVault";

/**
 * The note, in front of him. In the room, not in Obsidian.
 *
 * "Onur möchte ein Dokument direkt vor die Nase bekommen, statt an Obsidian
 * weitergeleitet zu werden." Until now V2 could show forty characters of an
 * excerpt and then hand the whole thing to another application. This is the
 * other half.
 *
 * A DOM panel, not text in the scene. Text drawn into the canvas resamples
 * with the renderer's resolution and cannot be selected or copied; a document
 * has to stay sharp at any distance and behave like text. That is the split
 * the plan sets — the room shows where things are, the DOM shows what they
 * say — and a long note is the case that proves it.
 *
 * Raw HTML in a note is *not* rendered: react-markdown passes it through as
 * text unless a plugin is added, and none is. A vault note is trusted content
 * today, but a reader that executes what it reads is a decision, and this one
 * is made deliberately and in the safe direction.
 */

export function Reader({
  node,
  onClose,
  onOpenExternally,
  onOpenNeighbour,
  neighbours,
  query = "",
  onMinimizedChange,
}: {
  /** The note to read, or null when the reader is closed. */
  node: VaultNode | null;
  query?: string;
  onMinimizedChange?:(minimized:boolean)=>void;
  onClose: () => void;
  /** Obsidian, still available — as a choice rather than as the only way. */
  onOpenExternally: (id: string) => void;
  onOpenNeighbour: (id: string) => void;
  /** The note's actual neighbours, from the graph. Never invented. */
  neighbours: VaultNode[];
}) {
  const document = useDocument(node?.id ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [matchIndex,setMatchIndex]=useState(0);
  const [matchCount,setMatchCount]=useState(0);
  const highlight=useMemo(()=>highlightFoundText(query),[query]);
  const jump=(index:number)=>{const marks=scrollRef.current?.querySelectorAll<HTMLElement>('mark[data-found]');if(!marks?.length)return;const next=(index+marks.length)%marks.length;marks.forEach((m,i)=>m.dataset.current=String(i===next));marks[next].scrollIntoView({block:'center',behavior:'auto'});setMatchIndex(next);};
  useEffect(()=>{const frame=requestAnimationFrame(()=>{const marks=scrollRef.current?.querySelectorAll<HTMLElement>('mark[data-found]');setMatchCount(marks?.length??0);setMatchIndex(0);if(marks?.[0]){marks[0].dataset.current='true';marks[0].scrollIntoView({block:'center',behavior:'auto'});}});return()=>cancelAnimationFrame(frame);},[document,query,node?.id]);

  /**
   * A new note starts at the top.
   *
   * Without this, opening a neighbour keeps the scroll offset of the note
   * before it and drops him into the middle of a document he has not started.
   */
  useEffect(() => {
    onMinimizedChange?.(false);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [node?.id,onMinimizedChange]);

  /**
   * Front matter, separated rather than thrown away.
   *
   * Almost every note in this vault opens with a YAML block, and Markdown has
   * no idea what it is: `status: entwurf` renders as a paragraph and the
   * source list renders as bullets, so every note began with a page of
   * metadata pretending to be prose. Splitting it off puts the text first and
   * keeps the block available — deleting it would be hiding content, which is
   * the other way to get this wrong.
   */
  const split = useMemo(() => {
    if (document.status !== "ready") return null;
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(document.content);
    if (!match) return { front: null, body: document.content };
    return { front: match[1], body: document.content.slice(match[0].length) };
  }, [document]);

  const changed = useMemo(() => {
    if (document.status !== "ready" || !document.mtimeMs) return null;
    return new Date(document.mtimeMs).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [document]);

  if (!node) return null;

  return (
    <PanelWindow key={node.id} title="Notiz" slot="reader" onClose={onClose} onMinimizedChange={onMinimizedChange}><section
      className="pointer-events-auto absolute inset-y-0 right-0 z-40 flex w-[min(720px,calc(100vw-2rem))] flex-col border-l border-white/10 bg-[#070c12]/97 backdrop-blur-md"
      aria-label={`Notiz: ${node.name}`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
            {node.folder || "Ungeordnet"}
          </p>
          <h2 className="mt-1 truncate text-lg font-medium text-white/90">{node.name}</h2>
          <p className="mt-1 font-mono text-[10px] text-white/30">
            {changed ? `Zuletzt geändert ${changed}` : " "}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-white/12 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60 transition-colors hover:bg-white/8 hover:text-white"
        >
          Esc · schließen
        </button>
      </header>

      {query.trim()&&<nav className="found-navigation" aria-label="Fundstellen"><span>„{query}“ · {matchCount?`${matchIndex+1} / ${matchCount}`:'Keine Textfundstelle'}</span><button disabled={!matchCount} onClick={()=>jump(matchIndex-1)} aria-label="Vorherige Fundstelle">↑</button><button disabled={!matchCount} onClick={()=>jump(matchIndex+1)} aria-label="Nächste Fundstelle">↓</button></nav>}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {document.status === "loading" ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/35">
            Wird gelesen …
          </p>
        ) : null}

        {document.status === "missing" ? (
          <Note title="Diese Datei gibt es nicht mehr.">
            Der Wissensgraph kennt sie noch, die Festplatte nicht. Meist heißt das: umbenannt oder
            verschoben. Der Graph wird beim nächsten Laden neu gelesen.
          </Note>
        ) : null}

        {document.status === "unsupported" ? (
          <Note title={`${document.extension || "Dieses Format"} kann ich hier noch nicht zeigen.`}>
            Die Datei ist da ({Math.round(document.bytes / 1024)} kB) und unversehrt — der Leser kann
            bisher nur Text und Markdown. Das ist eine bekannte Lücke, kein Fehler.
          </Note>
        ) : null}

        {document.status === "failed" ? (
          <Note title="Lesen fehlgeschlagen.">
            Grund: <span className="font-mono">{document.reason}</span>. Die Notiz ist davon nicht
            betroffen — es wird nur gelesen, nie geschrieben.
          </Note>
        ) : null}

        {document.status === "ready" && document.content.trim() === "" ? (
          <Note title="Diese Notiz ist leer.">
            Sie existiert und enthält keinen Text. Das ist etwas anderes als „nicht gefunden“.
          </Note>
        ) : null}

        {document.status === "ready" && document.content.trim() !== "" && split ? (
          <article className="prose-hermes">
            {split.front ? (
              <details className="mb-5 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Kopfdaten
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-white/45">
                  {split.front}
                </pre>
              </details>
            ) : null}
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[highlight]}>{split.body}</ReactMarkdown>
            {document.truncated ? (
              <p className="mt-6 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300/70">
                Gekürzt — die Notiz ist länger als der Leser auf einmal holt.
              </p>
            ) : null}
          </article>
        ) : null}
      </div>

      {neighbours.length > 0 ? (
        <footer className="border-t border-white/10 px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
            Belegte Nachbarn — {neighbours.length}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {neighbours.slice(0, 10).map((neighbour) => (
              <button
                key={neighbour.id}
                type="button"
                onClick={() => onOpenNeighbour(neighbour.id)}
                className="max-w-[280px] truncate rounded-lg border border-white/10 px-2.5 py-1 text-left text-[11px] text-white/65 transition-colors hover:border-white/25 hover:text-white"
                style={{ borderColor: `${SELECTION_COLOR}22` }}
              >
                {neighbour.name}
              </button>
            ))}
          </div>
        </footer>
      ) : null}

      <div className="border-t border-white/10 px-6 py-3">
        <button
          type="button"
          onClick={() => onOpenExternally(node.id)}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35 transition-colors hover:text-white/70"
        >
          In Obsidian öffnen
        </button>
      </div>
    </section></PanelWindow>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm text-white/80">{title}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-white/45">{children}</p>
    </div>
  );
}
