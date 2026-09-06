"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Html } from "@react-three/drei";
import type { ProjectSectorItem, TimelineMilestone } from "@/features/v2/world/projectData";

export function ProjectWorkspaceModal({
  item,
  milestone,
  onClose,
}: {
  item: ProjectSectorItem | null;
  milestone?: TimelineMilestone | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [liveNoteContent, setLiveNoteContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activePath = item?.vaultPath;

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch real note content if available
  useEffect(() => {
    if (!activePath || !activePath.endsWith(".md")) {
      setLiveNoteContent(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/vault/note?id=${encodeURIComponent(activePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok && data.content) {
          setLiveNoteContent(data.content);
        } else {
          setLiveNoteContent(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLiveNoteContent(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePath]);

  if (!item && !milestone) return null;

  const title = item ? item.title : milestone!.title;
  const subtitle = item ? item.subtitle : milestone!.category;
  const date = item ? item.date : milestone!.date;
  const sector = item?.sector;
  const content = liveNoteContent || (item ? item.details : milestone!.summary);

  const sectorColors = {
    quellen: { text: "text-cyan-300", border: "border-cyan-400/40", bg: "bg-cyan-950/40", badge: "📂 QUELLEN · INPUT" },
    werkstatt: { text: "text-amber-300", border: "border-amber-400/40", bg: "bg-amber-950/40", badge: "🛠️ WERKSTATT · ENTWURF" },
    ergebnisse: { text: "text-emerald-300", border: "border-emerald-400/40", bg: "bg-emerald-950/40", badge: "🏆 ERGEBNIS · RELEASE" },
  };

  const currentTheme = sector ? sectorColors[sector] : {
    text: "text-purple-300",
    border: "border-purple-400/40",
    bg: "bg-purple-950/40",
    badge: "⏳ ERINNERUNGSORBIT · MEILENSTEIN",
  };

  const copyPath = () => {
    if (activePath) {
      void navigator.clipboard.writeText(activePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openInObsidian = () => {
    if (activePath) {
      window.location.href = `obsidian://open?vault=Life%20OS&file=${encodeURIComponent(activePath)}`;
    }
  };

  return (
    <Html fullscreen style={{ pointerEvents: "auto" }}>
      <div
        className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-all duration-200"
        onClick={onClose}
      >
      <div
        className="relative flex max-h-[88vh] w-[min(94vw,860px)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#070e17]/95 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${currentTheme.border} ${currentTheme.bg} ${currentTheme.text}`}>
                {currentTheme.badge}
              </span>
              {item && (
                <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/60">
                  {item.badge}
                </span>
              )}
              <span className="font-mono text-[11px] text-white/40">· {date}</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">{title}</h2>
            <p className="text-xs text-white/60">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/5 p-2 text-white/60 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            title="Schließen (Esc)"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#091320]/80 px-6 py-2.5">
          <div className="flex items-center gap-2 text-xs text-white/60 font-mono truncate max-w-[55%]">
            <span className="text-white/30">Pfad:</span>
            <span className="truncate text-white/80">{activePath || "Im Speicher (Projekt-Werft)"}</span>
          </div>

          <div className="flex items-center gap-2">
            {activePath && (
              <>
                <button
                  type="button"
                  onClick={copyPath}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {copied ? "✓ Kopiert!" : "📋 Pfad"}
                </button>
                <button
                  type="button"
                  onClick={openInObsidian}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-950/60 px-3 py-1 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-300 hover:bg-cyan-900/80"
                >
                  <span>In Obsidian</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="font-mono text-sm text-cyan-300/60 animate-pulse">Lade Notiz aus Vault…</span>
            </div>
          ) : (
            <article className="prose prose-invert prose-sm max-w-none text-white/80 prose-headings:text-white prose-p:leading-relaxed prose-a:text-cyan-300 prose-code:text-cyan-200 prose-pre:bg-[#04080e] prose-pre:border prose-pre:border-white/10">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </article>
          )}

          {/* Tags */}
          {item && item.tags && item.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-1.5 border-t border-white/10 pt-4">
              <span className="font-mono text-[10px] text-white/35 mr-1">Tags:</span>
              {item.tags.map((tag) => (
                <span key={tag} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/50">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 bg-[#060c14] px-6 py-3 text-[11px] text-white/40 font-mono">
          <span>Hermes 3D · 2D-Arbeitsfläche im 3D-Raum</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1 text-white/60 hover:border-white/20 hover:text-white"
          >
            Schließen [Esc]
          </button>
        </div>
      </div>
    </div>
    </Html>
  );
}
