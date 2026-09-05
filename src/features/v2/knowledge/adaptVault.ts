import type { KnowledgeEdge, KnowledgeNode } from "@/features/v2/knowledge/knowledgeTypes";
import type { VaultLink, VaultNode } from "@/features/v2/useVault";

/**
 * The vault, in the shape W1 asked for.
 *
 * Antigravity shipped an adapter with the module. This is that adapter, moved
 * to the side that owns the data and corrected in two places the delivery
 * could not have known about. Both corrections are about not asserting
 * something the vault does not say.
 *
 * It is a pure function over data that is already in memory. No fetch, no
 * second read of the graph — the vault is read once in `useVault` and this
 * reshapes what is already there.
 */

/**
 * Folders the knowledge module has no area for.
 *
 * `core` holds four notes and is not one of the ten LifeOS areas. The module
 * puts an unknown group at its fallback coordinate — which is the same
 * coordinate "Ungeordnet" uses, so two areas would sit inside each other
 * under different names. Naming it as unsorted is the honest version of what
 * is happening anyway: we do not know where it belongs.
 */
const UNSORTED = "Ungeordnet";
const KNOWN_AREAS = new Set([
  "00📥Inbox",
  "01📦RAW",
  "02⚙️ System",
  "03🪪 Identität",
  "04📖 Lebensprofil",
  "05 🚀 Projekte",
  "06💡Interessen",
  "07🧠Wissen",
  "08📚Quellen",
  "09🅿️Ideenparkplatz",
]);

export function adaptVaultToKnowledge(
  nodes: VaultNode[],
  links: VaultLink[],
): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
  const knowledgeNodes: KnowledgeNode[] = nodes.map((node) => ({
    id: node.id,
    title: node.name,
    groupId: KNOWN_AREAS.has(node.folder) ? node.folder : UNSORTED,
    path: node.id,
    color: node.color,
    degree: node.degree,
    excerpt: node.excerpt,
  }));

  const edges: KnowledgeEdge[] = links.map((link) => ({
    sourceId: link.source,
    targetId: link.target,
    // No `type`. The delivered adapter defaulted it to "verweist_auf", which
    // reads as a claim about what the link means — and the graph does not
    // tell us. V6-05 is explicit: an edge explains what it proves, and a
    // link must not quietly become a stated relationship. An absent type is
    // the truth here.
    direction: "undirected",
  }));

  return { nodes: knowledgeNodes, edges };
}
