"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";

/**
 * The vault, read once, shared by both worlds.
 *
 * Section B is explicit: use the existing knowledge graph as the second world,
 * do not build a second search engine and do not copy the vault. So this is a
 * single read of `/api/obsidian-graph` — the same endpoint the V1 sky already
 * used — held one level above the worlds so that travelling does not refetch
 * 263 notes and 1,100 links every time.
 *
 * The positions are computed once, here, and both worlds read them. That is
 * what makes a star in the home sky and the same star in the cosmos provably
 * the same note rather than two similar dots.
 */

export type VaultNode = {
  id: string;
  name: string;
  folder: string;
  /** Links touching this note. Drives brightness and size in both worlds. */
  degree: number;
  /** The folder's own colour, as the graph already assigns it. Not invented here. */
  color: string;
  /** First lines of the note, for the inspector. */
  excerpt: string;
  /** Cosmos position — the graph's own layout, lightly scaled. */
  position: THREE.Vector3;
  /** Home position — the same note, pushed far out as a horizon star. */
  skyPosition: THREE.Vector3;
};

export type VaultLink = { source: string; target: string };

export type VaultState = {
  nodes: VaultNode[];
  links: VaultLink[];
  byId: Map<string, VaultNode>;
  loading: boolean;
  reachable: boolean;
  /** Where the cloud actually sits. The graph's layout is not centred on the origin. */
  centre: THREE.Vector3;
  /**
   * How far the outermost note sits from the centre of the cosmos.
   *
   * The camera distance is derived from this rather than hard-coded. The first
   * version put the viewpoint at a fixed 15.5 units and landed *inside* a
   * graph that reaches past 17 — a wall of lines with titles the size of
   * headlines. A framing that follows the data cannot go wrong when the vault
   * grows.
   */
  radius: number;
};

/** How big the cosmos is when you are standing in it. */
const COSMOS_SCALE = 3.4;

/**
 * The horizon is a dome, not a ceiling.
 *
 * The first attempt scaled the graph's own coordinates and lifted them — which
 * put all 272 notes in a slab directly overhead, outside a camera that looks
 * slightly down at the stage. The sky was there and entirely invisible.
 *
 * A direction plus a fixed radius puts them *around* the stage instead, so
 * they meet the eye at the horizon where the platform ends. Same note, same
 * id, same relative arrangement — only the projection changed.
 */
const SKY_RADIUS = 46;
/**
 * How far the sky is pushed upward. Almost not at all, and that is the fix.
 *
 * The first dome lifted every note by 0.42 of a unit vector, which put the
 * whole sky overhead — while the composed camera looks *down* at the stage
 * from above. All 272 stars existed, were correctly placed, and sat outside
 * the frustum in every default view. A sphere that merely leans up meets the
 * eye at the horizon, which is where a horizon belongs.
 */
const SKY_TILT = 0.08;

type RawNode = {
  id: string;
  name?: string;
  folder?: string;
  color?: string;
  excerpt?: string;
  x: number;
  y: number;
  z: number;
};
type RawGraph = { nodes?: RawNode[]; links?: VaultLink[] };

/**
 * The graph's layout, projected onto the dome.
 *
 * Degenerate positions (a note at the exact origin) fall back to a
 * deterministic spread so no two notes ever occupy the same point — a
 * duplicate star would be two notes pretending to be one.
 */
const skyPositionFor = (node: RawNode): THREE.Vector3 => {
  const direction = new THREE.Vector3(node.x, node.y + 0.35, node.z);
  if (direction.lengthSq() < 1e-6) direction.set(0.3, 0.5, 0.8);
  direction.normalize();
  // Push the dome upward so the bulk of it clears the platform rim.
  direction.y = direction.y * 0.8 + SKY_TILT;
  return direction.normalize().multiplyScalar(SKY_RADIUS);
};

export function useVault(): VaultState {
  const [raw, setRaw] = useState<RawGraph | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/obsidian-graph")
      .then((response) => response.json())
      .then((data: RawGraph) => {
        if (cancelled) return;
        if (data?.nodes?.length) setRaw(data);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo<VaultState>(() => {
    if (!raw?.nodes) {
      return {
        nodes: [],
        links: [],
        byId: new Map(),
        loading: !failed,
        reachable: !failed,
        radius: 12,
        centre: new THREE.Vector3(),
      };
    }

    const degree = new Map<string, number>();
    for (const link of raw.links ?? []) {
      degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
      degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
    }

    const nodes: VaultNode[] = raw.nodes.map((node) => ({
      id: node.id,
      name: node.name ?? node.id.split("/").pop()?.replace(/\.md$/, "") ?? node.id,
      folder: node.folder ?? "",
      degree: degree.get(node.id) ?? 0,
      color: node.color ?? "#7dd3fc",
      excerpt: node.excerpt ?? "",
      position: new THREE.Vector3(
        node.x * COSMOS_SCALE,
        node.y * COSMOS_SCALE,
        node.z * COSMOS_SCALE,
      ),
      skyPosition: skyPositionFor(node),
    }));

    const byId = new Map(nodes.map((node) => [node.id, node]));
    // Centre and radius are measured from the data, not assumed. The first
    // framing aimed at the origin and the whole cloud sat in one corner —
    // the graph's own layout has no reason to be centred on zero.
    const centre = new THREE.Vector3();
    for (const node of nodes) centre.add(node.position);
    if (nodes.length > 0) centre.divideScalar(nodes.length);
    const radius = nodes.reduce(
      (max, node) => Math.max(max, node.position.distanceTo(centre)),
      1,
    );
    return { nodes, links: raw.links ?? [], byId, loading: false, reachable: true, radius, centre };
  }, [raw, failed]);
}
