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

/**
 * The places that can be mounted. `universe` is the odd one and the new one.
 *
 * The other four are destinations: you are inside them. `universe` is the
 * space they all stand in — the only one you travel *through* rather than to.
 * It is a world in this union because it is mounted the same way and unmounted
 * the same way; making it a separate mode would mean two switches to keep in
 * step, and they would disagree within a week.
 */
export type V2World = "home" | "universe" | "cosmos" | "projects" | "library";

/**
 * *How* a world was entered — and it is not a detail.
 *
 * Onur's complaint about the first build was precise: the dock made him watch
 * a flight he had not asked for. A warp is a nice thing to have and a terrible
 * thing to be forced through, so the two are now different actions rather than
 * one action with a mood.
 *
 * `direct` is a cut: the camera is where it needs to be on the next frame.
 * `travel` is the flight, and only something that means "fly me there" starts
 * one — entering a place you can see from home, never a button in the dock.
 */
export type V2Transit = "direct" | "travel";

/**
 * A world plus how it was entered, in one value.
 *
 * One state and not two, because the scene has to react to the pair: reading
 * `world` and `transit` from separate updates lets a render happen in between
 * where the new world is already set and the old transit still stands, which
 * is exactly the frame that would start a warp the dock just refused.
 *
 * `seq` makes a repeat meaningful. Pressing "Zuhause" while already home is
 * not a no-op — it is "put the view back" — and without a counter React sees
 * an identical value and skips the effect.
 */
export type V2Journey = { world: V2World; transit: V2Transit; seq: number };

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
  /**
   * Volume for the two short confirmation tones, 0 to 1. Zero means off.
   *
   * One number rather than a flag plus a level: two fields would let the app
   * be loud and muted at the same time, and the first bug report would be
   * about exactly that.
   */
  sound: number;
};

const DEFAULT_PREFS: V2Prefs = {
  coreIntensity: 1,
  flightSpeed: 1.4,
  reducedMotion: false,
  bloom: true,
  // Silent until asked. U1.5 is explicit, and so is Onur: no autoplay.
  sound: 0,
};

const PREFS_KEY = "hermes3d-v2-prefs-v1";

export type V2ContextValue = {
  world: V2World;
  /** The full move, for whoever has to react to how it happened. */
  journey: V2Journey;
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

  /**
   * Go somewhere. Directly unless the caller asks for the flight.
   *
   * The default is the safe one on purpose: a new call site that forgets to
   * think about this gets the instant behaviour, and the worst that happens is
   * a missing flourish. The opposite default would give Onur back the forced
   * transition he asked us to remove, from a place nobody remembered to look.
   */
  goTo: (world: V2World, transit?: V2Transit) => void;
  setTravelling: (value: boolean) => void;
  select: (selection: V2Selection) => void;
  clearSelection: () => void;
  setFocus: (value: boolean) => void;
  setPref: <K extends keyof V2Prefs>(key: K, value: V2Prefs[K]) => void;
  /**
   * Where he was standing in a world, so returning to it lands there.
   *
   * Per world rather than home-only, because the plan's "Eintritt/Rückkehr
   * behalten Richtung und Position" is about the universe more than anywhere:
   * entering the library from a particular approach and coming back out facing
   * the other way is the moment a universe stops being a place and becomes a
   * set of screens.
   */
  rememberCamera: (world: V2World, position: THREE.Vector3, target: THREE.Vector3) => void;
  /**
   * The remembered camera, as a getter rather than a value.
   *
   * It used to be read out of a ref while building the context value — which
   * is reading a ref during render, and it is wrong for a subtle reason: the
   * value would be captured at render time and then never update, because
   * writing a ref does not re-render. A function reads it when it is actually
   * needed, which is what a ref is for.
   */
  getCamera: (world: V2World) => { position: THREE.Vector3; target: THREE.Vector3 } | null;
};

const V2Context = createContext<V2ContextValue | null>(null);

export function V2Provider({ children }: { children: ReactNode }) {
  const [journey, setJourney] = useState<V2Journey>({
    world: "home",
    transit: "direct",
    seq: 0,
  });
  const world = journey.world;
  const [travelling, setTravelling] = useState(false);
  const [selection, setSelection] = useState<V2Selection>({ kind: "none" });
  const [focus, setFocus] = useState(false);
  const [prefs, setPrefs] = useState<V2Prefs>(DEFAULT_PREFS);
  const cameraMemory = useRef(
    new Map<V2World, { position: THREE.Vector3; target: THREE.Vector3 }>(),
  );

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
      sound: typeof stored.sound === "number" ? stored.sound : DEFAULT_PREFS.sound,
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

  const rememberCamera = useCallback<V2ContextValue["rememberCamera"]>(
    (world, position, target) => {
      // Cloned, because the caller hands us the live camera vectors and they
      // keep moving. Storing the reference would remember "wherever he is
      // now", which is not a memory.
      cameraMemory.current.set(world, { position: position.clone(), target: target.clone() });
    },
    [],
  );

  const getCamera = useCallback<V2ContextValue["getCamera"]>(
    (world) => cameraMemory.current.get(world) ?? null,
    [],
  );

  const goTo = useCallback<V2ContextValue["goTo"]>(
    (next, transit = "direct") =>
      setJourney((previous) => ({ world: next, transit, seq: previous.seq + 1 })),
    [],
  );

  const clearSelection = useCallback(() => {
    setSelection({ kind: "none" });
    // Focus with nothing selected would dim the room for no reason.
    setFocus(false);
  }, []);

  const value = useMemo<V2ContextValue>(
    () => ({
      world,
      journey,
      travelling,
      selection,
      focus,
      prefs,
      getCamera,
      goTo,
      setTravelling,
      select: setSelection,
      clearSelection,
      setFocus,
      setPref,
      rememberCamera,
    }),
    [
      world,
      journey,
      travelling,
      selection,
      focus,
      prefs,
      goTo,
      clearSelection,
      setPref,
      rememberCamera,
      getCamera,
    ],
  );

  return <V2Context.Provider value={value}>{children}</V2Context.Provider>;
}

export function useV2(): V2ContextValue {
  const ctx = useContext(V2Context);
  if (!ctx) throw new Error("useV2 außerhalb von V2Provider verwendet.");
  return ctx;
}
