"use client";

import { useEffect, useRef, useState } from "react";

/** Layout is local presentation only; switching never changes the room or camera. */
export function HudLayoutSwitch() {
  const [cockpit, setCockpit] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem("hermes:hud-layout") === "cockpit"; } catch { /* Storage can be unavailable in private contexts. */ }
    const root = button.current?.closest<HTMLElement>("main");
    if (root) root.dataset.hudLayout = saved ? "cockpit" : "quiet";
    // Reading a browser preference is intentionally deferred until after hydration.
    const frame = requestAnimationFrame(() => setCockpit(saved));
    return () => cancelAnimationFrame(frame);
  }, []);

  return <button ref={button} type="button" className="room-tool hud-layout-switch"
    aria-label="Cockpit-Anordnung" aria-pressed={cockpit}
    title={cockpit ? "Zur ruhigen Anordnung wechseln" : "Werkzeuge links als Cockpit anordnen"}
    onClick={() => {
      const next = !cockpit;
      setCockpit(next);
      const root = button.current?.closest<HTMLElement>("main");
      if (root) root.dataset.hudLayout = next ? "cockpit" : "quiet";
      try { localStorage.setItem("hermes:hud-layout", next ? "cockpit" : "quiet"); } catch { /* The current layout still works without persistence. */ }
    }}>
    <span aria-hidden="true">◫</span> {cockpit ? "Cockpit" : "Ansicht"}
  </button>;
}
