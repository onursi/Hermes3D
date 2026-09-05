import type { VaultNode } from "@/features/v2/useVault";

/**
 * What counts as a hit. One definition, because there are two searchers.
 *
 * The HUD's result list and the knowledge world's dimming have to agree: a
 * note that appears in the list and stays dark in the room, or the reverse,
 * makes the search look broken even though both halves "work". It lived in
 * `CosmosWorld` until W1 replaced that world; a shared rule does not belong
 * to whichever component happened to need it first.
 *
 * Name and folder, nothing else. Not the excerpt — searching text he cannot
 * see returns notes he cannot explain.
 *
 * @param needle Already lower-cased and trimmed by the caller.
 */
export const matchesQuery = (node: VaultNode, needle: string): boolean =>
  node.name.toLowerCase().includes(needle) || node.folder.toLowerCase().includes(needle);
