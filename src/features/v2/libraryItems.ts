import type { LibraryItem } from "@/features/v2/world/LibraryWorld";
import type { VaultNode } from "@/features/v2/useVault";

/**
 * Vault notes onto the shelves.
 *
 * Antigravity delivered the room with sample data, correctly labelled as such.
 * This is the only piece that turns it into a place in Onur's system: real
 * notes, real folders, real link counts. If this file were missing the room
 * would still render — and would be furniture, which is exactly what V1's war
 * room was.
 *
 * Two decisions worth stating, because both could reasonably have gone the
 * other way:
 *
 * **Not all 273.** A shelf with 273 books is 273 meshes and, worse, a wall of
 * spines nobody reads. A shelf holds what you would actually reach for: the
 * selected note first, then the best connected of its neighbourhood. The
 * cosmos is where you see everything; the library is where you take one down.
 *
 * **Category from the folder, never from the text.** Onur's vault already
 * sorts itself — `01 Rohmaterial`, `03 Wissen`, `05 Projekte`. Guessing a
 * category by reading the note would produce a plausible label that is
 * sometimes wrong, and a wrong label on a shelf is worse than no shelf.
 */

/** How many books fit before the shelf stops being readable. */
export const SHELF_SIZE = 12;

/**
 * The vault's own top-level folders, mapped onto the module's categories.
 *
 * Anything unrecognised becomes a source rather than being forced into the
 * nearest match — an unfamiliar folder is a fact about the vault, not an
 * error to be smoothed over.
 */
const categoryFor = (folder: string): { category: LibraryItem["category"]; label: string } => {
  const head = folder.split("/")[0] ?? "";
  if (/rohmaterial|raw|inbox/i.test(head)) return { category: "raw", label: "Rohmaterial" };
  if (/wissen|wiki/i.test(head)) return { category: "wiki", label: "Geprüftes Wissen" };
  if (/identit|lebensprofil|interessen/i.test(head)) return { category: "identity", label: "Identität" };
  if (/projekt/i.test(head)) return { category: "project", label: "Projekt" };
  if (/system/i.test(head)) return { category: "wiki", label: "System" };
  return { category: "source", label: head || "Quelle" };
};

const toItem = (node: VaultNode): LibraryItem => {
  const { category, label } = categoryFor(node.folder);
  return {
    id: node.id,
    title: node.name,
    category,
    categoryLabel: label,
    // The note's own opening lines, or an honest silence. Never a summary
    // written here — that would be this file inventing content about a
    // document it has not read.
    description: node.excerpt || "",
    color: node.color,
  };
};

/**
 * What stands on the shelf right now.
 *
 * With something selected: that note, then its direct neighbours, best
 * connected first. With nothing selected: the best connected notes in the
 * vault, which is the closest thing to "what this system is mostly about"
 * that is measured rather than asserted.
 */
export function shelfFor(
  nodes: VaultNode[],
  links: { source: string; target: string }[],
  selectedId: string | null,
): LibraryItem[] {
  if (nodes.length === 0) return [];

  const byConnections = (a: VaultNode, b: VaultNode) => b.degree - a.degree;

  if (!selectedId) {
    return [...nodes].sort(byConnections).slice(0, SHELF_SIZE).map(toItem);
  }

  const selected = nodes.find((node) => node.id === selectedId);
  if (!selected) return [...nodes].sort(byConnections).slice(0, SHELF_SIZE).map(toItem);

  const neighbourIds = new Set<string>();
  for (const link of links) {
    if (link.source === selectedId) neighbourIds.add(link.target);
    else if (link.target === selectedId) neighbourIds.add(link.source);
  }

  const neighbours = nodes.filter((node) => neighbourIds.has(node.id)).sort(byConnections);

  // The selection always takes the first place on the shelf, even when it is
  // the least connected note in the vault — it is what he asked for.
  const shelf = [selected, ...neighbours].slice(0, SHELF_SIZE);

  // A note with no links would otherwise stand alone on an empty shelf. Fill
  // the remaining places from the vault at large, without repeating anything.
  if (shelf.length < SHELF_SIZE) {
    const taken = new Set(shelf.map((node) => node.id));
    for (const node of [...nodes].sort(byConnections)) {
      if (shelf.length >= SHELF_SIZE) break;
      if (taken.has(node.id)) continue;
      shelf.push(node);
      taken.add(node.id);
    }
  }

  return shelf.map(toItem);
}
