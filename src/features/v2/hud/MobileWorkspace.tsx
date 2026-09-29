"use client";

import { useEffect, useState, type RefObject } from "react";
import { House, MessageCircle, Orbit } from "lucide-react";
import { useV2 } from "../state";

/** Presentation only: the existing room, task and conversation stores remain owners. */
export function useMobileWorkspace(world: string, rootRef: RefObject<HTMLElement | null>) {
  const [exploring, setExploring] = useState(false);
  const [consoleVisible, setConsoleVisible] = useState(false);

  useEffect(() => {
    const visibility = (event: Event) => setConsoleVisible((event as CustomEvent).detail === true);
    const explore = () => setExploring(true);
    window.addEventListener("hermes:console-visibility", visibility);
    window.addEventListener("hermes:deck-focus", explore);
    return () => {
      window.removeEventListener("hermes:console-visibility", visibility);
      window.removeEventListener("hermes:deck-focus", explore);
    };
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const resize = () => {
      // Let browser zoom work normally; only follow the keyboard at normal scale.
      if (viewport.scale !== 1) return;
      rootRef.current?.style.setProperty("--mobile-height", `${viewport.height}px`);
      rootRef.current?.style.setProperty("--mobile-top", `${viewport.offsetTop}px`);
      if (rootRef.current) rootRef.current.dataset.mobileCompact = String(viewport.height < 570);
    };
    resize();
    viewport.addEventListener("resize", resize);
    viewport.addEventListener("scroll", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      viewport.removeEventListener("scroll", resize);
    };
  }, [rootRef]);

  const view = consoleVisible ? "assistant" : exploring || world !== "home" ? "rooms" : "work";
  return { view, setExploring };
}

export function MobileNavigation({ view, onExplore, onHome }: {
  view: string;
  onExplore: (exploring: boolean) => void;
  onHome?: () => void;
}) {
  const { goTo } = useV2();
  const home = () => {
    window.dispatchEvent(new Event("hermes:console-hide"));
    window.dispatchEvent(new Event("hermes:rooms-close"));
    onExplore(false);
    onHome?.();
    goTo("home");
    window.dispatchEvent(new CustomEvent("hermes:panel-open", { detail: "work" }));
  };
  const rooms = () => {
    window.dispatchEvent(new Event("hermes:console-hide"));
    onExplore(true);
    window.dispatchEvent(new Event("hermes:rooms-open"));
  };
  return <nav className="mobile-navigation" aria-label="Mobile Hauptnavigation">
    <button type="button" aria-current={view === "work" ? "page" : undefined} onClick={home}>
      <House size={21} aria-hidden="true"/><span>Heute</span>
    </button>
    <button type="button" aria-current={view === "assistant" ? "page" : undefined}
      onClick={() => { window.dispatchEvent(new Event("hermes:rooms-close")); window.dispatchEvent(new Event("hermes:console-open")); }}>
      <MessageCircle size={21} aria-hidden="true"/><span>Hermes</span>
    </button>
    <button type="button" aria-controls="room-navigation" aria-current={view === "rooms" ? "page" : undefined} onClick={rooms}>
      <Orbit size={21} aria-hidden="true"/><span>Räume</span>
    </button>
  </nav>;
}
