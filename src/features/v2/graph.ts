import type { VaultLink, VaultNode } from "@/features/v2/useVault";

/**
 * Questions about the graph, asked in one place.
 *
 * The reader needed "who is next to this note", and so does the neighbourhood
 * view — with the difference that the second one also needs to know which of
 * those neighbours are connected *to each other*. Two components answering the
 * same question separately is how they end up disagreeing about what a
 * neighbour is.
 *
 * Everything here reads the links the vault records. Nothing is inferred: if
 * two notes are not linked, they are not neighbours, however similar they look.
 */

/**
 * The notes directly linked to this one, strongest first.
 *
 * "Strongest" is degree — how many links a note has overall — and it is a
 * ranking of *prominence in the graph*, not of importance. The view says so;
 * this function only sorts.
 */
export function neighboursOf(
  id: string,
  links: VaultLink[],
  byId: Map<string, VaultNode>,
): VaultNode[] {
  const ids = new Set<string>();
  for (const link of links) {
    if (link.source === id) ids.add(link.target);
    else if (link.target === id) ids.add(link.source);
  }
  return [...ids]
    .map((neighbourId) => byId.get(neighbourId))
    .filter((node): node is VaultNode => Boolean(node))
    .sort((a, b) => b.degree - a.degree);
}

/**
 * Links between the notes in a set — the part a 3D view cannot show.
 *
 * This is the whole reason the neighbourhood is worth drawing flat. In space,
 * two points either overlap or hide behind each other, and a line between them
 * is indistinguishable from a line passing by. On a plane, "these three
 * neighbours also reference each other" is simply visible.
 */
export function linksAmong(ids: Set<string>, links: VaultLink[]): [string, string][] {
  const seen = new Set<string>();
  const found: [string, string][] = [];
  for (const link of links) {
    if (!ids.has(link.source) || !ids.has(link.target)) continue;
    // The graph records a link once per direction in some vaults; the pair is
    // what matters, so it is keyed by its sorted ends.
    const key = link.source < link.target ? `${link.source}|${link.target}` : `${link.target}|${link.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push([link.source, link.target]);
  }
  return found;
}
