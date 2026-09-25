#!/usr/bin/env node
/**
 * Council Concurrency Test — misst echte Backend-Nebenläufigkeit.
 *
 * Aus §3 der Council-Kernel-Notiz und dem Gespräch (Claude 3. Runde):
 * - Erst Einzellauf messen (Baseline)
 * - Dann zwei Sessions parallel auf router-opencode (free) starten
 * - Prüfen: getrennte Deltas? überlappende Zeitfenster? Abbruch isoliert? Resume sauber?
 * - Wenn Baseline ×2 ≈ Parallel-Dauer → Backend serialisiert → Council bleibt sequenziell
 *
 * Nutzung:
 *   node scripts/test-council-concurrency.mjs --baseline      # nur Einzellauf
 *   node scripts/test-council-concurrency.mjs --parallel      # zwei Sessions parallel
 *   node scripts/test-council-concurrency.mjs --full          # baseline + parallel + report
 *
 * Kosten: router-opencode = opencode-free/nemotron-3-ultra-free = KOSTENLOS
 */

import { WebSocket } from "ws";

const GATEWAY_URL = "ws://127.0.0.1:3200/api/gateway/ws";  // Produktionsserver (Port 3200)
const TEST_PROFILE = "router-opencode";             // Free-Modell, kein Kostenrisiko
const TEST_PROMPT_ALPHA = "Antworte exakt mit dem Wort ALPHA und nichts anderem.";
const TEST_PROMPT_BETA = "Antworte exakt mit dem Wort BETA und nichts anderem.";

const startTime = Date.now();
const allEvents = [];

function log(...args) {
  const t = Date.now() - startTime;
  console.log(`[${t.toString().padStart(5)}ms]`, ...args);
}

function record(sessionId, event) {
  const e = { t: Date.now() - startTime, sessionId, ...event };
  allEvents.push(e);
  return e;
}

async function connectBridge() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GATEWAY_URL);
    ws.on("open", async () => {
      // Gateway-Handshake zuerst: connect mit type="req"
      const handshakeId = "init-connect";
      ws.send(JSON.stringify({
        type: "req",
        id: handshakeId,
        method: "connect",
        params: { client: { id: "council-test", version: "1.0" } }
      }));
      
      // Warten auf Handshake-Response
      const handler = (msg) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.id === handshakeId && data.type === "res") {
            ws.off("message", handler);
            if (!data.ok) {
              reject(new Error(`Handshake failed: ${data.error?.message || "unknown"}`));
            } else {
              log("Gateway handshake OK");
              resolve(ws);
            }
          }
        } catch {
          // ignore
        }
      };
      ws.on("message", handler);
      
      setTimeout(() => {
        ws.off("message", handler);
        reject(new Error("Handshake timeout"));
      }, 10000);
    });
    ws.on("error", reject);
    ws.on("close", () => log("WS closed"));
  });
}

async function sendRpc(ws, method, params = {}) {
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const handler = (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.id === id && data.type === "res") {
          ws.off("message", handler);
          if (!data.ok) reject(new Error(data.error?.message || "RPC error"));
          else resolve(data.payload ?? data);
        }
      } catch {
        // ignore non-json
      }
    };
    ws.on("message", handler);
    ws.send(JSON.stringify({ type: "req", id, method, params }));
    setTimeout(() => {
      ws.off("message", handler);
      reject(new Error(`Timeout: ${method}`));
    }, 30000);
  });
}

async function createSession(ws, profileKey) {
  const sessionKey = `agent:${profileKey}:test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return { sessionKey, runtimeId: sessionKey };
}

async function sendPrompt(ws, sessionKey, prompt) {
  const result = await sendRpc(ws, "chat.send", { sessionKey, message: prompt });
  return result.runId;
}

async function abortRun(ws, sessionKey, runId) {
  await sendRpc(ws, "chat.abort", { sessionKey, runId });
}

async function resumeSession(ws, sessionKey) {
  await sendRpc(ws, "chat.history", { sessionKey });
}

async function getHistory(ws, sessionKey) {
  const res = await sendRpc(ws, "chat.history", { sessionKey });
  return res.messages || [];
}

async function runBaseline(ws) {
  log("=== BASELINE: Einzellauf ===");
  const { sessionKey, runtimeId } = await createSession(ws, TEST_PROFILE);
  log("Session erstellt:", sessionKey, runtimeId);

  const t0 = Date.now();
  const runId = await sendPrompt(ws, sessionKey, TEST_PROMPT_ALPHA);
  log("Prompt gesendet, runId:", runId);

  // Warten auf Abschluss (state === 'final' oder 'error')
  await new Promise((resolve, reject) => {
    const handler = (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "event" && data.event === "chat" && data.payload?.runId === runId) {
          if (data.payload?.state === "final" || data.payload?.state === "error") {
            ws.off("message", handler);
            resolve();
          }
        }
      } catch {}
    };
    ws.on("message", handler);
    setTimeout(() => { ws.off("message", handler); reject(new Error("Baseline timeout")); }, 120000);
  });

  const duration = Date.now() - t0;
  const history = await getHistory(ws, sessionKey);
  const tokens = JSON.stringify(history).length / 4; // grobe Schätzung
  log(`Baseline fertig: ${duration}ms, ~${Math.round(tokens)} Tokens`);
  return { durationMs: duration, tokens: Math.round(tokens) };
}

async function runParallel(ws) {
  log("=== PARALLEL: Zwei Sessions gleichzeitig ===");

  // Session Alpha
  const alphaSession = await createSession(ws, TEST_PROFILE);
  const alpha = {
    sessionKey: alphaSession.sessionKey,
    runtimeId: alphaSession.runtimeId,
    ws,
    events: [],
    promptSentAt: 0,
    aborted: false,
  };

  // Session Beta
  const betaSession = await createSession(ws, TEST_PROFILE);
  const beta = {
    sessionKey: betaSession.sessionKey,
    runtimeId: betaSession.runtimeId,
    ws,
    events: [],
    promptSentAt: 0,
    aborted: false,
  };

  // Event-Listener für beide Sessions
  const messageHandler = (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.type === "event" && data.event === "chat") {
        const { sessionKey, runId, state, delta, text, message } = data.payload || {};
        const target = sessionKey === alpha.sessionKey ? alpha : (sessionKey === beta.sessionKey ? beta : null);
        if (target) {
          const chunk = delta || text || (state === "final" ? (message?.content || "") : "");
          target.events.push(record(target.sessionKey, { runId, state, text: chunk }));
          if (state === "delta") {
            if (!target.firstDeltaAt) target.firstDeltaAt = Date.now();
            target.lastDeltaAt = Date.now();
          }
          if (state === "final" || state === "error") {
            target.completeAt = Date.now();
          }
        }
      }
    } catch {}
  };
  ws.on("message", messageHandler);

  // Beide Prompts quasi gleichzeitig abfeuern (innerhalb 50ms)
  alpha.promptSentAt = Date.now();
  const alphaRunId = await sendPrompt(ws, alpha.sessionKey, TEST_PROMPT_ALPHA);
  log("Alpha prompt sent, runId:", alphaRunId);

  await new Promise(r => setTimeout(r, 50));

  beta.promptSentAt = Date.now();
  const betaRunId = await sendPrompt(ws, beta.sessionKey, TEST_PROMPT_BETA);
  log("Beta prompt sent, runId:", betaRunId);

  // Warten bis beide fertig oder Timeout
  const waitStart = Date.now();
  while ((!alpha.completeAt || !beta.completeAt) && Date.now() - waitStart < 120000) {
    await new Promise(r => setTimeout(r, 100));
  }

  ws.off("message", messageHandler);

  log("Alpha complete:", !!alpha.completeAt, "Beta complete:", !!beta.completeAt);
  return { alpha, beta };
}

async function testAbortIsolation(ws) {
  log("=== ABORT-ISOLATION TEST ===");
  const { sessionKey: s1 } = await createSession(ws, TEST_PROFILE);
  const { sessionKey: s2 } = await createSession(ws, TEST_PROFILE);

  const runId1 = await sendPrompt(ws, s1, "Zähle langsam von 1 bis 100. Eine Zahl pro Sekunde.");
  await new Promise(r => setTimeout(r, 500)); // kurz laufen lassen

  log("Abbruch Session 1...");
  await abortRun(ws, s1, runId1);

  // Session 2 weiterlaufen lassen
  const runId2 = await sendPrompt(ws, s2, TEST_PROMPT_BETA);
  await new Promise((resolve) => {
    const handler = (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === "event" && data.event === "chat" && data.payload?.runId === runId2) {
          if (data.payload?.state === "final" || data.payload?.state === "error") {
            ws.off("message", handler);
            resolve();
          }
        }
      } catch {}
    };
    ws.on("message", handler);
    setTimeout(() => { ws.off("message", handler); resolve(); }, 120000);
  });

  log("Abort-Isolation: Session 2 lief weiter trotz Abort von Session 1");
}

async function testResumeIntegrity(ws, sessionKey, expectedContent) {
  log("=== RESUME INTEGRITY ===");
  await resumeSession(ws, sessionKey);
  const history = await getHistory(ws, sessionKey);
  const histStr = JSON.stringify(history);
  const ok = histStr.includes(expectedContent);
  log(`Resume Check: ${ok ? "OK" : "FEHLER"} — erwarteter Inhalt ${ok ? "gefunden" : "NICHT gefunden"}`);
  return ok;
}

function analyzeResults(baseline, parallel) {
  log("\n=== AUSWERTUNG ===");

  const a = parallel.alpha;
  const b = parallel.beta;

  // 1. Überlappende Zeitfenster?
  const aStart = a.promptSentAt;
  const aEnd = a.completeAt || Date.now();
  const bStart = b.promptSentAt;
  const bEnd = b.completeAt || Date.now();

  const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const totalParallel = Math.max(aEnd, bEnd) - Math.min(aStart, bStart);
  const overlapPct = totalParallel > 0 ? (overlap / totalParallel) * 100 : 0;

  log(`Alpha: ${aEnd - aStart}ms (first delta: ${a.firstDeltaAt ? a.firstDeltaAt - aStart : "?"}ms)`);
  log(`Beta:  ${bEnd - bStart}ms (first delta: ${b.firstDeltaAt ? b.firstDeltaAt - bStart : "?"}ms)`);
  log(`Überlappung: ${overlap}ms (${overlapPct.toFixed(1)}% der Gesamtzeit)`);

  // 2. Serialisierung prüfen: Baseline × 2 ≈ Parallel-Gesamtdauer?
  const serialExpectation = baseline.durationMs * 2;
  const parallelTotal = totalParallel;
  const ratio = parallelTotal / serialExpectation;

  log(`Baseline ×2: ${serialExpectation}ms`);
  log(`Parallel gesamt: ${parallelTotal}ms`);
  log(`Ratio: ${ratio.toFixed(2)} (≈1.0 = serialisiert, ≈0.5 = echt parallel)`);

  // 3. Deltas sauber getrennt?
  const alphaDeltas = a.events.filter(e => e.state === "delta" || e.type === "message.delta");
  const betaDeltas = b.events.filter(e => e.state === "delta" || e.type === "message.delta");
  const alphaText = alphaDeltas.map(e => e.text).join("");
  const betaText = betaDeltas.map(e => e.text).join("");
  const crossContamination = alphaText.includes("BETA") || betaText.includes("ALPHA");
  log(`Alpha-Text: "${alphaText.slice(0, 50)}"`);
  log(`Beta-Text:  "${betaText.slice(0, 50)}"`);
  log(`Cross-Contamination: ${crossContamination ? "JA (FEHLER)" : "NEIN (OK)"}`);

  // 4. Zusammenfassung
  const trulyParallel = ratio < 0.75 && overlapPct > 30 && !crossContamination;
  log(`\n>>> BACKEND PARALLEL: ${trulyParallel ? "JA ✓" : "NEIN (serialisiert) ✗"}`);
  log(`>>> EMPFEHLUNG: ${trulyParallel ? "Council-Runden parallelisieren (Promise.all)" : "Council bleibt sequenziell, ehrlich anzeigen"}`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "--full";

  log("Verbinde zu Hermes Gateway:", GATEWAY_URL);
  const ws = await connectBridge();
  log("Verbunden & Handshake OK.");

  // Warte kurz auf Initialisierung
  await new Promise(r => setTimeout(r, 1000));

  let baseline = null;
  let parallel = null;

  try {
    if (mode === "--baseline" || mode === "--full") {
      baseline = await runBaseline(ws);
    }

    if (mode === "--parallel" || mode === "--full") {
      if (!baseline) {
        // Kurze Baseline für Vergleich
        baseline = await runBaseline(ws);
      }
      parallel = await runParallel(ws);
      await testAbortIsolation(ws);
      // Resume-Test für Alpha
      if (parallel?.alpha?.sessionKey) {
        await testResumeIntegrity(ws, parallel.alpha.sessionKey, "ALPHA");
      }
    }

    if (baseline && parallel) {
      analyzeResults(baseline, parallel);
    }

    // JSON-Report schreiben
    const fs = await import("fs");
    const report = {
      timestamp: new Date().toISOString(),
      baseline,
      parallel: parallel ? {
        alpha: {
          durationMs: (parallel.alpha.completeAt || 0) - parallel.alpha.promptSentAt,
          firstDeltaMs: parallel.alpha.firstDeltaAt ? parallel.alpha.firstDeltaAt - parallel.alpha.promptSentAt : null,
          events: parallel.alpha.events.length,
        },
        beta: {
          durationMs: (parallel.beta.completeAt || 0) - parallel.beta.promptSentAt,
          firstDeltaMs: parallel.beta.firstDeltaAt ? parallel.beta.firstDeltaAt - parallel.beta.promptSentAt : null,
          events: parallel.beta.events.length,
        },
        overlapMs: Math.max(0, Math.min(
          parallel.alpha.completeAt || 0,
          parallel.beta.completeAt || 0
        ) - Math.max(parallel.alpha.promptSentAt, parallel.beta.promptSentAt)),
      } : null,
      allEvents: allEvents.slice(0, 200),
    };

    fs.writeFileSync("council-concurrency-report.json", JSON.stringify(report, null, 2));
    log("Report geschrieben: council-concurrency-report.json");

  } catch (err) {
    log("FEHLER:", err);
    process.exitCode = 1;
  } finally {
    ws.close();
  }
}

main();