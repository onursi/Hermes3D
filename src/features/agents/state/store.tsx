"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { AgentAvatarProfile } from "@/lib/avatars/profile";
import {
  areTranscriptEntriesEqual,
  buildOutputLinesFromTranscriptEntries,
  buildTranscriptEntriesFromLines,
  createTranscriptEntryFromLine,
  sortTranscriptEntries,
  TRANSCRIPT_V2_ENABLED,
  type TranscriptAppendMeta,
  type TranscriptEntry,
} from "@/features/agents/state/transcript";

export type AgentStatus = "idle" | "running" | "error";
export type FocusFilter = "all" | "running" | "approvals";

// Finer-grained status for the Frontdoor/Agent-HQ UI, layered on top of the
// existing coarse `AgentStatus` (idle/running/error) rather than replacing
// it — every existing call site keyed off `status` keeps working unchanged.
export type AgentFineStatus =
  | "idle"
  | "routing"
  | "working"
  | "tool_call"
  | "waiting_approval"
  | "done"
  | "error";

// One entry per routing.* event, kept as a flat rolling log (capped) so the
// Live-Activity panel and Frontdoor-Flow panel can render a real timeline
// without re-deriving it from the raw gateway event stream.
export type RoutingLogEntry = {
  id: string;
  runId: string;
  event: "received" | "classified" | "selected" | "started" | "completed" | "failed";
  at: number;
  sessionKey: string;
  category?: string | null;
  targetAgentId?: string | null;
  targetProfile?: string | null;
  targetModel?: string | null;
  reason?: string | null;
  status?: string | null;
  durationMs?: number | null;
  textPreview?: string | null;
};

export type AgentStoreSeed = {
  agentId: string;
  name: string;
  runtimeName?: string | null;
  identityName?: string | null;
  sessionDisplayName?: string | null;
  role?: string | null;
  sessionKey: string;
  avatarSeed?: string | null;
  avatarProfile?: AgentAvatarProfile | null;
  avatarUrl?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  sessionExecHost?: "sandbox" | "gateway" | "node";
  sessionExecSecurity?: "deny" | "allowlist" | "full";
  sessionExecAsk?: "off" | "on-miss" | "always";
  toolCallingEnabled?: boolean;
  showThinkingTraces?: boolean;
};

export type AgentState = AgentStoreSeed & {
  status: AgentStatus;
  sessionCreated: boolean;
  awaitingUserInput: boolean;
  hasUnseenActivity: boolean;
  outputLines: string[];
  lastResult: string | null;
  lastDiff: string | null;
  runId: string | null;
  runStartedAt: number | null;
  streamText: string | null;
  thinkingTrace: string | null;
  latestOverride: string | null;
  latestOverrideKind: "heartbeat" | "cron" | null;
  lastAssistantMessageAt: number | null;
  lastActivityAt: number | null;
  latestPreview: string | null;
  lastUserMessage: string | null;
  draft: string;
  queuedMessages?: string[];
  sessionSettingsSynced: boolean;
  historyLoadedAt: number | null;
  historyFetchLimit: number | null;
  historyFetchedCount: number | null;
  historyMaybeTruncated: boolean;
  toolCallingEnabled: boolean;
  showThinkingTraces: boolean;
  transcriptEntries?: TranscriptEntry[];
  transcriptRevision?: number;
  transcriptSequenceCounter?: number;
  sessionEpoch?: number;
  lastHistoryRequestRevision?: number | null;
  lastAppliedHistoryRequestId?: string | null;
  // Agent-HQ additions (2026-08-31) — all optional/additive, populated from
  // routing.* events by runtimeRoutingEventWorkflow.ts. Nothing existing
  // reads or depends on these, so they default to null/idle everywhere.
  provider?: string | null;
  fineStatus?: AgentFineStatus;
  lastToolCall?: string | null;
  routingCategory?: string | null;
  routingReason?: string | null;
  routingReceivedAt?: number | null;
};

export const buildNewSessionAgentPatch = (agent: AgentState): Partial<AgentState> => {
  return {
    sessionKey: agent.sessionKey,
    status: "idle",
    runId: null,
    runStartedAt: null,
    streamText: null,
    thinkingTrace: null,
    outputLines: [],
    lastResult: null,
    lastDiff: null,
    latestOverride: null,
    latestOverrideKind: null,
    lastAssistantMessageAt: null,
    lastActivityAt: null,
    latestPreview: null,
    lastUserMessage: null,
    draft: "",
    queuedMessages: [],
    historyLoadedAt: null,
    historyFetchLimit: null,
    historyFetchedCount: null,
    historyMaybeTruncated: false,
    awaitingUserInput: false,
    hasUnseenActivity: false,
    sessionCreated: true,
    sessionSettingsSynced: true,
    transcriptEntries: [],
    transcriptRevision: (agent.transcriptRevision ?? 0) + 1,
    transcriptSequenceCounter: 0,
    sessionEpoch: (agent.sessionEpoch ?? 0) + 1,
    lastHistoryRequestRevision: null,
    lastAppliedHistoryRequestId: null,
  };
};

export type AgentStoreState = {
  agents: AgentState[];
  selectedAgentId: string | null;
  loading: boolean;
  error: string | null;
  routingLog: RoutingLogEntry[];
};

type Action =
  | { type: "hydrateAgents"; agents: AgentStoreSeed[]; selectedAgentId?: string }
  | { type: "setError"; error: string | null }
  | { type: "setLoading"; loading: boolean }
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "removeAgent"; agentId: string }
  | { type: "appendOutput"; agentId: string; line: string; transcript?: TranscriptAppendMeta }
  | { type: "enqueueQueuedMessage"; agentId: string; message: string }
  | { type: "removeQueuedMessage"; agentId: string; index: number }
  | { type: "shiftQueuedMessage"; agentId: string; expectedMessage?: string }
  | { type: "markActivity"; agentId: string; at?: number }
  | { type: "selectAgent"; agentId: string | null }
  | { type: "appendRoutingLog"; entry: RoutingLogEntry };

const initialState: AgentStoreState = {
  agents: [],
  selectedAgentId: null,
  loading: false,
  error: null,
  routingLog: [],
};

const MAX_AGENT_TRANSCRIPT_ENTRIES = 600;
const MAX_ROUTING_LOG_ENTRIES = 200;

const areStringArraysEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
};

const ensureTranscriptEntries = (agent: AgentState): TranscriptEntry[] => {
  if (Array.isArray(agent.transcriptEntries)) {
    return agent.transcriptEntries.slice(-MAX_AGENT_TRANSCRIPT_ENTRIES);
  }
  return buildTranscriptEntriesFromLines({
    lines: agent.outputLines,
    sessionKey: agent.sessionKey,
    source: "legacy",
    startSequence: 0,
    confirmed: true,
  }).slice(-MAX_AGENT_TRANSCRIPT_ENTRIES);
};

const trimTranscriptEntries = (entries: TranscriptEntry[]): TranscriptEntry[] => {
  return entries.length <= MAX_AGENT_TRANSCRIPT_ENTRIES
    ? entries
    : entries.slice(-MAX_AGENT_TRANSCRIPT_ENTRIES);
};

const trimOutputLines = (lines: string[]): string[] => {
  return lines.length <= MAX_AGENT_TRANSCRIPT_ENTRIES
    ? lines
    : lines.slice(-MAX_AGENT_TRANSCRIPT_ENTRIES);
};

const nextTranscriptSequenceCounter = (
  currentCounter: number | undefined,
  entries: TranscriptEntry[]
): number => {
  const derived = entries.reduce((max, entry) => Math.max(max, entry.sequenceKey + 1), 0);
  return Math.max(currentCounter ?? 0, derived);
};

const createRuntimeAgentState = (
  seed: AgentStoreSeed,
  existing?: AgentState | null
): AgentState => {
  const sameSessionKey = existing?.sessionKey === seed.sessionKey;
  const outputLines = sameSessionKey ? trimOutputLines(existing?.outputLines ?? []) : [];
  const queuedMessages = sameSessionKey ? [...(existing?.queuedMessages ?? [])] : [];
  const transcriptEntries = sameSessionKey
    ? Array.isArray(existing?.transcriptEntries)
      ? trimTranscriptEntries(existing.transcriptEntries)
      : buildTranscriptEntriesFromLines({
          lines: outputLines,
          sessionKey: seed.sessionKey,
          source: "legacy",
          startSequence: 0,
          confirmed: true,
        }).slice(-MAX_AGENT_TRANSCRIPT_ENTRIES)
    : [];
  return {
    ...seed,
    avatarSeed: seed.avatarSeed ?? existing?.avatarSeed ?? seed.agentId,
    avatarProfile: seed.avatarProfile ?? existing?.avatarProfile ?? null,
    avatarUrl: seed.avatarUrl ?? existing?.avatarUrl ?? null,
    model: seed.model ?? existing?.model ?? null,
    thinkingLevel: seed.thinkingLevel ?? existing?.thinkingLevel ?? "high",
    sessionExecHost: seed.sessionExecHost ?? existing?.sessionExecHost,
    sessionExecSecurity: seed.sessionExecSecurity ?? existing?.sessionExecSecurity,
    sessionExecAsk: seed.sessionExecAsk ?? existing?.sessionExecAsk,
    status: sameSessionKey ? (existing?.status ?? "idle") : "idle",
    sessionCreated: sameSessionKey ? (existing?.sessionCreated ?? false) : false,
    awaitingUserInput: sameSessionKey ? (existing?.awaitingUserInput ?? false) : false,
    hasUnseenActivity: sameSessionKey ? (existing?.hasUnseenActivity ?? false) : false,
    outputLines,
    lastResult: sameSessionKey ? (existing?.lastResult ?? null) : null,
    lastDiff: sameSessionKey ? (existing?.lastDiff ?? null) : null,
    runId: sameSessionKey ? (existing?.runId ?? null) : null,
    runStartedAt: sameSessionKey ? (existing?.runStartedAt ?? null) : null,
    streamText: sameSessionKey ? (existing?.streamText ?? null) : null,
    thinkingTrace: sameSessionKey ? (existing?.thinkingTrace ?? null) : null,
    latestOverride: sameSessionKey ? (existing?.latestOverride ?? null) : null,
    latestOverrideKind: sameSessionKey ? (existing?.latestOverrideKind ?? null) : null,
    lastAssistantMessageAt: sameSessionKey ? (existing?.lastAssistantMessageAt ?? null) : null,
    lastActivityAt: sameSessionKey ? (existing?.lastActivityAt ?? null) : null,
    latestPreview: sameSessionKey ? (existing?.latestPreview ?? null) : null,
    lastUserMessage: sameSessionKey ? (existing?.lastUserMessage ?? null) : null,
    draft: sameSessionKey ? (existing?.draft ?? "") : "",
    queuedMessages,
    sessionSettingsSynced: sameSessionKey ? (existing?.sessionSettingsSynced ?? false) : false,
    historyLoadedAt: sameSessionKey ? (existing?.historyLoadedAt ?? null) : null,
    historyFetchLimit: sameSessionKey ? (existing?.historyFetchLimit ?? null) : null,
    historyFetchedCount: sameSessionKey ? (existing?.historyFetchedCount ?? null) : null,
    historyMaybeTruncated: sameSessionKey ? (existing?.historyMaybeTruncated ?? false) : false,
    toolCallingEnabled: seed.toolCallingEnabled ?? existing?.toolCallingEnabled ?? false,
    showThinkingTraces: seed.showThinkingTraces ?? existing?.showThinkingTraces ?? true,
    transcriptEntries,
    transcriptRevision: sameSessionKey
      ? (existing?.transcriptRevision ?? outputLines.length)
      : 0,
    transcriptSequenceCounter: sameSessionKey
      ? (existing?.transcriptSequenceCounter ??
        nextTranscriptSequenceCounter(existing?.transcriptSequenceCounter, transcriptEntries))
      : 0,
    sessionEpoch: sameSessionKey
      ? (existing?.sessionEpoch ?? 0)
      : (existing?.sessionEpoch ?? 0) + 1,
    lastHistoryRequestRevision: sameSessionKey
      ? (existing?.lastHistoryRequestRevision ?? null)
      : null,
    lastAppliedHistoryRequestId: sameSessionKey
      ? (existing?.lastAppliedHistoryRequestId ?? null)
      : null,
    provider: sameSessionKey ? (existing?.provider ?? null) : null,
    fineStatus: sameSessionKey ? (existing?.fineStatus ?? "idle") : "idle",
    lastToolCall: sameSessionKey ? (existing?.lastToolCall ?? null) : null,
    routingCategory: sameSessionKey ? (existing?.routingCategory ?? null) : null,
    routingReason: sameSessionKey ? (existing?.routingReason ?? null) : null,
    routingReceivedAt: sameSessionKey ? (existing?.routingReceivedAt ?? null) : null,
  };
};

const reducer = (state: AgentStoreState, action: Action): AgentStoreState => {
  switch (action.type) {
    case "hydrateAgents": {
      const byId = new Map(state.agents.map((agent) => [agent.agentId, agent]));
      const agents = action.agents.map((seed) =>
        createRuntimeAgentState(seed, byId.get(seed.agentId))
      );
      const requestedSelectedAgentId = action.selectedAgentId?.trim() ?? "";
      const selectedAgentId =
        requestedSelectedAgentId &&
        agents.some((agent) => agent.agentId === requestedSelectedAgentId)
          ? requestedSelectedAgentId
          : state.selectedAgentId &&
              agents.some((agent) => agent.agentId === state.selectedAgentId)
          ? state.selectedAgentId
          : agents[0]?.agentId ?? null;
      // Fixed 2026-08-30: createRuntimeAgentState() always returns a brand-new
      // object (spread), so `agents` was a fresh array reference on every
      // hydrateAgents call even when nothing actually changed. Several
      // useEffects elsewhere key off `state.agents` by reference, and a
      // real (non-demo) backend re-hydrates on every poll/event — so an
      // unconditionally-new array reference here turned those into a live
      // "Maximum update depth exceeded" loop once real data (not just an
      // idle demo seed) started flowing. Bail out to the existing `state`
      // when the hydration is a true no-op so React's reference-equality
      // bail-out actually stops the cascade at the source, rather than
      // depending on every consumer downstream getting its own dependency
      // array exactly right.
      const isNoopHydration =
        selectedAgentId === state.selectedAgentId &&
        !state.loading &&
        state.error === null &&
        agents.length === state.agents.length &&
        agents.every(
          (agent, index) =>
            state.agents[index]?.agentId === agent.agentId &&
            JSON.stringify(state.agents[index]) === JSON.stringify(agent)
        );
      if (isNoopHydration) return state;
      return {
        ...state,
        agents,
        selectedAgentId,
        loading: false,
        error: null,
      };
    }
    case "setError":
      return { ...state, error: action.error, loading: false };
    case "setLoading":
      return { ...state, loading: action.loading };
    case "updateAgent": {
      // Same reference-equality bail-out philosophy as hydrateAgents above
      // (2026-08-30 fix), applied here too (2026-08-31): the Frontdoor
      // Router can fire several updateAgent patches for the same agent
      // within a few hundred ms (received/classified/selected/started),
      // and some pre-existing useEffects elsewhere in this file key off
      // `state.agents` by reference. A patch that doesn't actually change
      // anything (e.g. re-affirming the same fineStatus) still produced a
      // brand-new agents array before this fix, which was enough to tip a
      // couple of those effects into a real "Maximum update depth
      // exceeded" loop once routing made updateAgent fire that rapidly.
      // Bailing out per-agent (and for the whole array when nothing in it
      // actually changed) stops that at the source.
      let anyAgentChanged = false;
      const nextAgents = state.agents.map((agent) => {
        if (agent.agentId !== action.agentId) return agent;
        const patch = action.patch;
          const nextSessionKey = (patch.sessionKey ?? agent.sessionKey).trim();
          const sessionKeyChanged = nextSessionKey !== agent.sessionKey.trim();
          const patchHasTranscriptEntries = Array.isArray(patch.transcriptEntries);
          const patchHasOutputLines = Array.isArray(patch.outputLines);
          const patchMutatesTranscript = patchHasTranscriptEntries || patchHasOutputLines;

          const existingEntries = ensureTranscriptEntries(agent);
          const base: AgentState = { ...agent, ...patch };
          // Default to the agent's own array reference (not existingEntries,
          // which ensureTranscriptEntries() always re-slices into a fresh
          // array even when nothing changed) — otherwise the no-op check
          // below would see a "changed" transcriptEntries reference on
          // every single patch, even ones that never touch the transcript.
          let nextEntries: TranscriptEntry[] = Array.isArray(agent.transcriptEntries)
            ? agent.transcriptEntries
            : existingEntries;
          if (Array.isArray(base.transcriptEntries)) {
            nextEntries = base.transcriptEntries as TranscriptEntry[];
          }
          let nextOutputLines: string[] = agent.outputLines;
          if (Array.isArray(base.outputLines)) {
            nextOutputLines = base.outputLines as string[];
          }
          let transcriptMutated = false;

          if (patchHasTranscriptEntries) {
            const patchedTranscriptEntries = patch.transcriptEntries as TranscriptEntry[];
            const normalized = TRANSCRIPT_V2_ENABLED
              ? sortTranscriptEntries(patchedTranscriptEntries)
              : [...patchedTranscriptEntries];
            const trimmed = trimTranscriptEntries(normalized);
            transcriptMutated = !areTranscriptEntriesEqual(existingEntries, trimmed);
            nextEntries = trimmed;
            nextOutputLines = trimOutputLines(buildOutputLinesFromTranscriptEntries(trimmed));
          } else if (patchHasOutputLines) {
            const patchedOutputLines = trimOutputLines(patch.outputLines as string[]);
            const rebuilt = buildTranscriptEntriesFromLines({
              lines: patchedOutputLines,
              sessionKey: nextSessionKey || agent.sessionKey,
              source: "legacy",
              startSequence: 0,
              confirmed: true,
            });
            const normalized = TRANSCRIPT_V2_ENABLED ? sortTranscriptEntries(rebuilt) : rebuilt;
            const trimmed = trimTranscriptEntries(normalized);
            transcriptMutated = !areStringArraysEqual(agent.outputLines, patchedOutputLines);
            nextEntries = trimmed;
            nextOutputLines = TRANSCRIPT_V2_ENABLED
              ? trimOutputLines(buildOutputLinesFromTranscriptEntries(trimmed))
              : [...patchedOutputLines];
          }

          const revision = transcriptMutated
            ? (agent.transcriptRevision ?? 0) + 1
            : (patch.transcriptRevision ?? agent.transcriptRevision ?? 0);
          const nextCounter = patchMutatesTranscript
            ? nextTranscriptSequenceCounter(base.transcriptSequenceCounter, nextEntries)
            : (base.transcriptSequenceCounter ?? agent.transcriptSequenceCounter ?? 0);

          const nextAgent: AgentState = {
            ...base,
            outputLines: nextOutputLines,
            transcriptEntries: nextEntries,
            transcriptRevision: revision,
            transcriptSequenceCounter: nextCounter,
            sessionEpoch:
              patch.sessionEpoch !== undefined
                ? patch.sessionEpoch
                : sessionKeyChanged
                  ? (agent.sessionEpoch ?? 0) + 1
                  : (agent.sessionEpoch ?? 0),
          };

          const isNoopPatch = (Object.keys(nextAgent) as Array<keyof AgentState>).every(
            (key) => Object.is(agent[key], nextAgent[key])
          );
          if (isNoopPatch) return agent;
          anyAgentChanged = true;
          return nextAgent;
      });
      if (!anyAgentChanged) return state;
      return { ...state, agents: nextAgents };
    }
    case "removeAgent": {
      const nextAgents = state.agents.filter((agent) => agent.agentId !== action.agentId);
      const selectedAgentId =
        state.selectedAgentId === action.agentId
          ? nextAgents[0]?.agentId ?? null
          : state.selectedAgentId;
      return {
        ...state,
        agents: nextAgents,
        selectedAgentId,
      };
    }
    case "appendOutput":
      return {
        ...state,
        agents: state.agents.map((agent) => {
          if (agent.agentId !== action.agentId) return agent;
          const existingEntries = ensureTranscriptEntries(agent);
          const nextSequence = nextTranscriptSequenceCounter(
            agent.transcriptSequenceCounter,
            existingEntries
          );
          const nextEntry = createTranscriptEntryFromLine({
            line: action.line,
            sessionKey: action.transcript?.sessionKey ?? agent.sessionKey,
            source: action.transcript?.source ?? "legacy",
            runId: action.transcript?.runId ?? agent.runId,
            timestampMs: action.transcript?.timestampMs,
            fallbackTimestampMs: action.transcript?.timestampMs ?? Date.now(),
            role: action.transcript?.role,
            kind: action.transcript?.kind,
            entryId: action.transcript?.entryId,
            confirmed: action.transcript?.confirmed,
            sequenceKey: nextSequence,
          });
          if (!nextEntry) {
            return {
              ...agent,
              outputLines: trimOutputLines([...agent.outputLines, action.line]),
            };
          }
          const nextEntryId = nextEntry.entryId.trim();
          const existingIndex =
            nextEntryId.length > 0
              ? existingEntries.findIndex((entry) => entry.entryId === nextEntryId)
              : -1;
          const hasReplacement = existingIndex >= 0;

          let nextEntries: TranscriptEntry[];
          if (hasReplacement) {
            let replacedOne = false;
            const replaced = existingEntries.reduce<TranscriptEntry[]>((acc, entry) => {
              if (entry.entryId !== nextEntryId) {
                acc.push(entry);
                return acc;
              }
              if (replacedOne) {
                return acc;
              }
              replacedOne = true;
              acc.push({
                ...nextEntry,
                sequenceKey: entry.sequenceKey,
              });
              return acc;
            }, []);
            nextEntries = trimTranscriptEntries(
              TRANSCRIPT_V2_ENABLED ? sortTranscriptEntries(replaced) : replaced
            );
          } else {
            const appended = [...existingEntries, nextEntry];
            nextEntries = trimTranscriptEntries(
              TRANSCRIPT_V2_ENABLED ? sortTranscriptEntries(appended) : appended
            );
          }

          return {
            ...agent,
            outputLines:
              TRANSCRIPT_V2_ENABLED || hasReplacement
                ? trimOutputLines(buildOutputLinesFromTranscriptEntries(nextEntries))
                : trimOutputLines([...agent.outputLines, action.line]),
            transcriptEntries: nextEntries,
            transcriptRevision: (agent.transcriptRevision ?? 0) + 1,
            transcriptSequenceCounter: Math.max(
              agent.transcriptSequenceCounter ?? 0,
              nextEntry.sequenceKey + 1
            ),
          };
        }),
      };
    case "enqueueQueuedMessage":
      return {
        ...state,
        agents: state.agents.map((agent) => {
          if (agent.agentId !== action.agentId) return agent;
          const message = action.message.trim();
          if (!message) return agent;
          const queuedMessages = [...(agent.queuedMessages ?? []), message];
          return { ...agent, queuedMessages };
        }),
      };
    case "removeQueuedMessage":
      return {
        ...state,
        agents: state.agents.map((agent) => {
          if (agent.agentId !== action.agentId) return agent;
          if (!Number.isInteger(action.index) || action.index < 0) return agent;
          const queuedMessages = agent.queuedMessages ?? [];
          if (action.index >= queuedMessages.length) return agent;
          return {
            ...agent,
            queuedMessages: queuedMessages.filter((_, index) => index !== action.index),
          };
        }),
      };
    case "shiftQueuedMessage":
      return {
        ...state,
        agents: state.agents.map((agent) => {
          if (agent.agentId !== action.agentId) return agent;
          const queuedMessages = agent.queuedMessages ?? [];
          if (queuedMessages.length === 0) return agent;
          if (
            action.expectedMessage !== undefined &&
            action.expectedMessage.trim() !== queuedMessages[0]
          ) {
            return agent;
          }
          return { ...agent, queuedMessages: queuedMessages.slice(1) };
        }),
      };
    case "markActivity": {
      const at = action.at ?? Date.now();
      return {
        ...state,
        agents: state.agents.map((agent) => {
          if (agent.agentId !== action.agentId) return agent;
          const isSelected = state.selectedAgentId === action.agentId;
          return {
            ...agent,
            lastActivityAt: at,
            hasUnseenActivity: isSelected ? false : true,
          };
        }),
      };
    }
    case "selectAgent": {
      if (action.agentId === state.selectedAgentId) {
        if (action.agentId === null) {
          return state;
        }
        const selected = state.agents.find((agent) => agent.agentId === action.agentId) ?? null;
        if (!selected || !selected.hasUnseenActivity) {
          return state;
        }
      }
      return {
        ...state,
        selectedAgentId: action.agentId,
        agents:
          action.agentId === null
            ? state.agents
            : state.agents.map((agent) =>
                agent.agentId === action.agentId
                  ? { ...agent, hasUnseenActivity: false }
                  : agent
              ),
      };
    }
    case "appendRoutingLog": {
      // De-dupe on id: bridge.js reconnects/retries can in principle
      // redeliver the same routing.* event, and the log is meant to be a
      // clean one-entry-per-event timeline, not a raw wire replay.
      if (state.routingLog.some((entry) => entry.id === action.entry.id)) {
        return state;
      }
      const next = [...state.routingLog, action.entry];
      return {
        ...state,
        routingLog:
          next.length > MAX_ROUTING_LOG_ENTRIES
            ? next.slice(next.length - MAX_ROUTING_LOG_ENTRIES)
            : next,
      };
    }
    default:
      return state;
  }
};

export const agentStoreReducer = reducer;
export const initialAgentStoreState = initialState;

type AgentStoreContextValue = {
  state: AgentStoreState;
  dispatch: React.Dispatch<Action>;
  hydrateAgents: (agents: AgentStoreSeed[], selectedAgentId?: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  appendRoutingLog: (entry: RoutingLogEntry) => void;
};

const AgentStoreContext = createContext<AgentStoreContextValue | null>(null);

export const AgentStoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const hydrateAgents = useCallback(
    (agents: AgentStoreSeed[], selectedAgentId?: string) => {
      dispatch({ type: "hydrateAgents", agents, selectedAgentId });
    },
    [dispatch]
  );

  const setLoading = useCallback(
    (loading: boolean) => dispatch({ type: "setLoading", loading }),
    [dispatch]
  );

  const setError = useCallback(
    (error: string | null) => dispatch({ type: "setError", error }),
    [dispatch]
  );

  const appendRoutingLog = useCallback(
    (entry: RoutingLogEntry) => dispatch({ type: "appendRoutingLog", entry }),
    [dispatch]
  );

  const value = useMemo(
    () => ({ state, dispatch, hydrateAgents, setLoading, setError, appendRoutingLog }),
    [dispatch, hydrateAgents, setError, setLoading, state, appendRoutingLog]
  );

  return (
    <AgentStoreContext.Provider value={value}>{children}</AgentStoreContext.Provider>
  );
};

export const useAgentStore = () => {
  const ctx = useContext(AgentStoreContext);
  if (!ctx) {
    throw new Error("AgentStoreProvider is missing.");
  }
  return ctx;
};

export const getRecentRoutingLog = (
  state: AgentStoreState,
  limit = 50
): RoutingLogEntry[] =>
  limit >= state.routingLog.length
    ? state.routingLog
    : state.routingLog.slice(state.routingLog.length - limit);

export const getSelectedAgent = (state: AgentStoreState): AgentState | null => {
  if (!state.selectedAgentId) return null;
  return state.agents.find((agent) => agent.agentId === state.selectedAgentId) ?? null;
};

export const getFilteredAgents = (state: AgentStoreState, filter: FocusFilter): AgentState[] => {
  const statusPriority: Record<AgentStatus, number> = {
    running: 0,
    idle: 1,
    error: 2,
  };
  const getActivityTimestamp = (agent: AgentState) =>
    Math.max(agent.lastActivityAt ?? 0, agent.runStartedAt ?? 0, agent.lastAssistantMessageAt ?? 0);
  const sortAgents = (agents: AgentState[], prioritizeStatus: boolean) =>
    agents
      .map((agent, index) => ({ agent, index }))
      .sort((left, right) => {
        if (prioritizeStatus) {
          const statusDelta =
            statusPriority[left.agent.status] - statusPriority[right.agent.status];
          if (statusDelta !== 0) return statusDelta;
        }
        const timeDelta = getActivityTimestamp(right.agent) - getActivityTimestamp(left.agent);
        if (timeDelta !== 0) return timeDelta;
        return left.index - right.index;
      })
      .map(({ agent }) => agent);
  switch (filter) {
    case "all":
      return sortAgents(state.agents, true);
    case "running":
      return sortAgents(state.agents.filter((agent) => agent.status === "running"), false);
    case "approvals":
      return sortAgents(state.agents.filter((agent) => agent.awaitingUserInput), false);
    default: {
      const _exhaustive: never = filter;
      void _exhaustive;
      return sortAgents(state.agents, true);
    }
  }
};
