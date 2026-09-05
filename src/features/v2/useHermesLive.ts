"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Eine offene Leitung zu Hermes, statt gelegentlich zu fragen.
 *
 * V2 hat Hermes bisher über HTTP befragt: den Roster einmal, die Freigaben
 * alle 45 Sekunden. Das reicht für Namen, die sich nie ändern, und es reicht
 * nicht für alles, was gerade passiert — ein Agent, der antwortet, eine
 * Freigabe, die eintrifft, und später eine Runde des Councils, die läuft.
 *
 * Die Verbindung geht an den **eigenen** Server, nicht an Hermes: der Studio-
 * Proxy unter `/api/gateway/ws` hält die Zugangsdaten und setzt sie in den
 * Verbindungsrahmen ein. Der Browser kennt kein Token und soll keines kennen.
 * Das ist auch der Grund, warum diese Datei so kurz ist — die schwierige
 * Hälfte steht serverseitig und war schon da.
 *
 * Bewusst klein gehalten: verbinden, den Begrüßungsstand behalten, Ereignisse
 * weiterreichen, Aufrufe stellen. Kein zweiter Zustandsspeicher für Agenten
 * oder Sitzungen — den gibt es bereits, und eine zweite Wahrheit über den
 * Zustand von Hermes wäre schlimmer als gar keine Live-Verbindung.
 */

export type LiveStatus =
  /** Noch nichts versucht — der erste Frame nach dem Mount. */
  | "idle"
  | "connecting"
  | "connected"
  /** Verbindung stand und ist weg. Wird automatisch neu versucht. */
  | "lost"
  /** Der Server sagt, es gibt keinen Upstream. Kein Grund zum Wiederholen. */
  | "unavailable";

export type LiveEvent = { event: string; payload?: unknown };

export type HermesLive = {
  status: LiveStatus;
  /** Warum getrennt — im Klartext, für die Anzeige. */
  detail: string | null;
  /** Was der Server beim Verbinden über sich gesagt hat. Roh, ungedeutet. */
  hello: Record<string, unknown> | null;
  /** Die Methoden, die dieser Upstream tatsächlich kann. Leer, solange nichts steht. */
  methods: string[];
  /** Einen JSON-RPC-Aufruf stellen. Wirft, wenn nichts verbunden ist. */
  call: (method: string, params?: unknown) => Promise<unknown>;
  /** Auf Ereignisse hören. Gibt die Abmeldung zurück. */
  subscribe: (listener: (event: LiveEvent) => void) => () => void;
};

/** Wie lange auf eine Antwort gewartet wird, bevor sie als verloren gilt. */
const CALL_TIMEOUT_MS = 20_000;

export function useHermesLive(enabled = true): HermesLive {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [hello, setHello] = useState<Record<string, unknown> | null>(null);
  const [methods, setMethods] = useState<string[]>([]);

  const socket = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: number }>());
  const listeners = useRef(new Set<(event: LiveEvent) => void>());
  const nextId = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let closedByUs = false;
    let retry: number | null = null;
    let attempt = 0;
    // Einmal festgehalten, damit das Aufräumen dieselbe Map leert, die die
    // Verbindung gefüllt hat. Die Lint-Regel hat recht: ein Ref kann beim
    // Aufräumen auf etwas anderes zeigen als beim Anlegen.
    const waiting = pending.current;

    const open = () => {
      // Gleiche Herkunft, gleicher Port: der Proxy läuft in diesem Server.
      // Eine konfigurierbare Adresse wäre eine zweite Stelle, an der etwas
      // falsch stehen kann, und es gibt nichts einzustellen.
      const scheme = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${scheme}://${window.location.host}/api/gateway/ws`;

      setStatus("connecting");
      const ws = new WebSocket(url);
      socket.current = ws;

      ws.onopen = () => {
        // Ohne Zugangsdaten: der Proxy setzt das serverseitige Token ein.
        // Schickte der Browser hier eines mit, würde der Proxy seines
        // *nicht* einsetzen — und der Browser hat keines.
        ws.send(
          JSON.stringify({
            type: "req",
            id: "connect",
            method: "connect",
            params: { client: { name: "hermes3d-v2", mode: "operator" } },
          }),
        );
      };

      ws.onmessage = (message) => {
        let frame: {
          type?: string;
          id?: string;
          ok?: boolean;
          payload?: unknown;
          error?: { message?: string };
          event?: string;
        };
        try {
          frame = JSON.parse(String(message.data));
        } catch {
          return;
        }

        if (frame.type === "event") {
          // Ereignisse werden nicht gefiltert. Der Server schickt, was er für
          // wichtig hält; wer damit etwas anfangen kann, meldet sich an.
          const evt = { event: String(frame.event ?? ""), payload: frame.payload };
          for (const listener of listeners.current) {
            try {
              listener(evt);
            } catch (error) {
              console.error("[v2-live] Ereignisempfänger hat geworfen:", error);
            }
          }
          return;
        }

        if (frame.type !== "res") return;

        if (frame.id === "connect") {
          if (frame.ok) {
            attempt = 0;
            const payload = (frame.payload ?? {}) as Record<string, unknown>;
            setHello(payload);
            const features = payload.features as { methods?: unknown } | undefined;
            setMethods(Array.isArray(features?.methods) ? (features!.methods as string[]) : []);
            setStatus("connected");
            setDetail(null);
          } else {
            // Ein abgelehnter Verbindungsversuch wiederholt sich nicht von
            // selbst besser. Der Grund steht in der Anzeige, statt dass die
            // Oberfläche stumm im Kreis läuft.
            setStatus("unavailable");
            setDetail(frame.error?.message ?? "Verbindung abgelehnt");
            closedByUs = true;
            ws.close();
          }
          return;
        }

        const waiting = frame.id ? pending.current.get(frame.id) : undefined;
        if (!waiting || !frame.id) return;
        pending.current.delete(frame.id);
        window.clearTimeout(waiting.timer);
        if (frame.ok) waiting.resolve(frame.payload);
        else waiting.reject(new Error(frame.error?.message ?? "Aufruf fehlgeschlagen"));
      };

      ws.onclose = (event) => {
        socket.current = null;
        // Alles, was noch auf Antwort wartet, wartet vergeblich. Offene
        // Zusagen ohne Auflösung sind der Grund, warum Oberflächen
        // "lädt…" anzeigen, bis jemand neu lädt.
        for (const [, waiting] of pending.current) {
          window.clearTimeout(waiting.timer);
          waiting.reject(new Error("Verbindung getrennt"));
        }
        pending.current.clear();

        if (closedByUs) return;
        setStatus("lost");
        setDetail(event.reason || null);
        // Zurückhaltend wiederholen. Ein Server, der gerade neu startet, wird
        // von einem Wiederholungsgewitter nicht schneller fertig.
        attempt += 1;
        const wait = Math.min(30_000, 800 * 2 ** Math.min(attempt, 5));
        retry = window.setTimeout(open, wait);
      };

      ws.onerror = () => {
        // Der Fehler selbst trägt im Browser keine brauchbare Information;
        // das Schließen danach schon. Hier nichts zu tun ist richtig.
      };
    };

    open();

    return () => {
      closedByUs = true;
      if (retry !== null) window.clearTimeout(retry);
      for (const [, entry] of waiting) window.clearTimeout(entry.timer);
      waiting.clear();
      socket.current?.close();
      socket.current = null;
    };
  }, [enabled]);

  const call = useCallback((method: string, params?: unknown) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Keine Verbindung zu Hermes"));
    }
    nextId.current += 1;
    const id = `v2-${nextId.current}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        pending.current.delete(id);
        reject(new Error(`Zeitüberschreitung bei ${method}`));
      }, CALL_TIMEOUT_MS);
      pending.current.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ type: "req", id, method, params }));
    });
  }, []);

  const subscribe = useCallback((listener: (event: LiveEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  return { status, detail, hello, methods, call, subscribe };
}
