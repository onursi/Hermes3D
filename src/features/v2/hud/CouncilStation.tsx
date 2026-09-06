"use client";

import { useEffect, useState } from "react";

import type { RosterAgent } from "@/features/v2/useRoster";

/**
 * Die Konzilstation: wer am Tisch sitzt, und ob der Tisch überhaupt steht.
 *
 * Der Entwurf für das Agenten-Deck zeigt Karten mit "Ideenfluss 91 %",
 * "Fokus High", "Risiko Low", "Threads 07". Diese Zahlen sind erfunden, und
 * das ist keine Kleinigkeit: sie beantworten genau die Frage, die Onur
 * wirklich gestellt hat — "funktioniert unser Konzil?" — mit einem Bild von
 * einem System, das es so nicht gibt. Ein Deck, das immer 91 % anzeigt,
 * bringt einen dazu, ihm nicht mehr zu glauben, und dann ist auch die eine
 * Zahl wertlos, die einmal echt sein wird.
 *
 * Hier steht deshalb zweierlei, und beides ist nachprüfbar:
 *
 * 1. **Die Teilnehmer**, wie Hermes sie führt: Name, Anbieter, Modell, Rolle,
 *    Zahl der Fertigkeiten. Kein Auslastungsbalken — Hermes liefert keine
 *    Telemetrie, und das steht als Satz da, statt als 0 % oder als 91 %.
 * 2. **Die Bereitschaft**: welche Endpunkte ein Konzil braucht und welche
 *    davon antworten. Fehlt eines, sieht man welches.
 *
 * Wenn Hermes das Konzil eines Tages anbietet, wird aus dieser Liste eine
 * Liste mit lauter Haken — und an dem Tag ist die Anzeige zum ersten Mal
 * spannend, weil sie vorher nie gelogen hat.
 */

type Check = {
  id: string;
  label: string;
  route: string;
  why: string;
  present: boolean | null;
  detail: string;
};

type Readiness = {
  reachable: boolean;
  ready?: boolean;
  summary?: string;
  reason?: string;
  checks: Check[];
};

export function CouncilStation({ agents, rosterReachable }: { agents: RosterAgent[]; rosterReachable: boolean }) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/council/readiness")
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setReadiness(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadiness({ reachable: false, reason: "Prüfung nicht durchführbar.", checks: [] });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-0 overflow-y-auto px-4 py-3">
      <section>
        <h3 className="pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Am Tisch
        </h3>
        {!rosterReachable ? (
          <p className="text-[12px] text-rose-200/80">
            Hermes antwortet nicht. Das heißt nicht, dass keine Agenten da sind — es heißt, dass
            niemand danach fragen kann.
          </p>
        ) : agents.length === 0 ? (
          <p className="text-[12px] text-white/45">Hermes führt keine Profile.</p>
        ) : (
          <ul className="space-y-1.5">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-medium text-white/90">{agent.name}</span>
                  {agent.isDefault ? (
                    <span className="rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-[9px] text-cyan-100">
                      Standard
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono text-[10px] text-white/35">
                    {agent.provider ?? "Anbieter unbekannt"}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-white/30">
                  {agent.model ?? "kein Modell hinterlegt"}
                  {agent.skillCount !== null ? ` · ${agent.skillCount} Fertigkeiten` : ""}
                </p>
                {agent.role ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-white/55">{agent.role}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {/* Der Satz, der die erfundenen Balken ersetzt. */}
        <p className="mt-2 text-[10px] leading-relaxed text-white/30">
          Keine Auslastung, keine Warteschlange, kein Fokuswert: Hermes liefert dazu nichts. Sobald
          es das tut, steht es hier — vorher nicht.
        </p>
      </section>

      <section className="mt-4 border-t border-white/[0.07] pt-3">
        <h3 className="pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Kann eine Runde laufen?
        </h3>
        {loading ? (
          <p className="text-[12px] text-white/40">wird geprüft…</p>
        ) : !readiness?.reachable ? (
          <p className="text-[12px] text-rose-200/80">
            {readiness?.reason ?? "Hermes antwortet nicht."}
          </p>
        ) : (
          <>
            <p
              className={`text-[12px] leading-relaxed ${
                readiness.ready ? "text-emerald-200/85" : "text-amber-200/85"
              }`}
            >
              {readiness.summary}
            </p>
            <ul className="mt-2 space-y-1">
              {readiness.checks.map((check) => (
                <li key={check.id} className="flex items-start gap-2 text-[11px]">
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                      check.present === true
                        ? "bg-emerald-400"
                        : check.present === false
                          ? "bg-rose-400"
                          : "bg-white/25"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="text-white/75">{check.label}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-white/30">{check.route}</span>
                    <span className="block text-white/35">
                      {check.detail} — {check.why}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
