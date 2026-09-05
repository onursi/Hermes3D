"use client";

import { useEffect, useState } from "react";

/**
 * One note's content, fetched when it is actually going to be read.
 *
 * Metadata and relationships come from the graph, which is read once. The
 * text does not: 279 notes of full content is a payload nobody asked for, and
 * V6-05 asks for exactly this split — load the map eagerly, load the document
 * on demand.
 *
 * The states are separate on purpose. "Loading", "missing", "empty",
 * "unsupported" and "failed" look identical if you only model content-or-not,
 * and telling them apart is most of what makes a reader trustworthy.
 */

export type DocumentState =
  | { status: "idle" }
  | { status: "loading"; id: string }
  /** The file was read. `content` may still be an empty string — that is "empty", not "missing". */
  | { status: "ready"; id: string; content: string; truncated: boolean; mtimeMs: number }
  /** The note exists but is a kind we do not render yet. Named, not hidden. */
  | { status: "unsupported"; id: string; extension: string; bytes: number }
  /** The graph knows this id; the disk does not. Usually a rename. */
  | { status: "missing"; id: string }
  | { status: "failed"; id: string; reason: string };

export function useDocument(id: string | null): DocumentState {
  const [state, setState] = useState<DocumentState>({ status: "idle" });

  useEffect(() => {
    if (!id) return;

    // Aborted on every change of id, so switching quickly between notes cannot
    // land an old answer on a new selection. Without this, clicking three
    // neighbours in a second shows whichever request happened to finish last.
    // No "loading" written here: the render already derives it from the id
    // not matching the stored state. Setting it as well would be a second
    // path to the same screen, and the two would drift.
    const controller = new AbortController();

    fetch(`/api/vault/note?id=${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (controller.signal.aborted) return;

        if (!response.ok || !data?.ok) {
          const reason = data?.reason ?? `http-${response.status}`;
          setState(
            reason === "not-found" || reason === "not-a-file"
              ? { status: "missing", id }
              : { status: "failed", id, reason },
          );
          return;
        }

        if (data.format === "unsupported") {
          setState({
            status: "unsupported",
            id,
            extension: String(data.extension ?? ""),
            bytes: Number(data.bytes ?? 0),
          });
          return;
        }

        setState({
          status: "ready",
          id,
          content: String(data.content ?? ""),
          truncated: Boolean(data.truncated),
          mtimeMs: Number(data.mtimeMs ?? 0),
        });
      })
      .catch((error: unknown) => {
        // An abort is the expected outcome of changing your mind, not a fault.
        if (controller.signal.aborted) return;
        setState({ status: "failed", id, reason: error instanceof Error ? error.message : "unknown" });
      });

    return () => controller.abort();
  }, [id]);

  /**
   * Derived, not stored.
   *
   * The state held here always belongs to some id; whether it belongs to *this*
   * id is a question about the current render, so it is answered during the
   * render. Writing "idle" or "loading" into state from the effect would work
   * too, and would mean one render showing the previous note's text under the
   * new note's title — the effect runs after the paint.
   */
  if (!id) return { status: "idle" };
  if (state.status === "idle" || state.id !== id) return { status: "loading", id };
  return state;
}
