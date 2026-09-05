"use client";

/**
 * Four states that must never look alike.
 *
 *   lädt        we have not been told yet
 *   offline     we asked and could not reach it
 *   leer        we asked, it answered, there is nothing
 *   bereit      we asked, it answered, there is something
 *
 * A dark room is the design here. A dark room that is still loading, a dark
 * room whose backend is down, and a genuinely empty vault are three different
 * facts that produced exactly the same picture — which is the most common way
 * a system quietly lies to the person using it.
 *
 * This says which one it is, in one line, and disappears the moment everything
 * is both reachable and non-empty. Nothing permanent, nothing decorative.
 */

export type SourceState = {
  label: string;
  loading: boolean;
  reachable: boolean;
  count: number;
  error?: string | null;
};

export function SystemState({ sources }: { sources: SourceState[] }) {
  const loading = sources.filter((source) => source.loading);
  const offline = sources.filter((source) => !source.loading && !source.reachable);
  const empty = sources.filter(
    (source) => !source.loading && source.reachable && source.count === 0,
  );

  if (loading.length === 0 && offline.length === 0 && empty.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-32 z-20 flex flex-col items-center gap-1.5 px-4">
      {loading.length > 0 ? (
        <Line tone="neutral">
          {loading.map((source) => source.label).join(" · ")} wird geladen…
        </Line>
      ) : null}

      {offline.map((source) => (
        <Line key={source.label} tone="rose">
          {source.label} nicht erreichbar
          {source.error ? <span className="ml-2 text-white/35">{source.error}</span> : null}
        </Line>
      ))}

      {/* Reported apart from offline on purpose: an empty vault is a working
          system with nothing in it, and the answer to it is to write something
          rather than to restart anything. */}
      {empty.map((source) => (
        <Line key={source.label} tone="neutral">
          {source.label} erreichbar, aber leer
        </Line>
      ))}
    </div>
  );
}

function Line({ children, tone }: { children: React.ReactNode; tone: "neutral" | "rose" }) {
  const styles =
    tone === "rose"
      ? "border-rose-400/25 bg-rose-400/8 text-rose-200/85"
      : "border-white/8 bg-[#0a1018]/80 text-white/40";
  return (
    <p
      className={`max-w-full truncate rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] backdrop-blur-md ${styles}`}
    >
      {children}
    </p>
  );
}
