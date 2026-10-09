export const DRAFT_KEY = "hermes-perspectives-draft-v1";
export type PerspectivesDraft = { mission: string; context: string };

export function readDraft(storage: Pick<Storage, "getItem">): PerspectivesDraft | null {
  try {
    const value = JSON.parse(storage.getItem(DRAFT_KEY) || "null");
    if (!value || typeof value.mission !== "string" || typeof value.context !== "string") return null;
    return { mission: value.mission.slice(0, 3000), context: value.context.slice(0, 12000) };
  } catch { return null; }
}
