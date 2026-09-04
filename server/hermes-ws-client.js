"use strict";

/**
 * Talking to Hermes 0.21, which no longer speaks OpenAI.
 *
 * The adapter was written against `/v1/chat/completions`. That endpoint is
 * gone — Hermes now exposes a JSON-RPC gateway over a WebSocket, and every
 * call the adapter made returned 404. This module is the replacement seam:
 * one function that takes text and gives back text, so the rest of the
 * adapter does not have to know how the sausage is made.
 *
 * The handshake has three details that are each a silent failure if missed,
 * all found the hard way against a live server:
 *
 *   1. The session token goes in the QUERY STRING, not the Authorization
 *      header. `web_server.py` calls the query form "the only auth we have"
 *      in loopback mode.
 *   2. Do not request a subprotocol. The server accepts the upgrade but
 *      echoes no subprotocol back, and `ws` then aborts the connection with
 *      "Server sent no subprotocol".
 *   3. The host must be 127.0.0.1, not localhost. The DNS-rebinding guard
 *      compares against the bound interface and rejects the mismatch with a
 *      403 that explains nothing.
 *
 * A prompt also needs a *gateway* session, which is not the same thing as the
 * sessions `/api/sessions` returns — those are messaging sessions (Telegram
 * chats and the like) and `prompt.submit` rejects them with "session not
 * found". `session.create` is the one that works.
 */

const WebSocket = require("ws");

const HERMES_HOST = process.env.HERMES_HOST || "127.0.0.1";
const HERMES_PORT = process.env.HERMES_PORT || "8642";
const HTTP_BASE = `http://${HERMES_HOST}:${HERMES_PORT}`;
const WS_BASE = `ws://${HERMES_HOST}:${HERMES_PORT}/api/ws`;

/** How long to wait for a full answer before giving up. */
const TURN_TIMEOUT_MS = Number(process.env.HERMES_TURN_TIMEOUT_MS || 180000);

/**
 * The dashboard session token.
 *
 * `web_server.py` reads HERMES_DASHBOARD_SESSION_TOKEN and otherwise mints a
 * random one per boot, embedding it in the SPA it serves. Setting that
 * variable when starting Hermes is the stable way; reading it back out of the
 * page is the fallback that works with a server already running.
 */
let cachedToken = null;

async function resolveToken() {
  if (process.env.HERMES_DASHBOARD_SESSION_TOKEN) {
    return process.env.HERMES_DASHBOARD_SESSION_TOKEN;
  }
  if (cachedToken) return cachedToken;
  const res = await fetch(HTTP_BASE + "/");
  if (!res.ok) throw new Error(`Hermes SPA nicht erreichbar: HTTP ${res.status}`);
  const match = (await res.text()).match(/[A-Za-z0-9_-]{43}/);
  if (!match) throw new Error("Kein Session-Token in der Hermes-Seite gefunden.");
  cachedToken = match[0];
  return cachedToken;
}

/** A live socket plus the gateway session it created, made once and reused. */
let connection = null;

async function connect() {
  if (connection && connection.ws.readyState === WebSocket.OPEN) return connection;

  const token = await resolveToken();
  const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
  const pending = new Map();
  let nextId = 1;

  const conn = {
    ws,
    sessionId: null,
    pending,
    /** Everyone waiting on streamed frames; each filters by session itself. */
    listeners: new Set(),
    call(method, params) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    },
  };

  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });

  ws.on("message", (raw) => {
    let frame;
    try {
      frame = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (frame.id !== undefined && pending.has(frame.id)) {
      const { resolve, reject } = pending.get(frame.id);
      pending.delete(frame.id);
      if (frame.error) reject(new Error(frame.error.message || "Hermes-Fehler"));
      else resolve(frame.result);
      return;
    }
    // Streamed frames arrive wrapped: { method: "event", params: { type, payload } }
    if (frame.method === "event") {
      for (const listener of conn.listeners) listener(frame.params || {});
    }
  });

  const drop = () => {
    for (const { reject } of pending.values()) {
      reject(new Error("Hermes-Verbindung getrennt"));
    }
    pending.clear();
    if (connection === conn) connection = null;
  };
  ws.on("close", drop);
  ws.on("error", drop);

  const created = await conn.call("session.create", {});
  conn.sessionId = created?.session_id ?? created?.id ?? created;
  if (typeof conn.sessionId !== "string") {
    throw new Error("session.create lieferte keine Sitzungs-ID.");
  }

  connection = conn;
  return conn;
}

/**
 * Ask Hermes one question and wait for the whole answer.
 *
 * Streaming exists on the wire, but the adapter's caller wants a finished
 * turn, so the deltas are collected here rather than pushed outward — one
 * less shape for the rest of the adapter to deal with.
 */
async function askHermes(text, options = {}) {
  const conn = await connect();
  const sessionId = options.sessionId || conn.sessionId;

  return new Promise((resolve, reject) => {
    let answer = "";
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      conn.listeners.delete(listener);
      clearTimeout(timer);
      fn(value);
    };

    const listener = (params) => {
      if (params.session_id && params.session_id !== sessionId) return;
      // Checked on every frame rather than on a timer: the caller aborts when
      // the user closes the panel, and the answer should stop arriving then,
      // not up to a tick later. Hermes is told too, so it stops spending.
      if (typeof options.abortCheck === "function" && options.abortCheck()) {
        conn.call("session.interrupt", { session_id: sessionId }).catch(() => {});
        finish(resolve, answer.trim());
        return;
      }
      const payload = params.payload || {};
      switch (params.type) {
        case "message.delta":
        case "agent.token": {
          const piece = payload.text ?? payload.delta ?? payload.token ?? "";
          if (piece) {
            answer += piece;
            // The room shows the answer as it arrives, so a caller that wants
            // the live effect gets each piece; one that just wants the result
            // passes no callback and reads the return value.
            if (typeof options.onDelta === "function") {
              try {
                options.onDelta(piece);
              } catch {
                // A broken listener must not kill the turn it is watching.
              }
            }
          }
          break;
        }
        case "message.complete":
        case "turn.end":
          finish(resolve, (answer || payload.text || "").trim());
          break;
        case "turn.error":
          finish(
            reject,
            new Error(payload.message || payload.text || "Hermes-Turn fehlgeschlagen"),
          );
          break;
        default:
          break;
      }
    };

    const timer = setTimeout(
      () => finish(reject, new Error(`Hermes hat in ${TURN_TIMEOUT_MS} ms nicht geantwortet.`)),
      TURN_TIMEOUT_MS,
    );

    conn.listeners.add(listener);
    conn
      .call("prompt.submit", { session_id: sessionId, text })
      .catch((error) => finish(reject, error));
  });
}

/** An authenticated GET against the Hermes HTTP API, parsed as JSON. */
async function hermesJson(routePath) {
  const token = await resolveToken();
  const res = await fetch(HTTP_BASE + routePath, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Hermes ${routePath}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Every model Hermes could use, as provider-qualified ids.
 *
 * The old `/v1/models` is gone; `/api/model/options` groups models under the
 * providers that offer them, so the flat list the caller expects is built
 * here rather than at each call site.
 */
async function listHermesModels() {
  const payload = await hermesJson("/api/model/options");
  const providers = Array.isArray(payload?.providers) ? payload.providers : [];
  const ids = [];
  for (const provider of providers) {
    for (const model of Array.isArray(provider?.models) ? provider.models : []) {
      if (typeof model === "string" && model.trim()) {
        ids.push(model.includes("/") ? model : `${provider.slug}/${model}`);
      }
    }
  }
  return ids;
}

/**
 * Everything waiting for a decision, across sessions.
 *
 * Hermes keeps approvals in a queue per session — `_gateway_queues` is keyed
 * by session key and every public function takes one, so there is no
 * cross-session listing to call. This walks the active sessions and asks each.
 *
 * Active rather than all: there are 59 sessions on this machine and one round
 * trip each would make a waiting-room indicator more expensive than the work
 * it reports on. A session with nothing running has nothing pending.
 */
async function listPendingApprovals() {
  const conn = await connect();
  let sessions = [];
  try {
    const active = await conn.call("session.active_list", {});
    sessions = Array.isArray(active) ? active : (active?.sessions ?? []);
  } catch {
    // Older gateways may not have it; an empty list is the honest answer
    // rather than falling back to scanning everything.
    sessions = [];
  }

  const waiting = [];
  for (const session of sessions) {
    const sessionId = session?.session_id ?? session?.id;
    if (typeof sessionId !== "string") continue;
    try {
      const result = await conn.call("approval.pending", { session_id: sessionId });
      for (const approval of result?.approvals ?? []) {
        waiting.push({ ...approval, sessionId, sessionTitle: session?.title ?? null });
      }
    } catch {
      // One unreachable session must not hide the others.
    }
  }
  return waiting;
}

/**
 * Answer one waiting approval.
 *
 * `choice` is Hermes' own vocabulary, passed through rather than translated:
 * inventing a friendlier word here would mean guessing what the other side
 * accepts.
 */
async function respondToApproval(sessionId, requestId, choice) {
  const conn = await connect();
  return conn.call("approval.respond", {
    session_id: sessionId,
    request_id: requestId,
    choice,
  });
}

/** Whether Hermes is up, for health checks that should not open a socket. */
async function hermesReachable() {
  try {
    const res = await fetch(HTTP_BASE + "/api/health");
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = {
  askHermes,
  listPendingApprovals,
  respondToApproval,
  listHermesModels,
  hermesJson,
  hermesReachable,
  resolveToken,
  HTTP_BASE,
  WS_BASE,
};
