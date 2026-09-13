"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { V2Provider } from "../v2/state";
import {
  actionPayload,
  approveTest,
  demoSequence,
  executeTest,
  initialCouncil,
  reduceCouncil,
  ROLES,
  type CouncilEvent,
  type CouncilState,
} from "./model";
import { useCouncilVoice } from "./useCouncilVoice";
import "./council.css";

const Scene = dynamic(() => import("./CouncilScene"), { ssr: false });
const phases: Record<string, string> = {
  briefing: "Frage klären",
  retrieving: "Kontext prüfen",
  positioning: "Perspektiven",
  debating: "Unterschiede",
  decision: "Hermes moderiert",
  paused: "Unterbrochen",
  completed: "Test abgeschlossen",
};

type LiveOpinion = {
  id: "hermes" | "gemini" | "astra";
  name: string;
  provider: string;
  ok: boolean;
  text: string | null;
  reason?: string;
};

const profileById: Record<string, { model: string; voice: string }> = {
  hermes: { model: "gpt-5.6-sol · medium · LifeOS-Kontext", voice: "Jones · ElevenLabs" },
  gemini: { model: "Gemini 3.8 Flash · high · unabhängige Sicht", voice: "Laura · ElevenLabs" },
  astra: { model: "GPT-6 Astra · Codex · unabhängige Sicht", voice: "Sarah · ElevenLabs" },
};

function liveSequence(
  session: CouncilState,
  opinions: LiveOpinion[],
  moderation: string | null,
): CouncilEvent[] {
  const events: CouncilEvent[] = [];
  const add = (event: Omit<CouncilEvent, "id" | "seq" | "sessionId" | "revision">) => {
    const seq = events.length + 1;
    const complete = {
      ...event,
      id: session.id + ":" + seq,
      seq,
      sessionId: session.id,
      revision: session.revision,
    };
    events.push(complete);
    return complete;
  };
  add({ type: "phase", text: "retrieving" });
  add({ type: "phase", text: "positioning" });

  const hermes = opinions.find((entry) => entry.id === "hermes");
  const gemini = opinions.find((entry) => entry.id === "gemini");
  const astra = opinions.find((entry) => entry.id === "astra");
  const hermesClaim =
    hermes?.ok && hermes.text
      ? add({ type: "claim", participant: "hermes", source: "brief", text: hermes.text })
      : null;
  if (gemini?.ok && gemini.text) {
    add(
      hermesClaim
        ? { type: "challenge", participant: "gemini", target: hermesClaim.id, text: gemini.text }
        : { type: "claim", participant: "gemini", text: gemini.text },
    );
  }
  if (astra?.ok && astra.text) add({ type: "claim", participant: "astra", text: astra.text });
  add({ type: "phase", text: "debating" });

  const failures = opinions
    .filter((entry) => !entry.ok)
    .map((entry) => `${entry.name}: ${entry.reason || "nicht erreichbar"}`);
  const honestFallback = [
    "Die erreichbaren Perspektiven bleiben getrennt. Es wurde kein Konsens erzwungen.",
    failures.length ? "Nicht erreichbar: " + failures.join(" · ") : "",
    "Onur entscheidet, welcher kleine Versuch als Nächstes durchgeführt wird.",
  ]
    .filter(Boolean)
    .join(" ");
  add({
    type: "synthesis",
    participant: "hermes",
    text: moderation?.trim() || honestFallback,
  });
  return events;
}

export default function CouncilLab() {
  return (
    <V2Provider>
      <Council />
    </V2Provider>
  );
}

function Council() {
  const [mission, setMission] = useState("Wie prüfen wir eine Idee mit einem kleinen Versuch?");
  const [source, setSource] = useState("Für den Versuch sind Erfolgskriterium und Aufwand noch offen.");
  const [state, setState] = useState<CouncilState>(() => initialCouncil("preview", "", ""));
  const [running, setRunning] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [panel, setPanel] = useState(true);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [participant, setParticipant] = useState<string | null>(null);
  const [view, setView] = useState("working");
  const [quiet, setQuiet] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [audio, setAudio] = useState(false);
  const [notice, setNotice] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);
  const archive = useRef<CouncilEvent[]>([]);
  const playback = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<CouncilEvent[]>([]);
  const active = state.events.at(-1);

  const stopPlayback = useCallback(() => {
    playback.current?.pause();
    playback.current = null;
    setSpeaking(false);
  }, []);
  const pause = useCallback(() => {
    stopPlayback();
    setRunning(false);
    setState((current) => ({ ...current, phase: "paused" }));
  }, [stopPlayback]);
  const voice = useCouncilVoice(setVoiceText, pause);

  useEffect(() => {
    void fetch("/api/voice")
      .then((response) => response.json())
      .then((result: { ok?: boolean }) => setVoiceReady(Boolean(result.ok)))
      .catch(() => setVoiceReady(false));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setQuiet(media.matches);
    const frame = requestAnimationFrame(update);
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!running || speaking) return;
    const next = queue[state.events.length];
    if (!next) {
      if (queue.length > 0 && state.events.length >= queue.length) setRunning(false);
      return;
    }
    const timer = setTimeout(
      () => setState((current) => reduceCouncil(current, next)),
      quiet || view === "compact" ? 650 : view === "cinematic" ? 2700 : 1700,
    );
    return () => clearTimeout(timer);
  }, [running, queue, state.events.length, quiet, view, speaking]);

  useEffect(() => {
    if (state.mode !== "replay") archive.current = state.events;
  }, [state.events, state.mode]);

  useEffect(() => {
    const contribution =
      active?.participant && ["claim", "challenge", "synthesis"].includes(active.type);
    if (!audio || voice.listening || !running || !contribution) return;
    let cancelled = false;
    const participantId = active.participant || "hermes";
    setSpeaking(true);
    setNotice(`${profileById[participantId]?.voice || "ElevenLabs"} spricht …`);
    void fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: active.text, agentId: participantId }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error || "Stimme nicht verfügbar.");
        }
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        const player = new Audio(url);
        playback.current = player;
        player.onended = () => {
          URL.revokeObjectURL(url);
          playback.current = null;
          setSpeaking(false);
        };
        player.onerror = () => {
          URL.revokeObjectURL(url);
          playback.current = null;
          setSpeaking(false);
          setNotice("ElevenLabs-Wiedergabe fehlgeschlagen. Es wurde keine Computerstimme eingesetzt.");
        };
        void player.play().catch((error) => {
          setSpeaking(false);
          setNotice(error instanceof Error ? error.message : "Audio konnte nicht gestartet werden.");
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setSpeaking(false);
        setNotice(error instanceof Error ? error.message : "Stimme nicht verfügbar.");
      });
    return () => {
      cancelled = true;
      stopPlayback();
    };
  }, [active, audio, voice.listening, running, stopPlayback]);

  function start() {
    stopPlayback();
    voice.stop();
    const session = initialCouncil(crypto.randomUUID(), mission.trim(), source, state.revision + 1);
    setState(session);
    setQueue(demoSequence(session));
    setRunning(true);
    setNotice("DEMO · Keine Modelle, keine privaten Quellen, keine produktiven Schreibaktionen.");
  }

  async function startLive() {
    if (!mission.trim() || liveBusy) return;
    pause();
    setLiveBusy(true);
    setNotice("Hermes, Gemini und Astra prüfen dasselbe freigegebene Briefing unabhängig …");
    const session = initialCouncil(
      crypto.randomUUID(),
      mission.trim(),
      source,
      state.revision + 1,
      "live",
    );
    setState(session);
    setQueue([]);
    try {
      const response = await fetch("/api/council/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission: mission.trim(), context: source }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        reason?: string;
        opinions?: LiveOpinion[];
        moderation?: string | null;
      };
      if (!data.ok || !data.opinions) throw new Error(data.reason || "Live-Konsil nicht erreichbar.");
      setQueue(liveSequence(session, data.opinions, data.moderation || null));
      setRunning(true);
      setNotice(
        "LIVE · Beiträge sind namentlich getrennt. Hermes moderiert; keine Datei, Aufgabe oder Nachricht wird geschrieben.",
      );
    } catch (error) {
      setState((current) => ({ ...current, phase: "paused" }));
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setLiveBusy(false);
    }
  }

  function revise() {
    pause();
    const session = initialCouncil(crypto.randomUUID(), mission, source, state.revision + 1);
    setState(session);
    setQueue([]);
    setNotice("Neues Briefing. Frühere Beiträge gelten nicht für diese Revision.");
  }

  function replay() {
    stopPlayback();
    voice.stop();
    const saved = archive.current;
    if (!saved.length) return;
    setState({
      ...state,
      mode: "replay",
      events: [],
      phase: "briefing",
      approval: null,
      applied: 0,
      testTask: undefined,
    });
    setQueue(saved);
    setRunning(true);
    setNotice("REPLAY · Nur gespeicherte Ereignisse; alle Aktionen gesperrt.");
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ ...state, schemaVersion: 1 }, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Hermes-Konsil-Testprotokoll.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const proposal = actionPayload(state);
  const role = ROLES.find((entry) => entry.id === participant);
  const contributions = state.events.filter((event) =>
    ["claim", "challenge", "synthesis"].includes(event.type),
  );
  const lastContribution = contributions.at(-1);

  return (
    <main className={"council-lab " + view}>
      <div className="council-space">
        <Scene state={state} quiet={quiet} onSource={() => setSourceOpen(true)} onParticipant={setParticipant} />
      </div>

      <header className="council-top">
        <div>
          <span>JARVIS // HERMES · KONSIL / {state.mode.toUpperCase()}</span>
          <h1>Drei Stimmen. Eine klare Entscheidung.</h1>
          <p>{phases[state.phase]} · Briefing {state.revision}</p>
        </div>
        <Link href="/v2">← Zuhause</Link>
      </header>

      <nav className="council-controls" aria-label="Konsil steuern">
        <button onClick={() => setPanel(!panel)}>{panel ? "Pult minimieren" : "Pult öffnen"}</button>
        <select aria-label="Darstellung" value={view} onChange={(event) => setView(event.target.value)}>
          <option value="compact">Kompakt</option>
          <option value="working">Arbeitsmodus</option>
          <option value="cinematic">Cinematic</option>
        </select>
        <button onClick={pause}>Unterbrechen</button>
        <button
          disabled={voiceReady === false}
          onClick={() => {
            stopPlayback();
            setAudio(!audio);
          }}
        >
          {audio ? "Stimmen aus" : voiceReady === false ? "ElevenLabs fehlt" : "Stimmen an"}
        </button>
        <button onClick={() => setQuiet(!quiet)}>{quiet ? "Bewegung ruhig" : "Bewegung an"}</button>
      </nav>

      <section className="council-ledger" aria-label="Konsilbeiträge">
        <div className="council-ledger-head">
          <span>LIVE-PROTOKOLL</span>
          <strong>{contributions.length} Beiträge</strong>
        </div>
        {ROLES.map((entry) => {
          const latest = [...contributions].reverse().find((event) => event.participant === entry.id);
          const isActive = lastContribution?.participant === entry.id;
          return (
            <button
              key={entry.id}
              className={isActive ? "active" : ""}
              style={{ "--speaker": entry.color } as React.CSSProperties}
              onClick={() => setParticipant(entry.id)}
            >
              <i />
              <span>
                <b>{entry.name}</b>
                <small>{profileById[entry.id]?.model}</small>
              </span>
              <em>{latest ? "Beitrag ansehen" : "wartet"}</em>
            </button>
          );
        })}
      </section>

      {lastContribution && (
        <aside
          className="council-contribution"
          style={
            {
              "--speaker": ROLES.find((entry) => entry.id === lastContribution.participant)?.color || "#82d8ed",
            } as React.CSSProperties
          }
        >
          <span>
            {ROLES.find((entry) => entry.id === lastContribution.participant)?.name} ·{" "}
            {lastContribution.type === "challenge"
              ? "UNABHÄNGIGER EINWAND"
              : lastContribution.type === "synthesis"
                ? "MODERATION"
                : "PERSPEKTIVE"}
          </span>
          <p>{lastContribution.text}</p>
          {lastContribution.target && (
            <button
              onClick={() => {
                setPanel(true);
                setNotice(
                  "Bezug: " + state.events.find((event) => event.id === lastContribution.target)?.text,
                );
              }}
            >
              Bezogene Aussage zeigen
            </button>
          )}
        </aside>
      )}

      {panel && (
        <aside className="council-pult" aria-label="Konsil Arbeitsfläche">
          <div className="council-panel-head">
            <div>
            <small>JARVIS // HERMES STEUERT</small>
              <strong>Briefing & Entscheidung</strong>
            </div>
            <button aria-label="Pult schließen" onClick={() => setPanel(false)}>×</button>
          </div>
          <p className="council-note">
            Jarvis/Hermes kennt den freigegebenen LifeOS-Kontext und moderiert. Gemini und Astra erhalten
            nur diese Frage und dieses Briefing. Die Modelle stimmen nicht automatisch ab.
          </p>
          <label>
            Deine Frage
            <textarea value={mission} maxLength={3000} onChange={(event) => { setMission(event.target.value); pause(); }} />
          </label>
          <label>
            Freigegebener Kontext
            <textarea value={source} maxLength={10000} onChange={(event) => { setSource(event.target.value); pause(); }} />
          </label>
          <button disabled={!mission.trim() || liveBusy} onClick={() => void startLive()}>
            {liveBusy ? "Drei Perspektiven werden eingeholt …" : "Live-Konsil · Jarvis/Hermes + Gemini + Astra"}
          </button>
          <button disabled={!mission.trim() || liveBusy} onClick={start}>Ablauf ohne Modelle testen</button>

          <details>
            <summary>Spracheingabe</summary>
            <p>
              Die hochwertige Aufnahme wird nach dem Stoppen mit ElevenLabs Scribe auf Deutsch
              transkribiert. Du prüfst den Text vor dem Start.
            </p>
            <button onClick={voice.listening ? voice.stop : voice.start}>
              {voice.listening ? "Aufnahme stoppen & transkribieren" : "Mikrofon bewusst aktivieren"}
            </button>
            <p role="status">{voice.status}</p>
            <textarea aria-label="Diktierter Entwurf" value={voiceText} onChange={(event) => setVoiceText(event.target.value)} />
            <button
              disabled={!voiceText.trim()}
              onClick={() => {
                voice.stop();
                setMission(voiceText);
                revise();
                setNotice("Diktat in der Frage. Bitte vor dem Live-Konsil prüfen.");
              }}
            >
              Als Frage übernehmen
            </button>
          </details>

          {state.phase === "decision" || state.phase === "completed" ? (
            <section>
              <h2>Deine Entscheidung</h2>
              <p>{state.events.find((event) => event.type === "synthesis")?.text}</p>
              {state.mode === "live" ? (
                <p>Keine automatische Abstimmung. Das Konsil besitzt hier keinen Schreibzugriff.</p>
              ) : (
                <details>
                  <summary>Exakte Testaktion ansehen</summary>
                  <pre>{proposal}</pre>
                  <button
                    disabled={state.mode === "replay" || Boolean(state.applied)}
                    onClick={() => setState((current) => executeTest(approveTest(current, proposal)))}
                  >
                    Testaktion freigeben & ausführen
                  </button>
                </details>
              )}
            </section>
          ) : null}

          <details>
            <summary>Vollständiges Protokoll · {state.events.length}</summary>
            {state.events.map((event) => (
              <article key={event.id}>
                <small>
                  {event.seq} · {ROLES.find((entry) => entry.id === event.participant)?.name || event.type}
                </small>
                <p>{event.text}</p>
              </article>
            ))}
          </details>
          <button disabled={!state.events.length || running} onClick={replay}>Verlauf abspielen</button>
          <button disabled={!state.events.length} onClick={download}>Protokoll herunterladen</button>
          <p role="status">{notice}</p>
        </aside>
      )}

      {sourceOpen && (
        <aside className="council-source">
          <button aria-label="Quelle schließen" onClick={() => setSourceOpen(false)}>×</button>
          <h2>Freigegebenes Briefing</h2>
          <p>Nur dieser Inhalt wird an die unabhängigen Perspektiven gegeben.</p>
          <blockquote>{state.source || "Kein Kontext eingegeben."}</blockquote>
        </aside>
      )}
      {role && (
        <aside className="council-source council-profile">
          <button onClick={() => setParticipant(null)}>×</button>
          <small style={{ color: role.color }}>{role.name.toUpperCase()}</small>
          <h2>{role.role}</h2>
          <p>{profileById[role.id]?.model}</p>
          <p>Stimme: {profileById[role.id]?.voice}</p>
          <h3>Letzter Beitrag</h3>
          <p>
            {[...contributions].reverse().find((event) => event.participant === role.id)?.text ||
              "In dieser Sitzung noch kein Beitrag."}
          </p>
        </aside>
      )}
    </main>
  );
}
