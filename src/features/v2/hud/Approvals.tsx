"use client";

/**
 * What is waiting, in words.
 *
 * The core already pulses amber when a decision is pending, and that was the
 * whole of it: he could see *that* something waited, never *what*. A light
 * that cannot be interrogated is a light you learn to ignore.
 *
 * Deciding still happens in the old room. That is deliberate and it is said
 * out loud at the bottom of the panel — answering an approval from here means
 * posting a choice into a live session, and the session plumbing is Hermes'
 * current work. Showing is safe; answering can wait for the owner of the
 * queue to be finished with it.
 */

export type PendingApproval = Record<string, unknown> & {
  sessionId?: string;
  sessionTitle?: string | null;
};

/**
 * The gateway has not settled on one shape for these, so the fields are
 * probed in order of specificity rather than assumed. Whatever is found is
 * shown as-is; nothing is paraphrased into something friendlier, because a
 * friendlier word here would be a guess about what is about to happen.
 */
const firstString = (approval: PendingApproval, keys: string[]): string | null => {
  for (const key of keys) {
    const value = approval[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

export const approvalTitle = (approval: PendingApproval): string =>
  firstString(approval, ["title", "summary", "tool", "tool_name", "toolName", "kind", "type"]) ??
  "Freigabe angefragt";

export const approvalDetail = (approval: PendingApproval): string | null =>
  firstString(approval, ["detail", "description", "message", "prompt", "command", "path"]);

export function Approvals({
  approvals,
  reachable,
  onClose,
}: {
  approvals: PendingApproval[];
  /** False means Hermes could not be asked — not "nothing is waiting". */
  reachable: boolean;
  onClose: () => void;
}) {
  return (
    <aside className="pointer-events-auto relative z-40 min-h-0 w-full shrink overflow-y-auto rounded-2xl border border-amber-400/25 bg-[#0a1018]/96 shadow-[0_18px_60px_rgba(0,0,0,.65)] backdrop-blur-md">
      <header className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200/80">
          Wartet auf dich
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 hover:bg-white/5 hover:text-white/80"
        >
          schließen
        </button>
      </header>

      {!reachable ? (
        <p className="px-4 py-5 text-[13px] leading-relaxed text-rose-200/80">
          Hermes konnte nicht gefragt werden. Ob etwas wartet, ist gerade
          unbekannt — nicht null.
        </p>
      ) : approvals.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-white/45">Nichts wartet auf eine Entscheidung.</p>
      ) : (
        <ul className="max-h-[46vh] divide-y divide-white/6 overflow-y-auto">
          {approvals.map((approval, index) => {
            const detail = approvalDetail(approval);
            return (
              <li key={`${approval.sessionId ?? "session"}-${index}`} className="px-4 py-3">
                <p className="text-[13px] font-medium leading-snug text-white/90">
                  {approvalTitle(approval)}
                </p>
                {detail ? (
                  <p className="mt-1 line-clamp-3 font-mono text-[11px] leading-relaxed text-white/45">
                    {detail}
                  </p>
                ) : null}
                <p className="mt-1.5 truncate font-mono text-[10px] text-white/25">
                  {approval.sessionTitle ?? approval.sessionId ?? "Sitzung unbekannt"}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="border-t border-white/8 px-4 py-2.5">
        <p className="font-mono text-[10px] leading-relaxed text-white/25">
          Entschieden wird weiterhin im bestehenden Raum. Hier steht nur, was
          ansteht — erfunden wird nichts.
        </p>
      </footer>
    </aside>
  );
}
