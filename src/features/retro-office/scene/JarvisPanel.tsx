"use client";

import { CornerDownLeft, Loader2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

/**
 * Asking the vault a question, and being able to check the answer.
 *
 * The retrieval and the answering already work as endpoints; without this
 * they are invisible. This is the part where you type a question and get a
 * reply built only from your own notes.
 *
 * The sources are the point, not a footnote. A model writing fluent German
 * about your life is easy and worthless; a model that names which of your 256
 * notes it read is checkable. So every source is listed, numbered to match the
 * citations in the answer, and clicking one flies the brain to that note — the
 * shortest possible path from "it says so" to "show me".
 */

export type JarvisSource = {
  id: string;
  title: string;
  folder: string;
  excerpt: string;
};

type Props = {
  /** Fly the graph to a note by its vault id, and select it. */
  onFlyToSource: (sourceId: string) => void;
  onClose: () => void;
};

export function JarvisPanel({ onFlyToSource, onClose }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<JarvisSource[]>([]);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useCallback(async () => {
    const text = question.trim();
    if (!text || loading) return;
    setLoading(true);
    setAnswer(null);
    setReason(null);
    setSources([]);
    try {
      const res = await fetch(`/api/jarvis/ask?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      setSources(Array.isArray(data.sources) ? data.sources : []);
      if (data.ok && data.answer) setAnswer(data.answer);
      else setReason(data.reason ?? "Keine Antwort erhalten.");
    } catch (error) {
      setReason(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [question, loading]);

  return (
    <div className="absolute right-6 top-20 z-40 flex max-h-[calc(100vh-160px)] w-96 flex-col rounded-2xl border border-white/[0.09] bg-[#141619]/85 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <span className="text-[11px] font-semibold tracking-[-0.005em] text-white/70">
          Jarvis · fragt deinen Vault
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white/80"
          title="Schließen"
        >
          <X size={14} />
        </button>
      </div>

      <div className="border-b border-white/[0.07] p-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-black/30 px-3 py-2">
          <input
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              // Stopped here so the room's global shortcuts do not read what
              // is being typed — Space in particular belongs to this field.
              event.stopPropagation();
              if (event.key === "Enter") void ask();
            }}
            placeholder="Was denke ich über…?"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/30"
          />
          <button
            type="button"
            onClick={() => void ask()}
            disabled={loading || !question.trim()}
            className="shrink-0 text-white/50 hover:text-white disabled:opacity-30"
            title="Fragen"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CornerDownLeft size={14} />}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-[12px] text-white/45">
            Liest deine Notizen… das dauert bis zu einer Minute.
          </p>
        ) : null}

        {answer ? (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/85">{answer}</p>
        ) : null}

        {reason && !answer ? (
          <p className="text-[12px] leading-relaxed text-amber-200/80">{reason}</p>
        ) : null}

        {sources.length > 0 ? (
          <div className="mt-4 border-t border-white/[0.07] pt-3">
            <p className="pb-2 text-[10px] font-semibold tracking-[-0.005em] text-white/40">
              Quellen — anklicken, um hinzufliegen
            </p>
            <ol className="space-y-1">
              {sources.map((source, index) => (
                <li key={source.id}>
                  <button
                    type="button"
                    onClick={() => onFlyToSource(source.id)}
                    className="flex w-full gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.06]"
                    title={source.folder}
                  >
                    <span className="shrink-0 font-mono text-[11px] text-white/35">
                      [{index + 1}]
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-white/75">
                      {source.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {!loading && !answer && !reason && sources.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-white/35">
            Die Antwort kommt ausschließlich aus deinen eigenen Notizen, mit Quellenangabe.
            Findet die Suche nichts, sagt Jarvis das — statt zu raten.
          </p>
        ) : null}
      </div>
    </div>
  );
}
