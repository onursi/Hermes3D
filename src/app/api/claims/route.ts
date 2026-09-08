import { NextResponse } from "next/server";

import {
  claimsFromApprovals,
  claimsFromTodoist,
  claimsFromWorlds,
  heute,
  type Claim,
  type ClaimResult,
  type SourceState,
} from "@/features/v2/foundations/claims";

/**
 * Was den Hermes-Kern gerade beansprucht — aus allen Quellen, an einer Stelle.
 *
 * Serverseitig, weil der Todoist-Schlüssel in `.env.local` liegt und nicht im
 * Browser. Vorher steckte er im `localStorage`, und der ist an die Herkunft
 * gebunden: Bei fünf Entwicklungsports war er nach jedem Wechsel weg. Das war
 * kein Todoist-Problem, sondern der falsche Ablageort.
 *
 * Die Antwort trägt neben den Ansprüchen immer einen **Quellenblock**. Er
 * unterscheidet „nichts liegt an" von „ich weiß es nicht" — der Kern soll
 * „Todoist nicht verbunden" anzeigen können statt „0 Aufgaben". Eine
 * Kommandozentrale, die eine erfundene Null zeigt, wird genau einmal geglaubt.
 */

export const dynamic = "force-dynamic";

const BASIS = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3430";

async function hole<T>(pfad: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${BASIS}${pfad}`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  const tag = heute();
  const sources: ClaimResult["sources"] = {};
  const claims: Claim[] = [];

  // --- Todoist -------------------------------------------------------------
  const todoist = await hole<{
    connected?: boolean;
    reason?: string;
    tasks?: { id: string; content: string; priority: number; dueDate?: string | null; projectName?: string | null }[];
  }>("/api/todoist/tasks", 12000);

  let zustand: SourceState = "fehler";
  if (todoist?.connected) zustand = "verbunden";
  else if (todoist && todoist.connected === false) zustand = "nicht verbunden";
  sources.todoist = { state: zustand, note: todoist?.reason };

  if (todoist?.connected && todoist.tasks) {
    claims.push(...claimsFromTodoist(todoist.tasks, tag));
  }

  // --- Freigaben -----------------------------------------------------------
  const approvals = await hole<{ ok?: boolean; count?: number }>("/api/approvals");
  sources.freigaben = { state: approvals ? "verbunden" : "fehler" };
  if (approvals?.count) claims.push(...claimsFromApprovals(approvals.count));

  // --- Fristen aus dem Vault ----------------------------------------------
  const worlds = await hole<{ objects?: { id: string; kind: string; title: string; due?: string; waiting?: string }[] }>(
    "/api/vault/worlds",
    12000,
  );
  sources.vault = { state: worlds ? "verbunden" : "fehler" };
  if (worlds?.objects) claims.push(...claimsFromWorlds(worlds.objects, tag));

  /**
   * Reihenfolge: Überfälliges zuerst, danach Freigaben, dann der Rest.
   * Der Kern zeigt nur die ersten paar Körper; was oben steht, entscheidet,
   * was Onur überhaupt sieht.
   */
  const rang = (c: Claim) => (c.overdue ? 0 : c.kind === "freigabe" ? 1 : 2);
  claims.sort((a, b) => rang(a) - rang(b));

  return NextResponse.json({ ok: true, tag, claims, sources } satisfies ClaimResult & { ok: true; tag: string });
}
