"use client";

import { useEffect, useState } from "react";
import { useV2 } from "../state";
import "./mobileToday.css";

/**
 * R44 "Calm Studio" header for the phone's start view (design A, chosen by Onur
 * 2026-09-29). Presentation only: it reads the same roster and approval state
 * the status bar reads and never claims more than those sources know.
 * Hidden everywhere except the mobile work view (see mobileToday.css).
 */
export function MobileToday({ agentCount, rosterReachable, approvalsWaiting, approvalsReachable, onOpenApprovals }: {
  agentCount: number;
  rosterReachable: boolean;
  approvalsWaiting: number;
  approvalsReachable: boolean;
  onOpenApprovals: () => void;
}) {
  const { prefs, setPref } = useV2();
  const light = prefs.mobileTheme === "light";
  // Rendered on the client only: date and greeting depend on the phone's clock.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!now) return null;

  const hour = now.getHours();
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const date = now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
  const summary = !approvalsReachable
    ? "Offene Freigaben sind gerade nicht abrufbar."
    : approvalsWaiting > 0
      ? `${approvalsWaiting} ${approvalsWaiting === 1 ? "Entscheidung wartet" : "Entscheidungen warten"} auf dich.`
      : "Nichts wartet auf eine Entscheidung von dir.";

  return (
    <section className="mobile-today" aria-label="Heute">
      <div className="mobile-today-orb" aria-hidden="true" data-state={rosterReachable ? "ready" : "offline"} />
      <button type="button" className="mobile-theme-toggle" aria-pressed={light}
        aria-label={light ? "Dunkles Design einschalten" : "Helles Design einschalten"}
        onClick={() => setPref("mobileTheme", light ? "dark" : "light")}>
        <span aria-hidden="true">{light ? "☾" : "☀"}</span>{light ? "Dunkel" : "Hell"}
      </button>
      <p className="mobile-today-date">{date}</p>
      <h1>{greeting}, Onur.</h1>
      <p className="mobile-today-summary">{summary}</p>
      <div className="mobile-today-chips">
        <span className="today-chip"><i data-tone={rosterReachable ? "on" : "off"} />Hermes · {rosterReachable ? "bereit" : "offline"}</span>
        {rosterReachable && <span className="today-chip"><i data-tone="idle" />{agentCount} {agentCount === 1 ? "Agent" : "Agenten"}</span>}
        {approvalsReachable && approvalsWaiting > 0 && (
          <button type="button" className="today-chip" onClick={onOpenApprovals}><i data-tone="wait" />Freigabe ansehen</button>
        )}
      </div>
    </section>
  );
}
