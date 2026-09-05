"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";

/**
 * The small piece of state two worlds have to agree on.
 *
 * The build plan is precise about what belongs here and what does not: active
 * world, selection, source and project ids, and the camera to come home to.
 * Explicitly *not* a second task list and *not* a copy of the chat history —
 * those have owners already (Todoist, Hermes), and a second copy of a truth is
 * how a system starts contradicting itself.
 *
 * It exists because of one requirement in section B: a source picked in the
 * cosmos must still be selected after coming home. That cannot live inside a
 * world component, because the world is unmounted on the way there and back.
 *
 * React context rather than a store library — this project has no zustand, and
 * adding a dependency to hold four numbers would be a poor trade.
 */

export type V2World = "home" | "cosmos" | "projects" | "library";

/** What the inspector is about. One thing at a time, by design. */
export type V2Selection =
  | { kind: "none" }
  | { kind: "agent"; id: string }
  | { kind: "source"; id: string; title: string; folder?: string }
  | { kind: "project"; folder: string; name: string };

export type V2Prefs = {
  /** Core brightness, 0.3–1.6. A display preference, nothing more. */
  coreIntensity: number;
  /** Multiplies camera movement. 1 is calm, 3 is Onur's "Lichtgeschwindigkeit". */
  flightSpeed: number;
  /** No warp, just a cut. Honours the OS setting and the toggle. */
  reducedMotion: boolean;
  /** Bloom on emissive edges. Off is the cheap fallback on a weak GPU. */
  bloom: boolean;
};

const DEFAULT_PREFS: V2Prefs = {
  coreIntensity: 1,
  flightSpeed: 1.4,
  reducedMotion: false,
  bloom: true,
};

const PREFS_KEY = "hermes3d-v2-prefs-v1";

export type V2ContextValue = {
  world: V2World;
  travelling: boolean;
  selection: V2Selection;
  /**
   * Focus dims everything that is not the selection.
   *
   * Onur's own words for what this is for: "räume alles aus meinem Blickfeld
   * und zeige mir nur den nächsten sinnvollen Schritt". Deliberately *he*
   * chooses what stays lit — the plan forbids the room asserting a most
   * important goal by itself.
   */
  focus: boolean;
  prefs: V2Prefs;

  goTo: (world: V2World) => void;
  setTravelling: (value: boolean) => void;
  select: (selection: V2Selection) => void;
  clearSelection: () => void;
  setFocus: (value: boolean) => void;
  setPref: <K extends keyof V2Prefs>(key: K, value: V2Prefs[K]) => void;
  rememberHomeCamera: (position: THREE.Vector3, target: THREE.Vector3) => void;
  /**
   * The home camera, as a getter rather than a value.
   *
   * It used to be read out of a ref while building the context value — which
   * is reading a ref during render, and it is wrong for a subtle reason: the
   * value would be captured at render time and then never update, because
   * writing a ref does not re-render. A function reads it when it is actually
   * needed, which is what a ref is for.
   */
  getHomeCamera: () => { position: THREE.Vector3; target: THREE.Vector3 } | null;
};

const V2Context = createContext<V2ContextValue | null>(null);

export function V2Provider({ children }: { children: ReactNode }) {
  const [world, setWorld] = useState<V2World>("home");
  const [travelling, setTravelling] = useState(false);
  const [selection, setSelection] = useState<V2Selection>({ kind: "none" });
  const [focus, setFocus] = useState(false);
  const [prefs, setPrefs] = useState<V2Prefs>(DEFAULT_PREFS);
  const homeCameraRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  /**
   * Preferences are read after mount, never during render.
   *
   * The server cannot know what the browser stored, so reading it during
   * render makes the two passes disagree and React aborts the tree. That
   * happened three times in V1 — with the voice support probe, the skytest
   * canvas and the URL flags. The rule is written into the code now.
   */
  useEffect(() => {
    let stored: Partial<V2Prefs> = {};
    try {
      stored = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<V2Prefs>;
    } catch {
      stored = {};
    }
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reading storage and then setting state in an effect is the prescribed
    // hydration pattern, not an accident: the server cannot know what the
    // browser stored, and deciding during render is what aborted V1's tree
    // three separate times. One extra render on mount is the correct price.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs({
      coreIntensity:
        typeof stored.coreIntensity === "number" ? stored.coreIntensity : DEFAULT_PREFS.coreIntensity,
      flightSpeed:
        typeof stored.flightSpeed === "number" ? stored.flightSpeed : DEFAULT_PREFS.flightSpeed,
      // The operating system's answer wins when the user has not overridden it.
      reducedMotion:
        typeof stored.reducedMotion === "boolean" ? stored.reducedMotion : prefersReduced,
      bloom: typeof stored.bloom === "boolean" ? stored.bloom : DEFAULT_PREFS.bloom,
    });
  }, []);

  const setPref = useCallback<V2ContextValue["setPref"]>((key, value) => {
    setPrefs((previous) => {
      const next = { ...previous, [key]: value };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        // Private mode or blocked storage. A lost preference is not an error.
      }
      return next;
    });
  }, []);

  const rememberHomeCamera = useCallback((position: THREE.Vector3, target: THREE.Vector3) => {
    homeCameraRef.current = { position: position.clone(), target: target.clone() };
  }, []);

  const goTo = useCallback((next: V2World) => setWorld(next), []);

  const clearSelection = useCallback(() => {
    setSelection({ kind: "none" });
    // Focus with nothing selected would dim the room for no reason.
    setFocus(false);
  }, []);

  const value = useMemo<V2ContextValue>(
    () => ({
      world,
      travelling,
      selection,
      focus,
      prefs,
      getHomeCamera: () => homeCameraRef.current,
      goTo,
      setTravelling,
      select: setSelection,
      clearSelection,
      setFocus,
      setPref,
      rememberHomeCamera,
    }),
    [world, travelling, selection, focus, prefs, goTo, clearSelection, setPref, rememberHomeCamera],
  );

  return <V2Context.Provider value={value}>{children}</V2Context.Provider>;
}

export function useV2(): V2ContextValue {
  const ctx = useContext(V2Context);
  if (!ctx) throw new Error("useV2 außerhalb von V2Provider verwendet.");
  return ctx;
}
