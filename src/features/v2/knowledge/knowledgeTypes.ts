/**
 * ============================================================================
 * ASTRA × Antigravity · W1 Wissensareale (Schnittstellenvereinbarung)
 * ============================================================================
 * 
 * Fachlicher Vertrag gemäß Umsetzungsplan 2026-09-04 / 2026-09-05:
 * - nodes: stabile id, title, groupId/path, degree, color, excerpt
 * - edges: sourceId, targetId, optional typ/direction
 * - selectedId: aktuell gewählte Notiz (oder null)
 * - query: Suchfilter
 * - reducedMotion: Barrierefreiheit / keine Animation
 * - onSelect: Callback bei Auswahl einer Notiz
 * - onFocusRequest: Kamera-Fokus auf Areal-Zentrum (Kamera bleibt bei Claude)
 */

export interface KnowledgeNode {
  id: string;
  title: string;
  groupId?: string; // z. B. "00 Inbox", "01 RAW", "02 System", "03 Identität", "04 Lebensprofil", "05 Projekte", "06 Interessen", "07 Wissen", "08 Quellen", "09 Ideenparkplatz"
  path?: string;
  color?: string;
  degree?: number;
  excerpt?: string;
  // Optionale benutzerdefinierte Metadaten
  metadata?: Record<string, unknown>;
}

export type EdgeDirection = "undirected" | "forward" | "backward" | "bidirectional";

export interface KnowledgeEdge {
  sourceId: string;
  targetId: string;
  type?: string; // z. B. "verweist_auf", "belegt_durch", "gehört_zu"
  direction?: EdgeDirection;
}

export interface FocusRequest {
  center: [number, number, number];
  radius: number;
  groupId?: string;
}

export interface KnowledgeAreasProps {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  selectedId?: string | null;
  query?: string;
  /** Kennungen der Volltexttreffer — damit der Raum dasselbe zeigt wie die Liste. */
  queryHitIds?: Set<string>;
  reducedMotion?: boolean;
  onSelect?: (id: string) => void;
  onFocusRequest?: (focus: FocusRequest) => void;
}

export interface AreaClusterInfo {
  groupId: string;
  label: string;
  center: [number, number, number];
  radius: number;
  nodeCount: number;
  color: string;
}
