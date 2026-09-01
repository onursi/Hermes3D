/**
 * Translates the Hermes3D gateway protocol into hermes-agent's JSON-RPC 2.0 API.
 *
 * hermes-agent has no server that speaks the Hermes3D protocol — that protocol
 * came from OpenClaw. Rather than run a separate adapter process, this module
 * presents a virtual upstream to `gateway-proxy.js`: it exposes the small slice
 * of the `ws` WebSocket surface the proxy actually uses (`readyState`, `send`,
 * `close`, `terminate`, and the open/message/close/error events), so the proxy's
 * connect handling and lifecycle stay untouched.
 *
 * Hermes3D talks in agents and session keys; hermes-agent talks in runtime
 * session ids. A hermes-agent backend is a single agent, so the fleet is
 * synthesised as one entry and session keys are mapped onto runtime sessions
 * that are created or resumed on first use.
 */

const { EventEmitter } = require("node:events");
const { randomUUID, createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { HermesAgentJsonRpcClient, redactUrl } = require("./jsonrpc-client");
const { createOfficeSpeechSubscriber } = require("./office-speech");
const { classifyMessage, isReroute } = require("./frontdoor-router");
const { resolveStateDir } = require("../studio-settings");
const {
  KANBAN_TASK_ID_PREFIX,
  toHermes3dKanbanTaskRecord,
  toHermes3dKanbanTasks,
  toKanbanPatchBody,
  kanbanRequest,
} = require("./kanban");

/** Mirrors the numeric WebSocket readyState constants the proxy compares against. */
const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

const AGENT_ID = "hermes";
const AGENT_NAME = "Hermes";
const MAIN_KEY = "main";
const MAIN_SESSION_KEY = `agent:${AGENT_ID}:${MAIN_KEY}`;

/** hermes-agent's `session.create` / `session.resume` can be slow on a cold profile. */
const SESSION_RPC_TIMEOUT_MS = 60_000;

/**
 * The slice of the `ws` WebSocket surface `gateway-proxy.js` relies on.
 *
 * @typedef {import("node:events").EventEmitter & {
 *   readyState: number,
 *   send: (raw: string) => void,
 *   close: (code?: number, reason?: string) => void,
 *   terminate: () => void,
 * }} HermesAgentUpstream
 */

const resOk = (id, payload) => ({ type: "res", id, ok: true, payload: payload ?? {} });
const resErr = (id, code, message) => ({ type: "res", id, ok: false, error: { code, message } });

const asString = (value, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const errorMessage = (err) => {
  if (!err) return "hermes-agent request failed";
  if (typeof err === "string") return err;
  return err.message || String(err);
};

/** hermes-agent history rows use `text`; Hermes3D expects `content`. */
const toHermes3dMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({
      role: m.role,
      content: typeof m.text === "string" ? m.text : String(m.content ?? ""),
    }));
};

const parseTimestampMs = (value) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const DURATION_UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * hermes-agent stores a schedule as one string; Hermes3D wants a tagged union.
 *
 * The string is a 5-field cron expression, a duration such as "30m", or an ISO
 * timestamp for a one-shot job.
 */
const toHermes3dSchedule = (raw) => {
  const value = asString(raw);
  if (!value) return { kind: "cron", expr: "" };

  const duration = /^every\s+(\d+)\s*([smhd])$/i.exec(value) || /^(\d+)\s*([smhd])$/i.exec(value);
  if (duration) {
    const unit = DURATION_UNIT_MS[duration[2].toLowerCase()];
    if (unit) return { kind: "every", everyMs: Number(duration[1]) * unit };
  }

  if (value.split(/\s+/).length === 5) return { kind: "cron", expr: value };

  const at = parseTimestampMs(value);
  if (at !== undefined) return { kind: "at", at: value };

  return { kind: "cron", expr: value };
};

const CRON_STATUSES = new Set(["ok", "error", "skipped"]);

/**
 * Translate hermes-agent cron rows into Hermes3D's `CronJobSummary`.
 *
 * The two shapes disagree on nearly every field: hermes-agent uses `job_id`, a
 * schedule string, `prompt_preview`, ISO timestamps, and a `state` *string*,
 * while Hermes3D expects `id`, a schedule object, a `payload` object, epoch
 * milliseconds, and a `state` object. Forwarding the raw rows crashes the
 * office task board, which reads `job.payload.kind` unguarded.
 */
const toHermes3dCronJobs = (jobs, agentId = AGENT_ID) => {
  if (!Array.isArray(jobs)) return [];
  return jobs
    .filter((job) => job && typeof job === "object")
    .map((job) => {
      const nextRunAtMs = parseTimestampMs(job.next_run_at);
      const lastRunAtMs = parseTimestampMs(job.last_run_at);
      const lastStatus = asString(job.last_status).toLowerCase();
      const lastError = asString(job.last_fire_error) || asString(job.last_delivery_error);
      const message =
        asString(job.prompt_preview) || asString(job.name) || "Scheduled job";

      return {
        id: asString(job.job_id) || asString(job.id),
        name: asString(job.name) || asString(job.job_id) || "Scheduled job",
        agentId,
        description: asString(job.prompt_preview) || undefined,
        enabled: job.enabled !== false,
        updatedAtMs: lastRunAtMs ?? nextRunAtMs ?? Date.now(),
        schedule: toHermes3dSchedule(job.schedule),
        sessionTarget: "isolated",
        wakeMode: "next-heartbeat",
        payload: { kind: "agentTurn", message },
        state: {
          ...(nextRunAtMs !== undefined ? { nextRunAtMs } : {}),
          ...(lastRunAtMs !== undefined ? { lastRunAtMs } : {}),
          ...(asString(job.state).toLowerCase() === "running"
            ? { runningAtMs: Date.now() }
            : {}),
          ...(CRON_STATUSES.has(lastStatus) ? { lastStatus } : {}),
          ...(lastError ? { lastError } : {}),
        },
        delivery: { mode: asString(job.deliver) && job.deliver !== "none" ? "announce" : "none" },
      };
    })
    .filter((job) => job.id);
};

/** Used when the backend predates `profiles.list` or the call fails. */
const fallbackAgent = () => ({
  id: AGENT_ID,
  name: AGENT_NAME,
  workspace: "",
  identity: { name: AGENT_NAME, emoji: "🤖" },
  role: "",
  profile: "",
});

/** Title-case a profile directory name for display ("allan" -> "Allan"). */
const toDisplayName = (name) =>
  name ? name.charAt(0).toUpperCase() + name.slice(1) : "";

/**
 * Turn hermes-agent's profile list into Hermes3D agents.
 *
 * A profile is the backend's unit of identity — its own model, skills, memory
 * and sessions — which is exactly what Hermes3D calls an agent. Collapsing them
 * into one entry hides the operator's whole fleet, so each profile gets a desk.
 *
 * The `profile` field is what routes sessions back; the default profile carries
 * an empty string because omitting `profile` means "launch profile" upstream.
 */
const toHermes3dAgents = (profiles) => {
  if (!Array.isArray(profiles)) return [];
  const agents = profiles
    .filter((p) => p && typeof p === "object" && asString(p.name))
    .map((p) => {
      const name = asString(p.name);
      const isDefault = p.is_default === true;
      const display = asString(p.display_name) || toDisplayName(name);
      // The long profile descriptions read as a role ("Allan — technical
      // planner…"); keep the part after the dash so the desk label stays short.
      const description = asString(p.description);
      const role = description.includes("—")
        ? description.split("—").slice(1).join("—").trim()
        : description;
      return {
        id: name,
        name: display,
        workspace: asString(p.path),
        identity: { name: display, emoji: isDefault ? "🤖" : "🧑‍💻" },
        role,
        model: asString(p.model),
        isDefault,
        profile: isDefault ? "" : name,
      };
    });
  return agents;
};

const resolveDefaultAgentId = (agents) => {
  const explicit = agents.find((a) => a.isDefault);
  return explicit?.id ?? agents[0]?.id ?? AGENT_ID;
};

/**
 * Resolve the Frontdoor Router's classified target against the CURRENT
 * agentRoster, so a routing decision never silently falls back to the
 * launch/default profile while the emitted events still claim a specialist
 * handled it (Codex review finding, 2026-08-31). frontdoor-router.js
 * classifies against a fixed, hard-coded profile-name vocabulary —
 * including the literal string "default" as its own sentinel for "stay on
 * whatever the default agent is" — and has no visibility into the live
 * roster, so both "unknown target" and "the real default agent's id isn't
 * literally 'default'" have to be resolved here, where the roster is
 * actually known.
 *
 * Fallback order, each step checked against the live roster:
 *   1. the classifier's target, with the "default" sentinel remapped to
 *      the real defaultAgentId FIRST — remapping has to happen before this
 *      is looked up, not after, or a roster that happens to contain a real
 *      profile literally named "default" (an unrelated specialist, not the
 *      operator's actual default agent) would match the raw sentinel on
 *      this very step and silently reroute complex/unclear and MoA
 *      requests there instead of keeping them on the real default (Codex
 *      review finding, P2, 2026-09-01)
 *   2. callerAgentId (the frontdoor's own agent — effectively "don't
 *      reroute")
 *   3. defaultAgentId again (covers callerAgentId itself having dropped
 *      out of a stale roster)
 *   4. the first agent actually in agentRoster (guaranteed non-empty in
 *      the running bridge — see fallbackAgent() — but callers with a
 *      genuinely empty roster still get a safe, non-throwing result)
 *
 * Pure function of its inputs (no closure state) so it can be exercised
 * directly in tests without standing up the whole bridge.
 */
const resolveRoutingTarget = (agentRoster, defaultAgentId, requestedAgentId, callerAgentId) => {
  const resolvedRequestedId = requestedAgentId === "default" ? defaultAgentId : requestedAgentId;
  const candidates = [resolvedRequestedId, callerAgentId, defaultAgentId, agentRoster[0]?.id];
  for (const candidateId of candidates) {
    if (!candidateId) continue;
    const agent = agentRoster.find((a) => a.id === candidateId);
    if (agent) {
      return {
        targetAgentId: agent.id,
        targetProfile: asString(agent.profile),
        targetModel: asString(agent.model),
      };
    }
  }
  // agentRoster is never empty in practice (fallbackAgent() seeds it), but
  // stay safe rather than throw mid-routing if it somehow were.
  return { targetAgentId: callerAgentId, targetProfile: "", targetModel: "" };
};

/**
 * Recovering a routed turn from the caller's own conversation.
 *
 * A routed chat.send runs on a throwaway, per-run specialist session (see the
 * "Frontdoor Router" block in chat.send below) so it never mixes into the
 * user's own direct conversation with that specialist. That session is never
 * revisited, so the exchange it produced would otherwise exist nowhere the
 * caller's own chat.history could find it again once this bridge instance is
 * gone — e.g. after a page reload spins up a brand new one with empty
 * in-memory maps (Codex review finding, 2026-08-31).
 *
 * The fix is a small on-disk ledger, one entry per Hermes3D sessionKey, of
 * the turns that make up that conversation in order:
 *   - { kind: "routed", targetAgentId, runtimeId, completedAtMs } — the
 *     turn ran on a specialist's session; its 2 messages live there.
 *   - { kind: "own", count } — the next `count` messages (2, unless this is
 *     a one-time catch-up entry — see recordCompletedTurn) come from the
 *     caller's own session, in the order session.history already returns
 *     them.
 * The ledger is written to ONLY for sessionKeys that have routed through it
 * at least once — an ordinary, never-routed conversation touches none of
 * this and behaves exactly as before.
 *
 * On disk each sessionKey maps to `{ turns, droppedOwnCount }`, not a bare
 * turns array: once `turns` is truncated to the cap (see
 * appendRoutedTurnLedgerEntry), the OWN messages any dropped "own" turns
 * had already accounted for must still be skipped when replaying what
 * remains, or mergeRoutedTurnLedger pairs the retained turns with the
 * WRONG (too-early) own messages — duplicating and misordering history for
 * long routed conversations (Codex review finding, P2, 2026-08-31).
 * `droppedOwnCount` carries that forward. A ledger file written before this
 * fix (or corrupted some other way) is a bare array or garbage, not this
 * shape — normalizeLedgerState treats anything that isn't already
 * `{ turns: Turn[], droppedOwnCount: number }` as a droppedOwnCount-0 ledger
 * (a bare array of turns, or empty) rather than erroring.
 */
/** Bounds ledger growth and, with it, how many extra session.history calls a single chat.history request can fan out into. */
const MAX_LEDGER_ENTRIES_PER_SESSION = 200;

/**
 * A short, filesystem-safe, stable identifier for one upstream hermes-agent
 * backend, derived from its URL. Studio can point at a different backend at
 * any time (switching gateway URL in settings); a Hermes3D sessionKey like
 * "agent:default:main" means something different on each one, so their
 * ledgers must never share a file — the same key on a different backend
 * could otherwise resume the WRONG backend's session, or fail confusingly,
 * with a stale storedId that only ever belonged elsewhere (Codex review
 * finding, P1, 2026-09-01).
 */
const resolveBackendId = (url) => createHash("sha256").update(asString(url)).digest("hex").slice(0, 16);

const resolveRoutedTurnsPath = (backendId, env = process.env) =>
  path.join(resolveStateDir(env), "hermes3d", `routed-turns.${backendId}.json`);

/** A missing or corrupt ledger file is "no ledger yet", not an error — it's a recovery aid, not a source of truth. */
const loadRoutedTurnsIndex = (filePath) => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/**
 * Persistence failures must not be silently swallowed (Codex review
 * finding, P2) — this throws so the caller (recordCompletedTurn, then
 * message.complete below) can log it loudly via logError and the client can
 * eventually notice chat.history came back incomplete, instead of the
 * write vanishing with only a soft log line no one is watching.
 */
const saveRoutedTurnsIndex = (filePath, index) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(index, null, 2));
};

/**
 * Normalize one sessionKey's stored ledger value into `{ turns,
 * droppedOwnCount }`, defensively — see the doc comment above. Never throws.
 */
const normalizeLedgerState = (raw) => {
  if (Array.isArray(raw)) return { turns: raw, droppedOwnCount: 0, ownStoredId: "" };
  if (raw && typeof raw === "object" && Array.isArray(raw.turns)) {
    const droppedOwnCount =
      typeof raw.droppedOwnCount === "number" && raw.droppedOwnCount >= 0 ? raw.droppedOwnCount : 0;
    const ownStoredId = typeof raw.ownStoredId === "string" ? raw.ownStoredId : "";
    return { turns: raw.turns, droppedOwnCount, ownStoredId };
  }
  return { turns: [], droppedOwnCount: 0, ownStoredId: "" };
};

/** How many own (caller-session) messages one ledger turn accounts for — 0 for a routed turn. */
const ownMessageWeight = (turn) => {
  if (turn?.kind !== "own") return 0;
  return typeof turn.count === "number" && turn.count > 0 ? turn.count : 2;
};

/**
 * Pure: returns a new index with `entry` appended for `sessionKey`. Once the
 * turns list exceeds the cap, the oldest turns are dropped from the front
 * and their own-message weight (see ownMessageWeight) is folded into
 * `droppedOwnCount` so mergeRoutedTurnLedger can pick up exactly where the
 * pruned turns left off instead of replaying from the start of ownMessages.
 */
const appendRoutedTurnLedgerEntry = (index, sessionKey, entry) => {
  const existing = normalizeLedgerState(index[sessionKey]);
  const turns = [...existing.turns, entry];
  let droppedOwnCount = existing.droppedOwnCount;
  while (turns.length > MAX_LEDGER_ENTRIES_PER_SESSION) {
    droppedOwnCount += ownMessageWeight(turns.shift());
  }
  return { ...index, [sessionKey]: { turns, droppedOwnCount, ownStoredId: existing.ownStoredId } };
};

/**
 * Pure: returns a new index with `sessionKey`'s ownStoredId set — the
 * durable id of the CALLER's own (non-routed) session, so chat.history can
 * resume it, not just find it missing, after a reload replaces this
 * bridge's in-memory `sessions` map (Codex review finding, P1, 2026-09-01:
 * without this, a conversation mixing routed and own turns silently lost
 * every "own" turn on reload — the ledger recovered the routed ones via
 * their own storedId, but had no durable way to recover the caller's own
 * side of the conversation at all). A no-op if the ledger for this
 * sessionKey doesn't exist yet — same scoping as everything else here: only
 * conversations that have actually routed at least once are tracked.
 */
const setOwnStoredId = (index, sessionKey, storedId) => {
  const existing = normalizeLedgerState(index[sessionKey]);
  if (existing.turns.length === 0 || existing.ownStoredId === storedId) return index;
  return { ...index, [sessionKey]: { ...existing, ownStoredId: storedId } };
};

/**
 * Pure: returns a new index with `sessionKey`'s ledger entirely removed.
 * sessions.reset discards a conversation and its backing hermes-agent
 * session outright — the ledger must forget it too, or the FIRST
 * chat.history/recordCompletedTurn call for that same sessionKey afterward
 * would resume the just-discarded conversation's ownStoredId and mix its
 * old routed turns into the new one (Codex review finding, P1,
 * 2026-09-01). A no-op if there's nothing to remove.
 */
const removeLedgerEntry = (index, sessionKey) => {
  if (!(sessionKey in index)) return index;
  const next = { ...index };
  delete next[sessionKey];
  return next;
};

/**
 * Reassemble the full, ordered transcript for one sessionKey from its own
 * history plus its routed-turn ledger. `ledgerState` accepts either the
 * `{ turns, droppedOwnCount }` shape or a bare turns array (normalized the
 * same defensive way as a stored one), so existing callers/tests that only
 * ever dealt with a plain array keep working unchanged.
 * `fetchRoutedMessages(storedId, targetAgentId)` resolves the 2 messages a
 * routed ledger entry's specialist session holds; injected so this stays
 * testable without a live client. `storedId` (not a connection-scoped
 * runtime session_id — see recordCompletedTurn's doc comment) is the only
 * identifier a routed ledger entry keeps, since it must still resolve after
 * this bridge's own hermes-agent connection has been replaced by a new one.
 */
const mergeRoutedTurnLedger = async (ledgerState, ownMessages, fetchRoutedMessages) => {
  const { turns, droppedOwnCount } = normalizeLedgerState(ledgerState);
  const merged = [];
  // Turns pruned off the front by capping already accounted for this many
  // own messages — skip straight past them instead of re-pairing retained
  // turns with messages that belong to a turn that's no longer in the list.
  let ownCursor = Math.min(droppedOwnCount, ownMessages.length);
  for (const turn of turns) {
    if (turn?.kind === "routed" && turn.storedId) {
      merged.push(...(await fetchRoutedMessages(turn.storedId, turn.targetAgentId)));
      continue;
    }
    if (turn?.kind === "own") {
      const count = ownMessageWeight(turn);
      const slice = ownMessages.slice(ownCursor, ownCursor + count);
      merged.push(...slice);
      ownCursor += slice.length;
    }
  }
  // Anything left over predates ledger tracking for this sessionKey (it was
  // never given an entry) — keep it rather than drop it, tacked on after
  // the reconstructed portion.
  if (ownCursor < ownMessages.length) merged.push(...ownMessages.slice(ownCursor));
  return merged;
};

function createHermesAgentUpstream(options) {
  const {
    url,
    token,
    handshakeTimeoutMs,
    log = () => {},
    logError = () => {},
  } = options || {};

  const upstream = /** @type {HermesAgentUpstream} */ (new EventEmitter());
  upstream.readyState = CONNECTING;

  let client;
  try {
    client = new HermesAgentJsonRpcClient({ url, token, handshakeTimeoutMs, log });
  } catch (err) {
    // Defer so the caller can attach listeners before the failure lands.
    setImmediate(() => upstream.emit("error", err));
    upstream.readyState = CLOSED;
    upstream.send = () => {};
    upstream.close = () => {};
    upstream.terminate = () => {};
    return upstream;
  }

  /** sessionKey -> { runtimeId, storedId, title } */
  const sessions = new Map();
  /** runtime session id -> sessionKey */
  const sessionKeyByRuntimeId = new Map();
  /**
   * Hermes3D agents, one per hermes-agent profile.
   *
   * Profiles are the backend's fleet: each is a fully isolated instance with
   * its own model, skills, memory, and session store. Resolved once at connect
   * because the set only changes when the operator creates or deletes one.
   */
  let agentRoster = [fallbackAgent()];
  let defaultAgentId = AGENT_ID;
  /** Optional feed of turns driven from other clients; see ./office-speech.js. */
  let officeSpeech = null;
  /** runId -> { sessionKey, runtimeId, buffer, aborted } */
  const activeRuns = new Map();
  /** sessionKey -> runId, so session-scoped events find their run. */
  const runBySessionKey = new Map();
  /**
   * Frontdoor Router: runId -> in-flight routing decision, so the
   * "message.complete"/"error" handler can close the loop with
   * routing.completed / routing.failed once the (possibly rerouted) reply
   * lands. Populated only for chat.send calls that went through the
   * frontdoor classifier (see frontdoor-router.js); absent for direct
   * clicks on a non-Default agent card.
   */
  const pendingRoutingByRunId = new Map();

  let seq = 0;
  let closed = false;

  const emitFrame = (frame) => {
    if (closed) return;
    upstream.emit("message", JSON.stringify(frame));
  };

  const emitEvent = (event, payload) => {
    emitFrame({ type: "event", event, seq: seq++, payload });
  };

  const emitChat = (runId, sessionKey, state, extra) => {
    emitEvent("chat", { runId, sessionKey, state, ...extra });
  };

  // --- session mapping ------------------------------------------------------

  const rememberSession = (sessionKey, result) => {
    const runtimeId = asString(result?.session_id);
    if (!runtimeId) throw new Error("hermes-agent did not return a session id.");
    const entry = {
      runtimeId,
      storedId: asString(result?.stored_session_id) || asString(result?.session_key),
      title: asString(result?.info?.title) || asString(result?.title),
    };
    sessions.set(sessionKey, entry);
    sessionKeyByRuntimeId.set(runtimeId, sessionKey);
    return entry;
  };

  /**
   * Split `agent:<agentId>:<tail>` into the agent and the stored session id.
   */
  const parseSessionKey = (sessionKey) => {
    const parts = String(sessionKey ?? "").split(":");
    if (parts[0] !== "agent" || parts.length < 3) {
      return { agentId: defaultAgentId, tail: "" };
    }
    return { agentId: parts[1] || defaultAgentId, tail: parts.slice(2).join(":") };
  };

  /**
   * The `profile` value to send upstream for an agent.
   *
   * Empty means "the launch profile", which is what hermes-agent expects for
   * the default; naming it explicitly is unnecessary and, for a backend with no
   * profiles at all, would be rejected.
   */
  const profileForAgent = (agentId) => {
    const agent = agentRoster.find((a) => a.id === agentId);
    return agent ? asString(agent.profile) : "";
  };

  /** Main session of whichever agent is default; the roster is known only at runtime. */
  const defaultMainKey = () => `agent:${defaultAgentId}:${MAIN_KEY}`;

  /**
   * Resolve the runtime session backing a Hermes3D session key, creating or
   * resuming one on hermes-agent the first time the key is used.
   *
   * The agent segment of the key selects the profile, so a prompt sent to
   * `agent:allan:main` runs with Allan's model, skills, and session store.
   */
  const ensureSession = async (sessionKey) => {
    const existing = sessions.get(sessionKey);
    if (existing?.runtimeId) return existing;

    const { agentId, tail } = parseSessionKey(sessionKey);
    const profile = profileForAgent(agentId);
    const scope = profile ? { profile } : {};

    // A key of the form `agent:<id>:<storedId>` refers to a stored hermes-agent
    // session; anything else starts a fresh one.
    if (tail && tail !== MAIN_KEY) {
      try {
        const resumed = await client.request(
          "session.resume",
          { session_id: tail, omit_messages: false, ...scope },
          SESSION_RPC_TIMEOUT_MS
        );
        return rememberSession(sessionKey, resumed);
      } catch (err) {
        log(`[hermes-agent] resume of "${tail}" failed, creating a new session: ${errorMessage(err)}`);
      }
    }

    const created = await client.request("session.create", scope, SESSION_RPC_TIMEOUT_MS);
    log(`[hermes-agent] session for "${sessionKey}" -> profile "${profile || "(default)"}"`);
    return rememberSession(sessionKey, created);
  };

  // --- routed-turn recovery ledger ------------------------------------------

  const routedTurnsPath = resolveRoutedTurnsPath(resolveBackendId(url));
  const getRoutedTurnLedgerState = (sessionKey) => {
    const index = loadRoutedTurnsIndex(routedTurnsPath);
    return normalizeLedgerState(index[sessionKey]);
  };
  /** Throws on a genuine write failure — see saveRoutedTurnsIndex's doc comment. */
  const persistLedgerTurn = (sessionKey, entry) => {
    const nextIndex = appendRoutedTurnLedgerEntry(loadRoutedTurnsIndex(routedTurnsPath), sessionKey, entry);
    saveRoutedTurnsIndex(routedTurnsPath, nextIndex);
  };
  /** Keeps the caller's own durable session id fresh — see setOwnStoredId's doc comment. */
  const persistOwnStoredId = (sessionKey, storedId) => {
    const currentIndex = loadRoutedTurnsIndex(routedTurnsPath);
    const nextIndex = setOwnStoredId(currentIndex, sessionKey, storedId);
    if (nextIndex !== currentIndex) saveRoutedTurnsIndex(routedTurnsPath, nextIndex);
  };
  /** Forgets sessionKey's ledger entirely — see removeLedgerEntry's doc comment. */
  const clearLedger = (sessionKey) => {
    const currentIndex = loadRoutedTurnsIndex(routedTurnsPath);
    const nextIndex = removeLedgerEntry(currentIndex, sessionKey);
    if (nextIndex !== currentIndex) saveRoutedTurnsIndex(routedTurnsPath, nextIndex);
  };

  /**
   * Read a routed ledger entry's specialist session back by its DURABLE
   * `storedId`, on whatever hermes-agent connection this bridge instance
   * currently has — never by a bare `session_id` from a previous
   * connection, which 404s with "session not found" once that connection
   * is gone (confirmed against the real gateway across a page reload).
   * Reuses the same session.resume the rest of the bridge already relies on
   * to reopen a stored Hermes3D session (see ensureSession above) rather
   * than inventing a second resume path.
   *
   * `omit_messages: false` asks hermes-agent to include the transcript in
   * the resume response itself, avoiding a second RPC most of the time;
   * still falls back to an explicit session.history call for a backend
   * that resumes without including it.
   */
  const fetchStoredSessionMessages = async (storedId, targetAgentId) => {
    const profile = profileForAgent(targetAgentId);
    const scope = profile ? { profile } : {};
    const resumed = await client.request(
      "session.resume",
      { session_id: storedId, omit_messages: false, ...scope },
      SESSION_RPC_TIMEOUT_MS
    );
    const fromResume = toHermes3dMessages(resumed?.messages);
    if (fromResume.length > 0) return fromResume;
    const freshRuntimeId = asString(resumed?.session_id);
    if (!freshRuntimeId) return [];
    const history = await client.request("session.history", { session_id: freshRuntimeId });
    return toHermes3dMessages(history?.messages);
  };

  /**
   * Record one successfully-completed turn (routed or not) into the ledger —
   * see the doc comment above appendRoutedTurnLedgerEntry.
   *
   * Awaited from the "ok" branch of message.complete below, BEFORE
   * routing.completed is emitted (Codex review finding, P2, 2026-08-31): a
   * client that reacts to routing.completed by immediately refreshing
   * chat.history — or reloading — must be able to already find this turn
   * in the ledger, not race a fire-and-forget write. It still runs strictly
   * after the live chat "final" event and the presence update above it in
   * that branch, so it can never add latency to the actual streamed reply.
   *
   * The one-time "seed the ledger with prior own history" lookup below
   * tolerates its own session.history call failing (best-effort enrichment,
   * not this turn's own persistence) — but a failure to persist THIS turn's
   * ledger entry is allowed to throw, on purpose, so it isn't swallowed.
   */
  const recordCompletedTurn = async (sessionKey, routing, storedId) => {
    // `routing` is set for EVERY frontdoor-classified turn, not just actual
    // reroutes — a classification that keeps the request on Default (e.g.
    // "complex/unclear" or MoA input) still sets it, but the session there
    // is the caller's OWN session, not a separate specialist one. Recording
    // that as a "routed" ledger entry would make chat.history re-fetch and
    // duplicate the caller's own history on every such turn (Codex review
    // finding, P1, 2026-09-01) — only routing.wasRerouted turns actually
    // ran on a distinct, otherwise-unreachable specialist session.
    if (routing?.wasRerouted) {
      // First time this conversation is ever routed: if the caller already
      // had its own history, catch the ledger up on it first so those
      // earlier turns keep their place ahead of this routed one instead of
      // being pushed to the end by mergeRoutedTurnLedger's leftover-
      // messages fallback.
      if (getRoutedTurnLedgerState(sessionKey).turns.length === 0) {
        const ownEntry = sessions.get(sessionKey);
        if (ownEntry?.runtimeId) {
          const priorHistory = await client
            .request("session.history", { session_id: ownEntry.runtimeId })
            .catch(() => null);
          const priorCount = toHermes3dMessages(priorHistory?.messages).length;
          if (priorCount > 0) {
            persistLedgerTurn(sessionKey, { kind: "own", count: priorCount });
          }
        }
      }
      // Store the DURABLE stored id, not the connection-scoped runtime one
      // — confirmed live against the real gateway: a runtime session_id
      // stops resolving once ITS hermes-agent JSON-RPC connection closes
      // (session.history then 404s with "session not found"), which a page
      // reload always does. storedId survives that; chat.history below
      // re-opens it with session.resume before reading it.
      if (!storedId) {
        throw new Error("Routed turn has no stored session id to persist.");
      }
      persistLedgerTurn(sessionKey, {
        kind: "routed",
        targetAgentId: routing.targetAgentId,
        storedId,
        completedAtMs: Date.now(),
      });
    } else if (getRoutedTurnLedgerState(sessionKey).turns.length > 0) {
      // Own turn — either never went through the frontdoor at all, or went
      // through it but stayed on Default. Only conversations that have
      // actually rerouted at least once are tracked going forward; an
      // ordinary conversation never touches the ledger file at all.
      persistLedgerTurn(sessionKey, { kind: "own", count: 2 });
    }

    // Keep the caller's own durable session id fresh whenever this
    // sessionKey's ledger is active, regardless of whether THIS particular
    // turn was routed or own — chat.history needs it to resume (not lose)
    // the caller's own turns after a reload (Codex review finding, P1,
    // 2026-09-01).
    if (getRoutedTurnLedgerState(sessionKey).turns.length > 0) {
      const ownEntry = sessions.get(sessionKey);
      if (ownEntry?.storedId) persistOwnStoredId(sessionKey, ownEntry.storedId);
    }
  };

  // --- upstream event fan-out ----------------------------------------------

  client.on("event", async (type, runtimeSessionId, payload) => {
    const sessionKey = sessionKeyByRuntimeId.get(runtimeSessionId);
    if (!sessionKey) return;
    const runId = runBySessionKey.get(sessionKey);
    const run = runId ? activeRuns.get(runId) : null;

    switch (type) {
      case "message.start":
        if (run) run.buffer = "";
        return;

      case "message.delta": {
        if (!run || run.aborted) return;
        const text = typeof payload?.text === "string" ? payload.text : "";
        if (!text) return;
        run.buffer += text;
        emitChat(runId, sessionKey, "delta", {
          message: { role: "assistant", content: run.buffer },
        });
        return;
      }

      case "message.complete": {
        if (!run) return;
        const finalText =
          typeof payload?.text === "string" && payload.text ? payload.text : run.buffer;
        const routing = pendingRoutingByRunId.get(runId) || null;
        const closeRouting = (status, extra) => {
          if (!routing) return;
          const endedAtMs = Date.now();
          emitEvent(status === "ok" ? "routing.completed" : "routing.failed", {
            runId,
            sessionKey,
            category: routing.category,
            targetAgentId: routing.targetAgentId,
            targetProfile: routing.targetProfile,
            targetModel: routing.targetModel,
            reason: routing.reason,
            startedAtMs: routing.startedAtMs,
            endedAtMs,
            durationMs: endedAtMs - routing.startedAtMs,
            status,
            ...extra,
          });
          pendingRoutingByRunId.delete(runId);
        };

        // Delete this run's bookkeeping up front so a duplicate/re-delivered
        // message.complete for the same runId is a safe no-op next time
        // (the `if (!run) return;` above catches it) instead of
        // double-recording this turn into the routed-turn ledger while
        // recordCompletedTurn below is still being awaited.
        activeRuns.delete(runId);
        runBySessionKey.delete(sessionKey);

        if (run.aborted) {
          emitChat(runId, sessionKey, "aborted", {});
          closeRouting("aborted", {});
        } else if (payload?.status === "error" || payload?.error) {
          const errMsg = asString(payload?.error, "hermes-agent reported an error");
          emitChat(runId, sessionKey, "error", { errorMessage: errMsg });
          closeRouting("error", { errorMessage: errMsg });
        } else {
          emitChat(runId, sessionKey, "final", {
            stopReason: "end_turn",
            message: { role: "assistant", content: finalText },
          });
          emitEvent("presence", {
            sessions: {
              recent: [{ key: sessionKey, updatedAt: Date.now() }],
              byAgent: [
                {
                  agentId: parseSessionKey(sessionKey).agentId,
                  recent: [{ key: sessionKey, updatedAt: Date.now() }],
                },
              ],
            },
          });
          // Persisted BEFORE routing.completed goes out below — a client
          // that reacts to that event by refreshing chat.history (or by a
          // reload racing it) must already be able to find this turn in
          // the ledger. Never delays the live "final" chat event or the
          // presence update above, only the routing-status event after it.
          try {
            await recordCompletedTurn(sessionKey, routing, run.storedId);
            // Durably recorded — the throwaway specialist session's LOCAL
            // bookkeeping is no longer needed by this bridge instance; drop
            // it so a long-running bridge doesn't accumulate one live
            // session per routed message forever, and so `status`'s
            // `recent` list stops listing it (Codex review finding, P2,
            // 2026-09-01). Never closed upstream — it must stay resumable
            // by its storedId for chat.history later. Only cleaned up
            // AFTER a successful persist: if that threw, the session is
            // still the only place this turn's content exists.
            if (routing?.wasRerouted && run.targetSessionKey && run.targetSessionKey !== sessionKey) {
              const targetEntry = sessions.get(run.targetSessionKey);
              if (targetEntry?.runtimeId) sessionKeyByRuntimeId.delete(targetEntry.runtimeId);
              sessions.delete(run.targetSessionKey);
            }
          } catch (err) {
            logError(`[hermes-agent] routed-turn ledger update failed for run "${runId}".`, err);
          }
          closeRouting("ok", {});
        }
        return;
      }

      case "tool.start":
        if (!run) return;
        emitEvent("agent", {
          runId,
          sessionKey,
          stream: "tool",
          data: { phase: "start", name: asString(payload?.name), text: asString(payload?.context) },
        });
        return;

      case "tool.complete":
        if (!run) return;
        emitEvent("agent", {
          runId,
          sessionKey,
          stream: "tool",
          data: { phase: "complete", name: asString(payload?.name), text: asString(payload?.summary) },
        });
        return;

      case "reasoning.delta":
      case "thinking.delta":
        if (!run) return;
        emitEvent("agent", {
          runId,
          sessionKey,
          stream: "reasoning",
          data: { phase: "delta", text: typeof payload?.text === "string" ? payload.text : "" },
        });
        return;

      case "status.update":
        if (!run) return;
        emitEvent("agent", {
          runId,
          sessionKey,
          stream: "lifecycle",
          data: { phase: asString(payload?.kind, "status"), text: asString(payload?.text) },
        });
        return;

      case "approval.request":
        emitEvent("exec.approval.requested", {
          id: asString(payload?.request_id),
          request: { command: asString(payload?.command), cwd: asString(payload?.cwd) },
          createdAtMs: Date.now(),
          expiresAtMs: Date.now() + 120_000,
        });
        return;

      case "error": {
        if (!run) return;
        const errMsg = asString(payload?.message, "hermes-agent reported an error");
        emitChat(runId, sessionKey, "error", { errorMessage: errMsg });
        const routing = pendingRoutingByRunId.get(runId);
        if (routing) {
          const endedAtMs = Date.now();
          emitEvent("routing.failed", {
            runId,
            sessionKey,
            category: routing.category,
            targetAgentId: routing.targetAgentId,
            targetProfile: routing.targetProfile,
            targetModel: routing.targetModel,
            reason: routing.reason,
            startedAtMs: routing.startedAtMs,
            endedAtMs,
            durationMs: endedAtMs - routing.startedAtMs,
            status: "error",
            errorMessage: errMsg,
          });
          pendingRoutingByRunId.delete(runId);
        }
        activeRuns.delete(runId);
        runBySessionKey.delete(sessionKey);
        return;
      }

      default:
    }
  });

  // --- method dispatch ------------------------------------------------------

  /** Load the fleet once per connection; a backend without profiles keeps one agent. */
  const loadAgentRoster = async () => {
    try {
      const result = await client.request("profiles.list", {}, SESSION_RPC_TIMEOUT_MS);
      const mapped = toHermes3dAgents(result?.profiles);
      if (mapped.length > 0) {
        agentRoster = mapped;
        defaultAgentId = resolveDefaultAgentId(mapped);
        log(`[hermes-agent] ${mapped.length} profile(s) mapped to agents: ${mapped.map((a) => a.id).join(", ")}`);
        return;
      }
      log("[hermes-agent] profiles.list returned nothing; using a single agent");
    } catch (err) {
      log(`[hermes-agent] profiles.list unavailable (${errorMessage(err)}); using a single agent`);
    }
  };

  /**
   * Relay a turn published by the office bridge plugin.
   *
   * The plugin names the profile that spoke, and Hermes3D names each agent
   * after its profile, so the two line up directly. A turn from a profile this
   * connection does not know about is dropped rather than guessed at.
   */
  const handlePublishedTurn = (turn) => {
    const agent = agentRoster.find((a) => a.id === turn.profile);
    if (!agent) {
      log(`[office-speech] no agent for profile "${turn.profile}"; turn ignored`);
      return;
    }
    emitEvent("office.speech", {
      agentId: agent.id,
      name: agent.name,
      text: turn.text,
      atMs: turn.atMs,
      sessionId: turn.sessionId,
    });
  };

  const startOfficeSpeech = () => {
    if (officeSpeech) return;
    officeSpeech = createOfficeSpeechSubscriber({
      url,
      token,
      onTurn: handlePublishedTurn,
      log,
    });
  };

  const handleConnect = async (id) => {
    await loadAgentRoster();
    // Only worth subscribing once the roster exists to map turns onto.
    startOfficeSpeech();
    const agents = agentRoster.map((a) => ({
      agentId: a.id,
      name: a.name,
      isDefault: a.id === defaultAgentId,
    }));
    return resOk(id, {
      type: "hello-ok",
      protocol: 3,
      // The client trusts this over the configured type once connected, so
      // report what the backend actually is — hermes-agent capabilities
      // (native kanban, profile fleet) hang off this detection.
      adapterType: "hermes-agent",
      features: {
        methods: [
          "agents.list",
          "agents.files.get",
          "agents.files.set",
          "sessions.list",
          "sessions.preview",
          "sessions.patch",
          "sessions.reset",
          "chat.send",
          "chat.abort",
          "chat.history",
          "agent.wait",
          "status",
          "config.get",
          "config.set",
          "config.patch",
          "exec.approvals.get",
          "exec.approvals.set",
          "exec.approval.resolve",
          "wake",
          "skills.status",
          "models.list",
          "tasks.list",
          "tasks.update",
          "cron.list",
        ],
        events: ["chat", "agent", "presence", "heartbeat", "cron"],
      },
      snapshot: {
        health: { agents, defaultAgentId },
        sessionDefaults: { mainKey: MAIN_KEY },
      },
      auth: { role: "operator", scopes: ["operator.admin", "operator.approvals"] },
      policy: { tickIntervalMs: 30_000 },
    });
  };

  const handleMethod = async (method, params, id) => {
    const p = params || {};

    switch (method) {
      case "agents.list":
        return resOk(id, {
          defaultId: defaultAgentId,
          mainKey: MAIN_KEY,
          agents: agentRoster.map(({ id: agentId, name, workspace, identity, role }) => ({
            id: agentId,
            name,
            workspace,
            identity,
            role,
          })),
        });

      case "agents.files.get":
        return resOk(id, { file: { missing: true } });

      case "agents.files.set":
        return resOk(id, {});

      case "config.get":
        return resOk(id, {
          config: { gateway: { reload: { mode: "hot" } } },
          hash: "hermes-agent",
          exists: true,
          path: "",
        });

      case "config.patch":
      case "config.set":
        return resOk(id, { hash: "hermes-agent" });

      case "sessions.list": {
        // Each profile keeps its own session store, so the stored rows have to
        // be read per agent; they're local SQLite reads, so fan out in parallel.
        const perAgent = await Promise.all(
          agentRoster.map(async (agent) => {
            const profile = asString(agent.profile);
            let stored = [];
            try {
              const result = await client.request("session.list", {
                limit: 20,
                ...(profile ? { profile } : {}),
              });
              stored = Array.isArray(result?.sessions) ? result.sessions : [];
            } catch (err) {
              log(`[hermes-agent] session.list for "${agent.id}" failed: ${errorMessage(err)}`);
            }
            return [
              {
                key: `agent:${agent.id}:${MAIN_KEY}`,
                agentId: agent.id,
                updatedAt: Date.now(),
                displayName: "Main",
                origin: { label: agent.name, provider: "hermes" },
                modelProvider: "hermes",
              },
              ...stored.map((s) => ({
                key: `agent:${agent.id}:${asString(s.id)}`,
                agentId: agent.id,
                updatedAt: typeof s.started_at === "number" ? s.started_at * 1000 : null,
                displayName: asString(s.title, "Session"),
                origin: { label: agent.name, provider: "hermes" },
                modelProvider: "hermes",
              })),
            ];
          })
        );
        return resOk(id, { sessions: perAgent.flat() });
      }

      case "sessions.preview": {
        const keys = Array.isArray(p.keys) ? p.keys : [];
        const limit = typeof p.limit === "number" ? p.limit : 8;
        const maxChars = typeof p.maxChars === "number" ? p.maxChars : 240;
        const previews = await Promise.all(
          keys.map(async (key) => {
            const entry = sessions.get(key);
            if (!entry?.runtimeId) return { key, status: "empty", items: [] };
            try {
              const history = await client.request("session.history", {
                session_id: entry.runtimeId,
              });
              const items = toHermes3dMessages(history?.messages)
                .slice(-limit)
                .map((m) => ({
                  role: m.role,
                  text: m.content.slice(0, maxChars),
                  timestamp: Date.now(),
                }));
              return { key, status: items.length ? "ok" : "empty", items };
            } catch {
              return { key, status: "empty", items: [] };
            }
          })
        );
        return resOk(id, { ts: Date.now(), previews });
      }

      case "sessions.patch": {
        const key = asString(p.key, defaultMainKey());
        const model = typeof p.model === "string" ? p.model.trim() : "";
        if (model) {
          try {
            const entry = await ensureSession(key);
            await client.request("config.set", {
              key: "model",
              value: model,
              session_id: entry.runtimeId,
            });
          } catch (err) {
            log(`[hermes-agent] model switch failed: ${errorMessage(err)}`);
          }
        }
        return resOk(id, {
          ok: true,
          key,
          entry: { thinkingLevel: p.thinkingLevel },
          resolved: { model: model || undefined, modelProvider: "hermes" },
        });
      }

      case "sessions.reset": {
        const key = asString(p.key, defaultMainKey());
        const entry = sessions.get(key);
        if (entry?.runtimeId) {
          sessionKeyByRuntimeId.delete(entry.runtimeId);
          try {
            await client.request("session.close", { session_id: entry.runtimeId });
          } catch {}
        }
        sessions.delete(key);
        // The conversation this key pointed to is gone — forget any
        // routed-turn ledger for it too, or the next chat.history/routed
        // turn for this same key would resume stale state from the
        // conversation that was just reset (Codex review finding, P1,
        // 2026-09-01).
        clearLedger(key);
        return resOk(id, { ok: true });
      }

      case "chat.send": {
        const sessionKey = asString(p.sessionKey, defaultMainKey());
        const text =
          typeof p.message === "string" ? p.message.trim() : String(p.message ?? "").trim();
        const runId = asString(p.idempotencyKey) || randomUUID();
        if (!text) return resOk(id, { status: "no-op", runId });

        // --- Frontdoor Router --------------------------------------------
        // Routing is deliberately scoped to the Default agent only: the
        // other three profile cards keep behaving exactly as before (a
        // direct click on "Router-Opencode" always talks to Opencode,
        // never gets reclassified). See frontdoor-router.js for the rules.
        const { agentId: callerAgentId } = parseSessionKey(sessionKey);
        const isFrontdoor = callerAgentId === defaultAgentId;
        let targetSessionKey = sessionKey;
        let routing = null;

        if (isFrontdoor) {
          const startedAtMs = Date.now();
          emitEvent("routing.received", {
            runId,
            sessionKey,
            source: "hermes3d-frontdoor",
            textPreview: text.slice(0, 200),
            startedAtMs,
          });

          const classification = classifyMessage(text);
          const resolvedTarget = resolveRoutingTarget(
            agentRoster,
            defaultAgentId,
            classification.targetAgentId,
            callerAgentId
          );
          routing = {
            ...classification,
            targetAgentId: resolvedTarget.targetAgentId,
            targetProfile: resolvedTarget.targetProfile,
            targetModel: resolvedTarget.targetModel,
            startedAtMs,
          };

          emitEvent("routing.classified", {
            runId,
            sessionKey,
            category: classification.category,
            reason: classification.reason,
          });
          emitEvent("routing.selected", {
            runId,
            sessionKey,
            category: classification.category,
            // Report the agent/profile/model actually resolved against the
            // live roster, not the classifier's raw (possibly nonexistent)
            // request — routing.selected must describe what will really run.
            targetAgentId: routing.targetAgentId,
            targetProfile: routing.targetProfile,
            targetModel: routing.targetModel,
            reason: classification.reason,
          });

          // Recorded on `routing` itself (not just used locally) so
          // recordCompletedTurn below can tell an ACTUAL reroute apart from
          // a frontdoor classification that keeps the request on Default
          // (e.g. "complex/unclear" or MoA input) — both set `routing`, but
          // only a real reroute's reply lives on a separate specialist
          // session the ledger needs to remember (Codex review finding, P1,
          // 2026-09-01: treating every classified turn as "routed" made the
          // ledger re-fetch and duplicate the caller's OWN session history
          // on every ordinary Default turn that merely got classified).
          routing.wasRerouted = isReroute(routing, callerAgentId);
          if (routing.wasRerouted) {
            // Dedicated, ephemeral session under the target profile — never
            // the caller's own persistent "main" session for that agent, so
            // a routed call never mixes into (or hijacks) the user's direct
            // conversation with that specialist. Uses the RESOLVED target
            // (routing.targetAgentId), not the classifier's raw request —
            // otherwise a nonexistent target would still spawn a session
            // keyed to a phantom agent id.
            targetSessionKey = `agent:${routing.targetAgentId}:routed-${runId}`;
          }
        }

        const emitRoutingFailed = (err) => {
          if (!routing) return;
          const endedAtMs = Date.now();
          emitEvent("routing.failed", {
            runId,
            sessionKey,
            category: routing.category,
            targetAgentId: routing.targetAgentId,
            targetProfile: routing.targetProfile,
            targetModel: routing.targetModel,
            reason: routing.reason,
            startedAtMs: routing.startedAtMs,
            endedAtMs,
            durationMs: endedAtMs - routing.startedAtMs,
            status: "error",
            errorMessage: errorMessage(err),
          });
        };

        let entry;
        try {
          entry = await ensureSession(targetSessionKey);
        } catch (err) {
          emitRoutingFailed(err);
          return resErr(id, "hermes_agent.session_failed", errorMessage(err));
        }

        if (routing && targetSessionKey !== sessionKey) {
          // Redirect the routed runtime session's events back onto the
          // CALLER's sessionKey/runId, so the reply streams into the chat
          // window the user is actually watching (Default) instead of a
          // session Hermes3D never opened.
          sessionKeyByRuntimeId.set(entry.runtimeId, sessionKey);
        }

        activeRuns.set(runId, {
          sessionKey,
          runtimeId: entry.runtimeId,
          // Only used for a routed run's ledger entry (see recordCompletedTurn)
          // — `runtimeId` is scoped to THIS hermes-agent JSON-RPC connection
          // and stops resolving once it closes (confirmed live: a page
          // reload opens a brand new connection and the old runtimeId 404s
          // with "session not found"), while `storedId` is the durable id
          // session.resume can always re-open, connection or no connection.
          storedId: entry.storedId,
          // Only set (and different from `sessionKey`) for a routed run —
          // lets message.complete below drop the throwaway specialist
          // session's LOCAL bookkeeping once its durable id is safely on
          // disk, instead of accumulating one forever per routed message
          // (Codex review finding, P2, 2026-09-01).
          targetSessionKey,
          buffer: "",
          aborted: false,
        });
        runBySessionKey.set(sessionKey, runId);

        if (routing) {
          emitEvent("routing.started", {
            runId,
            sessionKey,
            targetAgentId: routing.targetAgentId,
            targetProfile: routing.targetProfile,
            targetModel: routing.targetModel,
            startedAtMs: routing.startedAtMs,
          });
          pendingRoutingByRunId.set(runId, routing);
        }

        try {
          await client.request("prompt.submit", { session_id: entry.runtimeId, text });
        } catch (err) {
          activeRuns.delete(runId);
          runBySessionKey.delete(sessionKey);
          pendingRoutingByRunId.delete(runId);
          emitRoutingFailed(err);
          return resErr(id, "hermes_agent.prompt_failed", errorMessage(err));
        }

        return resOk(id, { status: "started", runId });
      }

      case "chat.abort": {
        const runId = asString(p.runId);
        const sessionKey = asString(p.sessionKey);
        const targets = runId
          ? [runId]
          : [...activeRuns.entries()]
              .filter(([, run]) => run.sessionKey === sessionKey)
              .map(([rid]) => rid);

        let aborted = 0;
        for (const rid of targets) {
          const run = activeRuns.get(rid);
          if (!run) continue;
          run.aborted = true;
          aborted += 1;
          try {
            await client.request("session.interrupt", { session_id: run.runtimeId });
          } catch (err) {
            log(`[hermes-agent] interrupt failed: ${errorMessage(err)}`);
          }
        }
        return resOk(id, { ok: true, aborted });
      }

      case "chat.history": {
        const sessionKey = asString(p.sessionKey, defaultMainKey());
        const entry = sessions.get(sessionKey);
        const ledgerState = getRoutedTurnLedgerState(sessionKey);

        let ownMessages = [];
        if (entry?.runtimeId) {
          // Already resolved in THIS bridge instance — cheapest path.
          try {
            const history = await client.request("session.history", {
              session_id: entry.runtimeId,
            });
            ownMessages = toHermes3dMessages(history?.messages);
          } catch (err) {
            log(`[hermes-agent] session.history failed: ${errorMessage(err)}`);
          }
        } else if (ledgerState.ownStoredId) {
          // Not yet resolved here (e.g. right after a reload), but a
          // previous bridge instance recorded this session's durable id —
          // resume it instead of silently losing the caller's own turns
          // (Codex review finding, P1, 2026-09-01).
          try {
            ownMessages = await fetchStoredSessionMessages(
              ledgerState.ownStoredId,
              parseSessionKey(sessionKey).agentId
            );
          } catch (err) {
            log(`[hermes-agent] resuming own session failed: ${errorMessage(err)}`);
          }
        }

        if (ledgerState.turns.length === 0) {
          return resOk(id, { sessionKey, messages: ownMessages });
        }

        // At least one turn in this conversation was routed to a specialist
        // and only ever persisted under that specialist's own throwaway
        // session — reassemble the full, correctly ordered conversation
        // from the ledger instead of returning just the caller's own
        // (incomplete) history. See recordCompletedTurn above.
        const messages = await mergeRoutedTurnLedger(ledgerState, ownMessages, async (storedId, targetAgentId) => {
          try {
            return await fetchStoredSessionMessages(storedId, targetAgentId);
          } catch (err) {
            log(`[hermes-agent] routed session history failed for "${targetAgentId}": ${errorMessage(err)}`);
            return [];
          }
        });
        return resOk(id, { sessionKey, messages });
      }

      case "agent.wait": {
        const runId = asString(p.runId);
        const timeoutMs = typeof p.timeoutMs === "number" ? p.timeoutMs : 30_000;
        const start = Date.now();
        while (activeRuns.has(runId) && Date.now() - start < timeoutMs) {
          await new Promise((r) => setTimeout(r, 100));
        }
        return resOk(id, { status: activeRuns.has(runId) ? "running" : "done" });
      }

      case "status": {
        const recent = [...sessions.keys()].map((key) => ({ key, updatedAt: Date.now() }));
        const byAgent = agentRoster.map((agent) => ({
          agentId: agent.id,
          recent: recent.filter((entry) => parseSessionKey(entry.key).agentId === agent.id),
        }));
        return resOk(id, { sessions: { recent, byAgent } });
      }

      case "wake": {
        const text = asString(p.text);
        if (!text) return resOk(id, { ok: true });
        try {
          const entry = await ensureSession(defaultMainKey());
          await client.request("prompt.submit", { session_id: entry.runtimeId, text });
        } catch (err) {
          log(`[hermes-agent] wake failed: ${errorMessage(err)}`);
        }
        return resOk(id, { ok: true });
      }

      case "models.list": {
        try {
          const result = await client.request("model.options", {});
          const options = Array.isArray(result?.options) ? result.options : [];
          const models = options
            .map((o) => asString(o?.id) || asString(o?.slug) || asString(o?.model))
            .filter(Boolean)
            .map((modelId) => ({ id: modelId, name: modelId }));
          return resOk(id, { models: models.length ? models : [{ id: "hermes", name: "hermes" }] });
        } catch {
          return resOk(id, { models: [{ id: "hermes", name: "hermes" }] });
        }
      }

      case "skills.status": {
        try {
          const result = await client.request("skills.manage", { action: "list" });
          const skills = Array.isArray(result?.skills) ? result.skills : [];
          return resOk(id, { skills });
        } catch {
          return resOk(id, { skills: [] });
        }
      }

      case "cron.list": {
        try {
          // cron.manage reads the launch profile's scheduler, so the jobs
          // belong to whichever agent that profile maps to.
          const result = await client.request("cron.manage", { action: "list" });
          return resOk(id, { jobs: toHermes3dCronJobs(result?.jobs, defaultAgentId) });
        } catch (err) {
          log(`[hermes-agent] cron.manage failed: ${errorMessage(err)}`);
          return resOk(id, { jobs: [] });
        }
      }

      case "exec.approvals.get":
        return resOk(id, {
          path: "",
          exists: true,
          hash: "hermes-agent",
          file: {
            version: 1,
            defaults: { security: "full", ask: "off", autoAllowSkills: true },
            agents: {},
          },
        });

      case "exec.approvals.set":
        return resOk(id, { hash: "hermes-agent" });

      case "exec.approval.resolve": {
        const requestId = asString(p.id);
        const decision = asString(p.decision, "deny");
        const runtimeId = [...sessions.values()][0]?.runtimeId;
        if (requestId && runtimeId) {
          try {
            await client.request("approval.respond", {
              session_id: runtimeId,
              request_id: requestId,
              choice: decision === "allow" ? "once" : "deny",
            });
          } catch (err) {
            log(`[hermes-agent] approval.respond failed: ${errorMessage(err)}`);
          }
        }
        return resOk(id, { ok: true });
      }

      // Kanban is built into hermes-agent — the board rides the same origin
      // and session token as the JSON-RPC gateway, so the office task board
      // reflects the real `hermes kanban` board with nothing to install.
      case "tasks.list": {
        try {
          const includeArchived = p.includeArchived === false ? "false" : "true";
          const board = await kanbanRequest({
            wsUrl: url,
            token,
            useLoopbackHost: client.usedLoopbackHost,
            method: "GET",
            path: `/board?include_archived=${includeArchived}`,
          });
          return resOk(id, { tasks: toHermes3dKanbanTasks(board) });
        } catch (err) {
          // A hidden/disabled kanban plugin or older backend is not an error
          // state for the office — the board just has no hermes tasks.
          log(`[hermes-agent] kanban board unavailable: ${errorMessage(err)}`);
          return resOk(id, { tasks: [] });
        }
      }

      case "tasks.update": {
        const rawId = asString(p.id);
        if (!rawId.startsWith(KANBAN_TASK_ID_PREFIX)) {
          return resErr(
            id,
            "hermes_agent.tasks_update_unsupported",
            "Only Hermes kanban tasks can be updated on this backend.",
          );
        }
        const taskId = rawId.slice(KANBAN_TASK_ID_PREFIX.length);
        try {
          const result = await kanbanRequest({
            wsUrl: url,
            token,
            useLoopbackHost: client.usedLoopbackHost,
            method: "PATCH",
            path: `/tasks/${encodeURIComponent(taskId)}`,
            body: toKanbanPatchBody(p),
          });
          const record = toHermes3dKanbanTaskRecord(result?.task);
          if (!record) {
            return resErr(
              id,
              "hermes_agent.tasks_update_failed",
              "hermes-agent did not return the updated task.",
            );
          }
          return resOk(id, record);
        } catch (err) {
          return resErr(id, "hermes_agent.tasks_update_failed", errorMessage(err));
        }
      }

      default:
        log(`[hermes-agent] unhandled method: ${method}`);
        return resOk(id, {});
    }
  };

  // --- virtual WebSocket surface -------------------------------------------

  upstream.send = (raw) => {
    let frame;
    try {
      frame = JSON.parse(String(raw ?? ""));
    } catch {
      return;
    }
    if (!frame || frame.type !== "req") return;

    const { id, method, params } = frame;
    const respond = (result) => emitFrame(result);

    if (method === "connect") {
      handleConnect(id).then(respond, (err) =>
        respond(resErr(id, "hermes_agent.connect_failed", errorMessage(err)))
      );
      return;
    }

    handleMethod(method, params, id).then(respond, (err) => {
      logError(`[hermes-agent] method "${method}" failed.`, err);
      respond(resErr(id, "hermes_agent.request_failed", errorMessage(err)));
    });
  };

  const stopOfficeSpeech = () => {
    officeSpeech?.close();
    officeSpeech = null;
  };

  upstream.close = (code, reason) => {
    closed = true;
    upstream.readyState = CLOSED;
    stopOfficeSpeech();
    client.close(code, reason);
  };

  upstream.terminate = () => {
    closed = true;
    upstream.readyState = CLOSED;
    stopOfficeSpeech();
    client.terminate();
  };

  client.on("ready", () => {
    upstream.readyState = OPEN;
    log(`[hermes-agent] JSON-RPC gateway ready at ${redactUrl(client.url)}`);
    upstream.emit("open");
  });

  client.on("close", (code, reason) => {
    closed = true;
    upstream.readyState = CLOSED;
    stopOfficeSpeech();
    upstream.emit("close", code, Buffer.from(String(reason ?? "")));
  });

  client.on("error", (err) => {
    upstream.emit("error", err);
  });

  client.connect();

  return upstream;
}

module.exports = {
  createHermesAgentUpstream,
  toHermes3dMessages,
  toHermes3dCronJobs,
  toHermes3dSchedule,
  toHermes3dAgents,
  resolveDefaultAgentId,
  resolveRoutingTarget,
  appendRoutedTurnLedgerEntry,
  mergeRoutedTurnLedger,
  normalizeLedgerState,
  setOwnStoredId,
  removeLedgerEntry,
  resolveBackendId,
  MAIN_SESSION_KEY,
  AGENT_ID,
};
