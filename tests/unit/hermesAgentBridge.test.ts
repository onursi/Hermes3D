// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket as WsSocket } from "ws";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { buildJsonRpcUrl, redactUrl } = await import("../../server/hermes-agent/jsonrpc-client");
const { createHermesAgentUpstream, toHermes3dMessages } = await import(
  "../../server/hermes-agent/bridge"
);

type Frame = Record<string, unknown>;
type RpcHandler = (params: Frame, emit: (type: string, payload: Frame) => void) => Frame | void;

/** Read a dotted path out of a decoded frame without widening everything to `any`. */
const at = (source: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], source);

const servers: WebSocketServer[] = [];
const upstreams: { terminate: () => void }[] = [];

afterEach(async () => {
  for (const upstream of upstreams.splice(0)) {
    try {
      upstream.terminate();
    } catch {}
  }
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

/**
 * Minimal stand-in for hermes-agent's /api/ws: emits gateway.ready on connect,
 * answers JSON-RPC requests from `handlers`, and lets a handler push events.
 */
const startFakeHermesAgent = async (handlers: Record<string, RpcHandler>) => {
  const wss = new WebSocketServer({ port: 0 });
  servers.push(wss);
  await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

  const received: Frame[] = [];

  wss.on("connection", (ws: WsSocket, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    received.push({ __connect: true, path: url.pathname, token: url.searchParams.get("token") });

    const send = (obj: unknown) => ws.send(JSON.stringify(obj));
    const emit = (type: string, payload: Frame) =>
      send({ jsonrpc: "2.0", method: "event", params: { type, session_id: "s1", payload } });

    send({ jsonrpc: "2.0", method: "event", params: { type: "gateway.ready", payload: {} } });

    ws.on("message", (raw) => {
      const request = JSON.parse(String(raw)) as Frame;
      received.push(request);
      const handler = handlers[String(request.method)];
      if (!handler) {
        send({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: "unknown method" },
        });
        return;
      }
      const result = handler((request.params ?? {}) as Frame, emit);
      send({ jsonrpc: "2.0", id: request.id, result: result ?? {} });
    });
  });

  const { port } = wss.address() as AddressInfo;
  return { url: `ws://127.0.0.1:${port}`, received };
};

/** Drive the bridge and collect the frames it sends back toward the browser. */
const openBridge = async (url: string, token = "") => {
  const frames: Frame[] = [];
  const upstream = createHermesAgentUpstream({ url, token });
  upstreams.push(upstream);
  upstream.on("message", (raw: string) => frames.push(JSON.parse(raw) as Frame));

  await new Promise<void>((resolve, reject) => {
    upstream.on("open", () => resolve());
    upstream.on("error", reject);
    setTimeout(() => reject(new Error("bridge did not open")), 5000);
  });

  const send = (frame: Frame) => upstream.send(JSON.stringify(frame));

  const waitFor = async (predicate: (frame: Frame) => boolean, label: string) => {
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const hit = frames.find(predicate);
      if (hit) return hit;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`timed out waiting for ${label}; saw ${JSON.stringify(frames)}`);
  };

  return { upstream, frames, send, waitFor };
};

describe("buildJsonRpcUrl", () => {
  it("appends the gateway path and maps https to wss", () => {
    expect(buildJsonRpcUrl("https://host.ts.net:8443", "abc")).toBe(
      "wss://host.ts.net:8443/api/ws?token=abc",
    );
  });

  it("keeps a path the caller already supplied", () => {
    expect(buildJsonRpcUrl("wss://host.ts.net:8443/api/ws", "")).toBe(
      "wss://host.ts.net:8443/api/ws",
    );
  });

  it("maps http to ws and tolerates a trailing slash", () => {
    expect(buildJsonRpcUrl("http://localhost:9119/", "t")).toBe(
      "ws://localhost:9119/api/ws?token=t",
    );
  });

  it("rejects a scheme that is not http(s) or ws(s)", () => {
    expect(() => buildJsonRpcUrl("ftp://host", "")).toThrow(/Unsupported scheme/);
  });

  it("keeps the token out of logged URLs", () => {
    expect(redactUrl("wss://h/api/ws?token=secret")).toBe("wss://h/api/ws?token=***");
  });
});

describe("loopback Host fallback", () => {
  /**
   * Stands in for a loopback-bound hermes-agent behind Tailscale Serve, which
   * forwards the client's Host verbatim: the tailnet name is refused with 4403
   * and only a loopback Host gets through.
   */
  const startHostStrictAgent = async () => {
    const wss = new WebSocketServer({ port: 0 });
    servers.push(wss);
    await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

    const hostsSeen: string[] = [];
    wss.on("connection", (ws: WsSocket, req) => {
      const host = String(req.headers.host ?? "");
      hostsSeen.push(host);
      const hostOnly = host.split(":")[0].toLowerCase();
      if (!["localhost", "127.0.0.1", "::1"].includes(hostOnly)) {
        ws.close(4403, "host_mismatch");
        return;
      }
      ws.send(JSON.stringify({ jsonrpc: "2.0", method: "event", params: { type: "gateway.ready", payload: {} } }));
    });

    const { port } = wss.address() as AddressInfo;
    return { port, hostsSeen };
  };

  it("retries with a loopback Host when the backend refuses the forwarded one", async () => {
    const { port, hostsSeen } = await startHostStrictAgent();
    const { HermesAgentJsonRpcClient } = await import("../../server/hermes-agent/jsonrpc-client");

    // 127.0.0.1 resolves, but the Host header carries a name the backend rejects.
    const client = new HermesAgentJsonRpcClient({ url: `ws://127.0.0.1:${port}`, token: "t" });
    client.hostHeader = "box.ts.net";
    client.loopbackHostFallback = true;

    const ready = new Promise<void>((resolve, reject) => {
      client.on("ready", () => resolve());
      client.on("close", (code: number) => reject(new Error(`closed ${code}`)));
      setTimeout(() => reject(new Error("never became ready")), 5000);
    });
    client.connect();
    await ready;

    expect(hostsSeen[0]).toBe("box.ts.net");
    expect(hostsSeen[1]).toBe("localhost");
    expect(client.usedLoopbackHost).toBe(true);
    client.terminate();
  });

  it("retries when the upgrade is refused with HTTP 403 before accepting", async () => {
    // How a loopback-bound hermes-agent actually refuses a foreign Host on
    // /api/ws: the handshake is rejected outright rather than accepted-then-closed.
    const hostsSeen: string[] = [];
    const wss = new WebSocketServer({
      port: 0,
      verifyClient: ({ req }, done) => {
        const host = String(req.headers.host ?? "");
        hostsSeen.push(host);
        done(host.split(":")[0].toLowerCase() === "localhost", 403);
      },
    });
    servers.push(wss);
    await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
    wss.on("connection", (ws: WsSocket) => {
      ws.send(JSON.stringify({ jsonrpc: "2.0", method: "event", params: { type: "gateway.ready", payload: {} } }));
    });
    const { port } = wss.address() as AddressInfo;

    const { HermesAgentJsonRpcClient } = await import("../../server/hermes-agent/jsonrpc-client");
    const client = new HermesAgentJsonRpcClient({ url: `ws://127.0.0.1:${port}`, token: "t" });
    client.hostHeader = "box.ts.net";

    const ready = new Promise<void>((resolve, reject) => {
      client.on("ready", () => resolve());
      client.on("error", (e: Error) => reject(e));
      setTimeout(() => reject(new Error("never became ready")), 5000);
    });
    client.connect();
    await ready;

    expect(hostsSeen[0]).toBe("box.ts.net");
    expect(hostsSeen[1]).toBe("localhost");
    client.terminate();
  });

  it("gives up after one retry rather than looping", async () => {
    const wss = new WebSocketServer({ port: 0 });
    servers.push(wss);
    await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
    let attempts = 0;
    wss.on("connection", (ws: WsSocket) => {
      attempts += 1;
      ws.close(4403, "host_mismatch");
    });
    const { port } = wss.address() as AddressInfo;

    const { HermesAgentJsonRpcClient } = await import("../../server/hermes-agent/jsonrpc-client");
    const client = new HermesAgentJsonRpcClient({ url: `ws://127.0.0.1:${port}`, token: "t" });

    const closed = new Promise<number>((resolve) => client.on("close", (code: number) => resolve(code)));
    client.connect();
    expect(await closed).toBe(4403);
    expect(attempts).toBe(2);
  });
});

describe("profiles as agents", () => {
  // Verbatim rows from a live hermes-agent `profiles.list`.
  const backendProfiles = [
    {
      name: "default",
      path: "/Users/lukeai1/.hermes",
      is_default: true,
      model: "claude-haiku-4-5-20251001",
      description: "",
      display_name: "",
    },
    {
      name: "allan",
      path: "/Users/lukeai1/.hermes/profiles/allan",
      is_default: false,
      model: "claude-haiku-4-5-20251001",
      description:
        "Allan — technical planner and business systems analyst for Smartways. Converts Jira tickets into plans.",
      display_name: "",
    },
    {
      name: "andrew",
      path: "/Users/lukeai1/.hermes/profiles/andrew",
      is_default: false,
      model: "claude-opus-4-8",
      description: "Andrew — senior full-stack software developer for Smartways.",
      display_name: "",
    },
  ];

  it("gives every profile its own agent", async () => {
    const { toHermes3dAgents } = await import("../../server/hermes-agent/bridge");
    const agents = toHermes3dAgents(backendProfiles);
    expect(agents.map((a) => a.id)).toEqual(["default", "allan", "andrew"]);
    expect(agents.map((a) => a.name)).toEqual(["Default", "Allan", "Andrew"]);
  });

  it("routes non-default agents by profile and leaves the default unnamed", async () => {
    const { toHermes3dAgents } = await import("../../server/hermes-agent/bridge");
    const [def, allan] = toHermes3dAgents(backendProfiles);
    // An empty profile means "launch profile" upstream; naming it is wrong.
    expect(def.profile).toBe("");
    expect(allan.profile).toBe("allan");
  });

  it("uses the description after the dash as the role", async () => {
    const { toHermes3dAgents } = await import("../../server/hermes-agent/bridge");
    const allan = toHermes3dAgents(backendProfiles)[1];
    expect(allan.role.startsWith("technical planner")).toBe(true);
  });

  it("picks the flagged profile as the default agent", async () => {
    const { toHermes3dAgents, resolveDefaultAgentId } = await import(
      "../../server/hermes-agent/bridge"
    );
    expect(resolveDefaultAgentId(toHermes3dAgents(backendProfiles))).toBe("default");
  });

  it("ignores unusable rows", async () => {
    const { toHermes3dAgents } = await import("../../server/hermes-agent/bridge");
    expect(toHermes3dAgents([null, {}, "x", { name: "" }])).toEqual([]);
    expect(toHermes3dAgents(undefined)).toEqual([]);
  });

  it("advertises every profile and creates sessions against the right one", async () => {
    const createCalls: Frame[] = [];
    const agent = await startFakeHermesAgent({
      "profiles.list": () => ({ profiles: backendProfiles }),
      "session.create": (params) => {
        createCalls.push(params);
        return { session_id: `rt-${createCalls.length}` };
      },
      "prompt.submit": () => ({}),
    });
    const bridge = await openBridge(agent.url);

    bridge.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge.waitFor((f) => f.type === "res" && f.id === "c1", "hello-ok");

    bridge.send({ type: "req", id: "a1", method: "agents.list", params: {} });
    const listed = await bridge.waitFor((f) => f.type === "res" && f.id === "a1", "agents.list");
    expect((at(listed, "payload.agents") as unknown[]).length).toBe(3);

    // A prompt aimed at Allan's desk must run under Allan's profile.
    bridge.send({
      type: "req",
      id: "s1",
      method: "chat.send",
      params: { sessionKey: "agent:allan:main", message: "hi" },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "s1", "chat.send");
    expect(createCalls.at(-1)).toEqual({ profile: "allan" });

    // The default agent must NOT send a profile — that means "launch profile".
    bridge.send({
      type: "req",
      id: "s2",
      method: "chat.send",
      params: { sessionKey: "agent:default:main", message: "hi" },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "s2", "chat.send default");
    expect(createCalls.at(-1)).toEqual({});
  });

  it("falls back to a single agent when the backend has no profiles.list", async () => {
    const agent = await startFakeHermesAgent({});
    const bridge = await openBridge(agent.url);
    bridge.send({ type: "req", id: "c1", method: "connect", params: {} });
    const res = await bridge.waitFor((f) => f.type === "res" && f.id === "c1", "hello-ok");
    expect((at(res, "payload.snapshot.health.agents") as unknown[]).length).toBe(1);
    expect(at(res, "payload.snapshot.health.defaultAgentId")).toBe("hermes");
  });
});

describe("toHermes3dCronJobs", () => {
  // Verbatim row shape returned by a live hermes-agent `cron.manage` list.
  const agentJob = {
    job_id: "f43da87997a8",
    name: "Daily token spend - morning briefing",
    prompt_preview: "Run `hermes insights --days 1` and extract today's data.",
    schedule: "0 7 * * *",
    repeat: "forever",
    deliver: "origin",
    next_run_at: "2026-08-19T07:00:00-05:00",
    last_run_at: "2026-08-18T07:00:40.472539-05:00",
    last_status: "ok",
    last_delivery_error: null,
    last_fire_error: null,
    enabled: true,
    state: "scheduled",
  };

  it("fills in the fields the office task board reads unguarded", async () => {
    const { toHermes3dCronJobs } = await import("../../server/hermes-agent/bridge");
    const [job] = toHermes3dCronJobs([agentJob]);

    // These four are exactly what crashed the office page when forwarded raw.
    expect(job.id).toBe("f43da87997a8");
    expect(job.payload).toEqual({ kind: "agentTurn", message: agentJob.prompt_preview });
    expect(job.schedule).toEqual({ kind: "cron", expr: "0 7 * * *" });
    expect(typeof job.state).toBe("object");
    expect(job.state.lastStatus).toBe("ok");
    expect(job.state.nextRunAtMs).toBe(Date.parse(agentJob.next_run_at));
    expect(Number.isFinite(job.updatedAtMs)).toBe(true);
  });

  it("marks a running job so the board can show it as working", async () => {
    const { toHermes3dCronJobs } = await import("../../server/hermes-agent/bridge");
    const [job] = toHermes3dCronJobs([{ ...agentJob, state: "running" }]);
    expect(typeof job.state.runningAtMs).toBe("number");
  });

  it("surfaces a failure so the board can flag it", async () => {
    const { toHermes3dCronJobs } = await import("../../server/hermes-agent/bridge");
    const [job] = toHermes3dCronJobs([
      { ...agentJob, last_status: "error", last_fire_error: "boom" },
    ]);
    expect(job.state.lastStatus).toBe("error");
    expect(job.state.lastError).toBe("boom");
  });

  it("drops rows with no id and tolerates junk", async () => {
    const { toHermes3dCronJobs } = await import("../../server/hermes-agent/bridge");
    expect(toHermes3dCronJobs([{}, null, "nope", { name: "no id" }])).toEqual([]);
    expect(toHermes3dCronJobs(undefined)).toEqual([]);
  });

  it("reads the other schedule spellings hermes-agent emits", async () => {
    const { toHermes3dSchedule } = await import("../../server/hermes-agent/bridge");
    expect(toHermes3dSchedule("30m")).toEqual({ kind: "every", everyMs: 1_800_000 });
    expect(toHermes3dSchedule("every 2h")).toEqual({ kind: "every", everyMs: 7_200_000 });
    expect(toHermes3dSchedule("0 9 * * *")).toEqual({ kind: "cron", expr: "0 9 * * *" });
    expect(toHermes3dSchedule("2026-06-01T09:00:00Z")).toEqual({
      kind: "at",
      at: "2026-06-01T09:00:00Z",
    });
  });
});

describe("toHermes3dMessages", () => {
  it("renames text to content and drops non-conversational rows", () => {
    expect(
      toHermes3dMessages([
        { role: "user", text: "hi" },
        { role: "tool", name: "terminal" },
        { role: "assistant", text: "hello" },
      ]),
    ).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("returns an empty list for a missing transcript", () => {
    expect(toHermes3dMessages(undefined)).toEqual([]);
  });
});

describe("resolveRoutingTarget", () => {
  // Regression coverage for the Codex review finding (2026-08-31): the
  // Frontdoor Router classifies against a fixed, hard-coded profile-name
  // vocabulary that has no visibility into what the backend actually
  // serves, so every classified target has to be re-checked against the
  // live roster before anything routes or reports on it.
  const specialistRoster = [
    { id: "sol", profile: "", model: "gpt-5.6-sol", isDefault: true },
    {
      id: "router-opencode",
      profile: "router-opencode",
      model: "nemotron-3-ultra-free",
    },
  ];

  it("resolves an existing specialist target as-is", async () => {
    const { resolveRoutingTarget } = await import("../../server/hermes-agent/bridge");
    const resolved = resolveRoutingTarget(specialistRoster, "sol", "router-opencode", "sol");
    expect(resolved).toEqual({
      targetAgentId: "router-opencode",
      targetProfile: "router-opencode",
      targetModel: "nemotron-3-ultra-free",
    });
  });

  it("falls back to the caller when the classified target isn't in the live roster", async () => {
    const { resolveRoutingTarget } = await import("../../server/hermes-agent/bridge");
    // router-claude-review is a real category target in frontdoor-router.js,
    // but this backend never advertised it (e.g. the profile isn't
    // configured on this machine).
    const resolved = resolveRoutingTarget(
      specialistRoster,
      "sol",
      "router-claude-review",
      "sol",
    );
    expect(resolved).toEqual({ targetAgentId: "sol", targetProfile: "", targetModel: "gpt-5.6-sol" });
  });

  it("remaps the classifier's 'default' sentinel to the real default agent id", async () => {
    const { resolveRoutingTarget } = await import("../../server/hermes-agent/bridge");
    // The runtime's default agent is "sol", not literally "default" — the
    // classifier only ever emits the literal sentinel.
    const resolved = resolveRoutingTarget(specialistRoster, "sol", "default", "sol");
    expect(resolved.targetAgentId).toBe("sol");
  });

  it("falls back past a caller that has also dropped out of the roster", async () => {
    const { resolveRoutingTarget } = await import("../../server/hermes-agent/bridge");
    const resolved = resolveRoutingTarget(
      specialistRoster,
      "sol",
      "router-claude-review",
      "ghost-caller",
    );
    expect(resolved.targetAgentId).toBe("sol");
  });

  it("never throws even against a genuinely empty roster", async () => {
    const { resolveRoutingTarget } = await import("../../server/hermes-agent/bridge");
    const resolved = resolveRoutingTarget([], "sol", "router-opencode", "caller-x");
    expect(resolved).toEqual({ targetAgentId: "caller-x", targetProfile: "", targetModel: "" });
  });

  // Regression coverage for the Codex review finding (P2, 2026-09-01): a
  // roster can legitimately contain a real, unrelated specialist profile
  // whose id happens to literally be "default" — that must never be
  // confused with the classifier's "default" SENTINEL (meaning "stay on
  // whatever the real default agent is"), which has to be remapped to
  // defaultAgentId before it's ever checked against the roster at all.
  const rosterWithForeignDefaultNamedProfile = [
    { id: "sol", profile: "", model: "gpt-5.6-sol", isDefault: true },
    { id: "default", profile: "default", model: "some-other-model" },
    { id: "router-opencode", profile: "router-opencode", model: "nemotron-3-ultra-free" },
  ];

  it("resolves the 'default' sentinel to the real default agent, not a roster profile literally named 'default'", async () => {
    const { resolveRoutingTarget } = await import("../../server/hermes-agent/bridge");
    // Simulates COMPLEX_OR_UNCLEAR / MOA_REQUESTED classifications, which
    // both emit the literal "default" sentinel from frontdoor-router.js.
    const resolved = resolveRoutingTarget(rosterWithForeignDefaultNamedProfile, "sol", "default", "sol");
    expect(resolved).toEqual({ targetAgentId: "sol", targetProfile: "", targetModel: "gpt-5.6-sol" });
  });

  it("still routes to a real specialist target when the roster also has a profile literally named 'default'", async () => {
    const { resolveRoutingTarget } = await import("../../server/hermes-agent/bridge");
    const resolved = resolveRoutingTarget(
      rosterWithForeignDefaultNamedProfile,
      "sol",
      "router-opencode",
      "sol",
    );
    expect(resolved).toEqual({
      targetAgentId: "router-opencode",
      targetProfile: "router-opencode",
      targetModel: "nemotron-3-ultra-free",
    });
  });
});

describe("Frontdoor Router: routing survives an unavailable target", () => {
  it("keeps event/profile/session in agreement instead of silently using the launch profile", async () => {
    const createCalls: Frame[] = [];
    // Deliberately omit router-claude-review from the served profiles, so
    // the classifier's hard-coded target for a critical-review message
    // doesn't exist on this backend.
    const agent = await startFakeHermesAgent({
      "profiles.list": () => ({
        profiles: [
          { name: "sol", is_default: true, model: "gpt-5.6-sol", description: "" },
        ],
      }),
      // startFakeHermesAgent's emit() always tags events with session_id
      // "s1" (see its definition above) regardless of what session.create
      // actually returns, so the fake session id has to match that fixed
      // tag or the bridge's sessionKeyByRuntimeId lookup misses and the
      // event is silently dropped.
      "session.create": (params) => {
        createCalls.push(params);
        return { session_id: "s1" };
      },
      "prompt.submit": (_params, emit) => {
        setTimeout(() => emit("message.complete", { text: "ok", status: "complete" }), 5);
        return { status: "streaming" };
      },
    });
    const bridge = await openBridge(agent.url);

    bridge.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge.waitFor((f) => f.type === "res" && f.id === "c1", "hello-ok");

    bridge.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: {
        sessionKey: "agent:sol:main",
        message: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion.",
        idempotencyKey: "run-critical-1",
      },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");

    const selected = await bridge.waitFor(
      (f) => f.event === "routing.selected",
      "routing.selected",
    );
    // The classifier wanted router-claude-review; it isn't on the roster,
    // so the event must report what actually ran (the caller, "sol") —
    // never a specialist that was never really invoked.
    expect(at(selected, "payload.targetAgentId")).toBe("sol");

    const started = await bridge.waitFor((f) => f.event === "routing.started", "routing.started");
    expect(at(started, "payload.targetAgentId")).toBe("sol");

    await bridge.waitFor((f) => f.event === "routing.completed", "routing.completed");

    // And the session that was actually created must match: "sol" is the
    // default agent, so profile is omitted (launch profile) — not silently
    // created under some other implicit profile while the event lied about it.
    expect(createCalls).toEqual([{}]);
  });
});

describe("hermes-agent bridge", () => {
  it("sends the token as a query param on /api/ws", async () => {
    const agent = await startFakeHermesAgent({});
    await openBridge(agent.url, "tok-123");

    expect(agent.received.find((frame) => frame.__connect)).toMatchObject({
      path: "/api/ws",
      token: "tok-123",
    });
  });

  it("answers connect with a hello-ok advertising one agent", async () => {
    const agent = await startFakeHermesAgent({});
    const bridge = await openBridge(agent.url);

    bridge.send({ type: "req", id: "c1", method: "connect", params: {} });
    const res = await bridge.waitFor((f) => f.type === "res" && f.id === "c1", "hello-ok");

    expect(res.ok).toBe(true);
    expect(at(res, "payload.type")).toBe("hello-ok");
    expect(at(res, "payload.snapshot.health.agents")).toHaveLength(1);
    expect(at(res, "payload.snapshot.health.defaultAgentId")).toBe("hermes");
  });

  it("turns chat.send into prompt.submit and streams deltas into chat events", async () => {
    const agent = await startFakeHermesAgent({
      "session.create": () => ({ session_id: "s1", stored_session_id: "stored-1" }),
      "prompt.submit": (_params, emit) => {
        setTimeout(() => {
          emit("message.start", {});
          emit("message.delta", { text: "Hel" });
          emit("message.delta", { text: "lo" });
          emit("message.complete", { text: "Hello", status: "complete" });
        }, 10);
        return { status: "streaming" };
      },
    });
    const bridge = await openBridge(agent.url);

    bridge.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: { sessionKey: "agent:hermes:main", message: "hi", idempotencyKey: "run-1" },
    });

    const started = await bridge.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");
    expect(started.payload).toMatchObject({ status: "started", runId: "run-1" });

    const submitted = agent.received.find((frame) => frame.method === "prompt.submit");
    expect(submitted?.params).toMatchObject({ session_id: "s1", text: "hi" });

    const final = await bridge.waitFor(
      (f) => f.event === "chat" && at(f, "payload.state") === "final",
      "final chat event",
    );
    expect(at(final, "payload.message")).toEqual({ role: "assistant", content: "Hello" });
    expect(at(final, "payload.runId")).toBe("run-1");

    // Deltas accumulate, so the browser always receives the full text so far.
    const deltas = bridge.frames.filter(
      (f) => f.event === "chat" && at(f, "payload.state") === "delta",
    );
    expect(deltas.map((frame) => at(frame, "payload.message.content"))).toEqual(["Hel", "Hello"]);
  });

  it("reports a failed prompt as an error response rather than a silent hang", async () => {
    const agent = await startFakeHermesAgent({
      "session.create": () => ({ session_id: "s1" }),
    });
    const bridge = await openBridge(agent.url);

    bridge.send({
      type: "req",
      id: "m2",
      method: "chat.send",
      params: { sessionKey: "agent:hermes:main", message: "hi" },
    });

    const res = await bridge.waitFor((f) => f.type === "res" && f.id === "m2", "chat.send failure");
    expect(res.ok).toBe(false);
    expect(at(res, "error.code")).toBe("hermes_agent.prompt_failed");
  });

  it("maps chat.abort onto session.interrupt", async () => {
    const agent = await startFakeHermesAgent({
      "session.create": () => ({ session_id: "s1" }),
      "prompt.submit": () => ({ status: "streaming" }),
      "session.interrupt": () => ({ status: "interrupted" }),
    });
    const bridge = await openBridge(agent.url);

    bridge.send({
      type: "req",
      id: "m3",
      method: "chat.send",
      params: { sessionKey: "agent:hermes:main", message: "hi", idempotencyKey: "run-9" },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "m3", "chat.send res");

    bridge.send({ type: "req", id: "a1", method: "chat.abort", params: { runId: "run-9" } });
    const res = await bridge.waitFor((f) => f.type === "res" && f.id === "a1", "abort res");

    expect(res.payload).toMatchObject({ ok: true, aborted: 1 });
    expect(agent.received.some((frame) => frame.method === "session.interrupt")).toBe(true);
  });

  it("surfaces stored hermes-agent sessions alongside the main key", async () => {
    const agent = await startFakeHermesAgent({
      "session.list": () => ({
        sessions: [{ id: "20260409_abc", title: "Yesterday's chat", started_at: 1000 }],
      }),
    });
    const bridge = await openBridge(agent.url);

    bridge.send({ type: "req", id: "s1", method: "sessions.list", params: {} });
    const res = await bridge.waitFor((f) => f.type === "res" && f.id === "s1", "sessions.list");

    const sessions = at(res, "payload.sessions") as { key: string }[];
    expect(sessions.map((session) => session.key)).toEqual(
      expect.arrayContaining(["agent:hermes:main", "agent:hermes:20260409_abc"]),
    );
  });

  it("keeps working when an optional upstream method is unavailable", async () => {
    const agent = await startFakeHermesAgent({});
    const bridge = await openBridge(agent.url);

    bridge.send({ type: "req", id: "k1", method: "models.list", params: {} });
    const res = await bridge.waitFor((f) => f.type === "res" && f.id === "k1", "models.list");

    expect(res.ok).toBe(true);
    expect(at(res, "payload.models")).not.toHaveLength(0);
  });
});

describe("routed-turn ledger (recovering routed replies for the caller's own session)", () => {
  it("appends without mutating the input index", async () => {
    const { appendRoutedTurnLedgerEntry } = await import("../../server/hermes-agent/bridge");
    const original = { "agent:default:main": { turns: [{ kind: "own", count: 2 }], droppedOwnCount: 0 } };

    const next = appendRoutedTurnLedgerEntry(original, "agent:default:main", {
      kind: "routed",
      targetAgentId: "allan",
      storedId: "r1",
    });

    expect(original["agent:default:main"].turns).toHaveLength(1);
    expect(next["agent:default:main"].turns).toHaveLength(2);
    expect(next["agent:default:main"].turns[1]).toMatchObject({ kind: "routed", targetAgentId: "allan" });
    expect(next["agent:default:main"].droppedOwnCount).toBe(0);
  });

  it("also accepts a legacy bare-array ledger value (pre-P2-fix on-disk shape) and upgrades it", async () => {
    const { appendRoutedTurnLedgerEntry } = await import("../../server/hermes-agent/bridge");
    const legacy = { "agent:default:main": [{ kind: "own", count: 2 }] };

    const next = appendRoutedTurnLedgerEntry(legacy, "agent:default:main", {
      kind: "routed",
      targetAgentId: "allan",
      storedId: "r1",
    });

    expect(next["agent:default:main"]).toEqual({
      turns: [{ kind: "own", count: 2 }, { kind: "routed", targetAgentId: "allan", storedId: "r1" }],
      droppedOwnCount: 0,
      ownStoredId: "",
    });
  });

  it("caps entries at 200 and folds dropped own-turn weight into droppedOwnCount", async () => {
    const { appendRoutedTurnLedgerEntry } = await import("../../server/hermes-agent/bridge");

    // 210 alternating turns: even index -> own (weight 2), odd index -> routed (weight 0).
    // 10 of them get dropped by the cap (indices 0..9): 5 own (weight 2 each = 10) + 5 routed.
    let index: Record<string, unknown> = {};
    for (let i = 0; i < 210; i += 1) {
      const entry = i % 2 === 0 ? { kind: "own", count: 2, i } : { kind: "routed", targetAgentId: "allan", storedId: `r${i}`, i };
      index = appendRoutedTurnLedgerEntry(index, "k", entry);
    }

    const state = (index as Record<string, { turns: { i: number }[]; droppedOwnCount: number }>).k;
    expect(state.turns).toHaveLength(200);
    expect(state.turns[0].i).toBe(10);
    expect(state.turns[199].i).toBe(209);
    expect(state.droppedOwnCount).toBe(10); // 5 dropped own turns * count 2

    // Boundary: exactly at the cap, nothing is dropped yet.
    let atCap: Record<string, unknown> = {};
    for (let i = 0; i < 200; i += 1) {
      atCap = appendRoutedTurnLedgerEntry(atCap, "k", { kind: "own", count: 2, i });
    }
    const atCapState = (atCap as Record<string, { turns: { i: number }[]; droppedOwnCount: number }>).k;
    expect(atCapState.turns).toHaveLength(200);
    expect(atCapState.droppedOwnCount).toBe(0);

    // One turn over the cap: exactly the single oldest own turn is dropped.
    const overCap = appendRoutedTurnLedgerEntry(atCap, "k", { kind: "own", count: 2, i: 200 });
    const overCapState = (overCap as Record<string, { turns: { i: number }[]; droppedOwnCount: number }>).k;
    expect(overCapState.turns).toHaveLength(200);
    expect(overCapState.turns[0].i).toBe(1);
    expect(overCapState.droppedOwnCount).toBe(2);
  });

  it("mergeRoutedTurnLedger uses droppedOwnCount to skip past own messages consumed by pruned turns, without duplicating or losing any", async () => {
    const { mergeRoutedTurnLedger } = await import("../../server/hermes-agent/bridge");

    // Simulates the state appendRoutedTurnLedgerEntry produces once an
    // own(2) turn and a routed turn have been pruned off the front by
    // capping — droppedOwnCount:2 records the own-message weight pruning
    // already accounted for.
    const ledgerState = {
      turns: [
        { kind: "own", count: 2 },
        { kind: "routed", targetAgentId: "allan", storedId: "spec-new" },
      ],
      droppedOwnCount: 2,
    };

    // The first 2 own messages belong to the PRUNED own turn and must be
    // skipped entirely (never replayed); the last 2 belong to the turn
    // still in the ledger.
    const ownMessages = [
      { role: "user", content: "pruned question (must not reappear)" },
      { role: "assistant", content: "pruned answer (must not reappear)" },
      { role: "user", content: "surviving own question" },
      { role: "assistant", content: "surviving own answer" },
    ];
    const fetchRoutedMessages = async (storedId: string) => {
      expect(storedId).toBe("spec-new"); // the pruned "spec-old" would never be fetched
      return [
        { role: "user", content: "routed question" },
        { role: "assistant", content: "routed answer" },
      ];
    };

    const merged = await mergeRoutedTurnLedger(ledgerState, ownMessages, fetchRoutedMessages);

    expect(merged.map((m) => m.content)).toEqual([
      "surviving own question",
      "surviving own answer",
      "routed question",
      "routed answer",
    ]);
  });

  it("removeLedgerEntry drops a sessionKey's ledger entirely, without touching others", async () => {
    const { appendRoutedTurnLedgerEntry, removeLedgerEntry } = await import("../../server/hermes-agent/bridge");

    let index: Record<string, unknown> = {};
    index = appendRoutedTurnLedgerEntry(index, "agent:default:main", {
      kind: "routed",
      targetAgentId: "allan",
      storedId: "r1",
    });
    index = appendRoutedTurnLedgerEntry(index, "agent:allan:main", {
      kind: "own",
      count: 2,
    });

    const next = removeLedgerEntry(index, "agent:default:main");
    expect("agent:default:main" in next).toBe(false);
    expect("agent:allan:main" in next).toBe(true); // untouched

    const noop = removeLedgerEntry(next, "agent:default:main");
    expect(noop).toBe(next); // pure no-op when there's nothing to remove
  });

  it("resolveBackendId gives different upstream URLs different, stable ids", async () => {
    const { resolveBackendId } = await import("../../server/hermes-agent/bridge");

    const a1 = resolveBackendId("http://localhost:8642");
    const a2 = resolveBackendId("http://localhost:8642");
    const b = resolveBackendId("http://localhost:18789");

    expect(a1).toBe(a2); // same backend, same run -> stable
    expect(a1).not.toBe(b); // different backend -> different ledger, never mixed (Codex review finding, P1, 2026-09-01)
    expect(a1).toMatch(/^[0-9a-f]{16}$/);
  });

  it("normalizeLedgerState defensively handles garbage instead of throwing", async () => {
    const { normalizeLedgerState } = await import("../../server/hermes-agent/bridge");

    expect(normalizeLedgerState(undefined)).toEqual({ turns: [], droppedOwnCount: 0, ownStoredId: "" });
    expect(normalizeLedgerState(null)).toEqual({ turns: [], droppedOwnCount: 0, ownStoredId: "" });
    expect(normalizeLedgerState("not an object")).toEqual({ turns: [], droppedOwnCount: 0, ownStoredId: "" });
    expect(normalizeLedgerState({ turns: "not an array", droppedOwnCount: 5 })).toEqual({
      turns: [],
      droppedOwnCount: 0,
      ownStoredId: "",
    });
    expect(
      normalizeLedgerState({ turns: [{ kind: "own", count: 2 }], droppedOwnCount: -3, ownStoredId: 42 })
    ).toEqual({
      turns: [{ kind: "own", count: 2 }],
      droppedOwnCount: 0,
      ownStoredId: "",
    });
    expect(
      normalizeLedgerState({ turns: [], droppedOwnCount: 0, ownStoredId: "stored-abc" })
    ).toEqual({ turns: [], droppedOwnCount: 0, ownStoredId: "stored-abc" });
    // Legacy pre-P2-fix shape: a bare array, no droppedOwnCount/ownStoredId at all.
    expect(normalizeLedgerState([{ kind: "own", count: 2 }])).toEqual({
      turns: [{ kind: "own", count: 2 }],
      droppedOwnCount: 0,
      ownStoredId: "",
    });
  });

  it("reassembles own and routed turns in ledger order", async () => {
    const { mergeRoutedTurnLedger } = await import("../../server/hermes-agent/bridge");
    const ownMessages = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "thanks" },
      { role: "assistant", content: "np" },
    ];
    const ledger = [
      { kind: "own", count: 2 },
      { kind: "routed", targetAgentId: "allan", storedId: "spec-1" },
      { kind: "own", count: 2 },
    ];
    const fetchRoutedMessages = async (storedId: string) => {
      expect(storedId).toBe("spec-1");
      return [
        { role: "user", content: "routed question" },
        { role: "assistant", content: "routed answer" },
      ];
    };

    const merged = await mergeRoutedTurnLedger(ledger, ownMessages, fetchRoutedMessages);

    expect(merged.map((m) => m.content)).toEqual([
      "hi",
      "hello",
      "routed question",
      "routed answer",
      "thanks",
      "np",
    ]);
  });

  it("appends own messages that predate ledger tracking at the end instead of dropping them", async () => {
    const { mergeRoutedTurnLedger } = await import("../../server/hermes-agent/bridge");
    const ownMessages = [
      { role: "user", content: "old message" },
      { role: "assistant", content: "old reply" },
    ];
    const ledger = [{ kind: "routed", targetAgentId: "allan", storedId: "spec-1" }];

    const merged = await mergeRoutedTurnLedger(ledger, ownMessages, async () => [
      { role: "user", content: "routed question" },
      { role: "assistant", content: "routed answer" },
    ]);

    expect(merged.map((m) => m.content)).toEqual([
      "routed question",
      "routed answer",
      "old message",
      "old reply",
    ]);
  });
});

describe("routed turns survive a simulated page reload", () => {
  let tempStateDir = "";
  let originalStateDir: string | undefined;

  /** The ledger file is namespaced per upstream backend (see resolveBackendId) — compute its path the same way bridge.js does. */
  const ledgerPathFor = async (agentUrl: string) => {
    const { resolveBackendId } = await import("../../server/hermes-agent/bridge");
    return path.join(tempStateDir, "hermes3d", `routed-turns.${resolveBackendId(agentUrl)}.json`);
  };

  beforeEach(() => {
    originalStateDir = process.env.HERMES_STATE_DIR;
    tempStateDir = fs.mkdtempSync(path.join(os.tmpdir(), "hermes3d-ledger-"));
    process.env.HERMES_STATE_DIR = tempStateDir;
  });

  afterEach(() => {
    if (originalStateDir === undefined) delete process.env.HERMES_STATE_DIR;
    else process.env.HERMES_STATE_DIR = originalStateDir;
    fs.rmSync(tempStateDir, { recursive: true, force: true });
  });

  /**
   * Like startFakeHermesAgent above, but models CONNECTION SCOPING for
   * session ids — confirmed live against the real gateway (2026-09-01):
   * a runtime `session_id` from session.create/session.resume only
   * resolves on the hermes-agent connection that issued it and 404s with
   * "session not found" once that connection closes, even though the
   * underlying conversation is durably addressable by its
   * `stored_session_id` via session.resume from ANY connection. A bridge
   * instance opens a brand new hermes-agent connection every time (one per
   * browser WS connection — see gateway-proxy.js), so this distinction is
   * exactly what a page reload exercises and the naive fake server used
   * before this fix couldn't catch.
   *
   * `durableById` (stored_session_id -> messages) is shared across every
   * connection to this server, like hermes-agent's own session store;
   * `liveRuntimeIds` is scoped per-connection, like a real runtime
   * session_id.
   */
  const startRoutingAwareFakeHermesAgent = async () => {
    const wss = new WebSocketServer({ port: 0 });
    servers.push(wss);
    await new Promise<void>((resolve) => wss.on("listening", () => resolve()));

    const durableById = new Map<string, { role: string; content: string }[]>();
    const runtimeToStored = new Map<string, string>();
    let counter = 0;

    wss.on("connection", (ws: WsSocket) => {
      const liveRuntimeIds = new Set<string>();

      const send = (obj: unknown) => ws.send(JSON.stringify(obj));
      const emitFor = (sessionId: string, type: string, payload: Frame) =>
        send({ jsonrpc: "2.0", method: "event", params: { type, session_id: sessionId, payload } });

      send({ jsonrpc: "2.0", method: "event", params: { type: "gateway.ready", payload: {} } });

      ws.on("message", (raw) => {
        const request = JSON.parse(String(raw)) as Frame & { method?: string; id?: unknown };
        const params = (request.params ?? {}) as Frame;
        const respond = (result: Frame) => send({ jsonrpc: "2.0", id: request.id, result });
        const respondError = (message: string) =>
          send({ jsonrpc: "2.0", id: request.id, error: { code: -32000, message } });

        switch (request.method) {
          case "profiles.list":
            respond({
              profiles: [
                { name: "default", is_default: true, model: "gpt-5.6-sol" },
                { name: "router-claude-review", is_default: false, model: "claude-review-model" },
              ],
            });
            return;
          case "session.create": {
            counter += 1;
            const sessionId = `sess-${counter}`;
            const storedId = `stored-${counter}`;
            durableById.set(storedId, []);
            runtimeToStored.set(sessionId, storedId);
            liveRuntimeIds.add(sessionId);
            respond({ session_id: sessionId, stored_session_id: storedId });
            return;
          }
          case "session.resume": {
            // A synthetic, never-created id (bridge.js's own made-up
            // `routed-<runId>` tail) isn't in durableById and correctly
            // 404s here, exactly like real hermes-agent — forcing
            // ensureSession to fall through to session.create.
            const requestedId = String(params.session_id ?? "");
            if (!durableById.has(requestedId)) {
              respondError("session not found");
              return;
            }
            counter += 1;
            const freshRuntimeId = `sess-${counter}`;
            runtimeToStored.set(freshRuntimeId, requestedId);
            liveRuntimeIds.add(freshRuntimeId);
            respond({
              session_id: freshRuntimeId,
              stored_session_id: requestedId,
              ...(params.omit_messages === false ? { messages: durableById.get(requestedId) ?? [] } : {}),
            });
            return;
          }
          case "session.history": {
            const sessionId = String(params.session_id ?? "");
            if (!liveRuntimeIds.has(sessionId)) {
              respondError("session not found");
              return;
            }
            const storedId = runtimeToStored.get(sessionId);
            respond({ messages: storedId ? (durableById.get(storedId) ?? []) : [] });
            return;
          }
          case "prompt.submit": {
            const sessionId = String(params.session_id ?? "");
            const text = String(params.text ?? "");
            const reply = `reply-to:${text}`;
            const storedId = runtimeToStored.get(sessionId);
            const log = storedId ? (durableById.get(storedId) ?? []) : [];
            log.push({ role: "user", content: text }, { role: "assistant", content: reply });
            if (storedId) durableById.set(storedId, log);
            setTimeout(() => emitFor(sessionId, "message.complete", { text: reply, status: "complete" }), 5);
            respond({ status: "streaming" });
            return;
          }
          default:
            respond({});
        }
      });
    });

    const { port } = wss.address() as AddressInfo;
    // durableById is exposed so a test can pre-seed a session's history
    // directly (simulating "the caller already had messages before this
    // test starts observing") without routing through the bridge's own
    // (deliberately still-open, see the note above chat.send's frontdoor
    // block) "classified-but-not-rerouted" path.
    return { url: `ws://127.0.0.1:${port}`, durableById };
  };

  it("recovers a routed exchange through the caller's own chat.history after the bridge restarts", async () => {
    const agent = await startRoutingAwareFakeHermesAgent();

    // --- "page load #1": route a critical-review message from Default ---
    const bridge1 = await openBridge(agent.url);
    bridge1.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge1.waitFor((f) => f.type === "res" && f.id === "c1", "connect");

    bridge1.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion.",
        idempotencyKey: "run-1",
      },
    });
    await bridge1.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");
    const final1 = await bridge1.waitFor(
      (f) =>
        f.event === "chat" &&
        at(f, "payload.state") === "final" &&
        at(f, "payload.sessionKey") === "agent:default:main",
      "routed final chat event",
    );
    expect(at(final1, "payload.message.content")).toContain("reply-to:");
    await bridge1.waitFor((f) => f.event === "routing.completed", "routing.completed");

    bridge1.upstream.terminate();

    // --- "page reload": a brand new bridge instance, empty in-memory maps ---
    const bridge2 = await openBridge(agent.url);
    bridge2.send({ type: "req", id: "c2", method: "connect", params: {} });
    await bridge2.waitFor((f) => f.type === "res" && f.id === "c2", "connect");

    bridge2.send({ type: "req", id: "h1", method: "chat.history", params: { sessionKey: "agent:default:main" } });
    const historyRes = await bridge2.waitFor((f) => f.type === "res" && f.id === "h1", "chat.history");
    const messages = at(historyRes, "payload.messages") as { role: string; content: string }[];

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "user",
      content: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion.",
    });
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toContain("reply-to:");

    // --- a second routed message on the same reloaded bridge; order must hold ---
    bridge2.send({
      type: "req",
      id: "m2",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Noch ein Sicherheits-Review bitte, andere Datei.",
        idempotencyKey: "run-2",
      },
    });
    await bridge2.waitFor((f) => f.type === "res" && f.id === "m2", "chat.send res 2");
    await bridge2.waitFor(
      (f) => f.event === "routing.completed" && at(f, "payload.runId") === "run-2",
      "routing.completed 2",
    );

    bridge2.send({ type: "req", id: "h2", method: "chat.history", params: { sessionKey: "agent:default:main" } });
    const historyRes2 = await bridge2.waitFor((f) => f.type === "res" && f.id === "h2", "chat.history 2");
    const messages2 = at(historyRes2, "payload.messages") as { role: string; content: string }[];

    expect(messages2).toHaveLength(4);
    expect(messages2[0].content).toContain("Login-Funktion");
    expect(messages2[2].content).toContain("andere Datei");
    // Exactly one USER turn mentions "Login-Funktion" — the fake reply text
    // echoes the prompt, so checking the role too avoids a false positive
    // against run-1's own assistant reply.
    expect(messages2.filter((m) => m.role === "user" && m.content.includes("Login-Funktion"))).toHaveLength(1);

    // The on-disk ledger now uses the { turns, droppedOwnCount } shape,
    // not a bare array (P2 fix, 2026-08-31) — read it directly to confirm
    // that's really what got written, not just what mergeRoutedTurnLedger
    // tolerates as input.
    const ledgerPath = await ledgerPathFor(agent.url);
    const onDisk = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    expect(onDisk["agent:default:main"]).toMatchObject({
      turns: expect.any(Array),
      droppedOwnCount: expect.any(Number),
    });
  });

  it("persists a routed turn before reporting routing.completed, even when a slower seed lookup runs first", async () => {
    const agent = await startRoutingAwareFakeHermesAgent();
    const bridge1 = await openBridge(agent.url);
    bridge1.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge1.waitFor((f) => f.type === "res" && f.id === "c1", "connect");

    // Give the caller's own session some PRE-EXISTING history first, via
    // sessions.patch (which forces ensureSession for a real model change)
    // rather than a frontdoor "classified but not rerouted" message — this
    // is what makes recordCompletedTurn take its slower, awaited
    // "seed the ledger with prior history" branch on the very next routed
    // turn (see the doc comment on recordCompletedTurn), which is exactly
    // the race Codex flagged: routing.completed must still wait for it.
    bridge1.send({
      type: "req",
      id: "p1",
      method: "sessions.patch",
      params: { key: "agent:default:main", model: "gpt-5.6-sol" },
    });
    await bridge1.waitFor((f) => f.type === "res" && f.id === "p1", "sessions.patch res");
    const createdCallerSession = agent.durableById.size === 1 ? [...agent.durableById.keys()][0] : "";
    expect(createdCallerSession).not.toBe("");
    agent.durableById.set(createdCallerSession, [
      { role: "user", content: "earlier question" },
      { role: "assistant", content: "earlier answer" },
    ]);

    bridge1.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion.",
        idempotencyKey: "run-1",
      },
    });
    await bridge1.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");
    await bridge1.waitFor((f) => f.event === "routing.completed", "routing.completed");

    // No delay here on purpose — chat.history is requested on the very same
    // tick routing.completed was observed, the exact race Codex described.
    bridge1.send({ type: "req", id: "h1", method: "chat.history", params: { sessionKey: "agent:default:main" } });
    const historyRes = await bridge1.waitFor((f) => f.type === "res" && f.id === "h1", "chat.history");
    const messages = at(historyRes, "payload.messages") as { role: string; content: string }[];

    expect(messages).toEqual([
      { role: "user", content: "earlier question" },
      { role: "assistant", content: "earlier answer" },
      { role: "user", content: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion." },
      expect.objectContaining({ role: "assistant" }),
    ]);
    // The full reload case (a brand new bridge instance, ledger read back
    // from disk) is covered by "recovers a routed exchange..." above; this
    // test's own focus is specifically the same-bridge race between
    // routing.completed and the ledger write racing ahead of it.
  });

  it("never touches the ledger file for a conversation that never routes", async () => {
    const agent = await startRoutingAwareFakeHermesAgent();
    const bridge = await openBridge(agent.url);
    bridge.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge.waitFor((f) => f.type === "res" && f.id === "c1", "connect");

    // Sent directly to a specialist's own key, never through Default, so
    // the frontdoor router never runs — same as clicking that agent's card.
    bridge.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: {
        sessionKey: "agent:router-claude-review:main",
        message: "Hallo, wie geht es dir?",
        idempotencyKey: "run-1",
      },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");
    await bridge.waitFor((f) => f.event === "chat" && at(f, "payload.state") === "final", "final chat event");

    // Give the fire-and-forget ledger bookkeeping a moment to (not) run.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const ledgerPath = await ledgerPathFor(agent.url);
    expect(fs.existsSync(ledgerPath)).toBe(false);
  });

  it("records a same-agent frontdoor turn (classified but not rerouted) as own history, not routed", async () => {
    const agent = await startRoutingAwareFakeHermesAgent();
    const bridge = await openBridge(agent.url);
    bridge.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge.waitFor((f) => f.type === "res" && f.id === "c1", "connect");

    // Turn 1: an actual reroute, so the ledger becomes active for this session.
    bridge.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion.",
        idempotencyKey: "run-1",
      },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");
    await bridge.waitFor((f) => f.event === "routing.completed", "routing.completed 1");

    // Turn 2: frontdoor-classified (COMPLEX_OR_UNCLEAR, a "systemarchitektur"
    // keyword) but explicitly stays on Default — routing is still set, but
    // isReroute is false, so this must land in the ledger as "own", not a
    // second "routed" entry pointing at the caller's own runtime session
    // (Codex review finding, P1, 2026-09-01).
    bridge.send({
      type: "req",
      id: "m2",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Wie sollten wir die Gesamtarchitektur des Systems planen?",
        idempotencyKey: "run-2",
      },
    });
    const res2 = await bridge.waitFor((f) => f.type === "res" && f.id === "m2", "chat.send res 2");
    expect(res2.ok).toBe(true);
    // Confirm this really was the "stays on Default" branch, not a reroute.
    const selected2 = await bridge.waitFor(
      (f) => f.event === "routing.selected" && at(f, "payload.runId") === "run-2",
      "routing.selected 2",
    );
    expect(at(selected2, "payload.targetAgentId")).toBe("default");
    await bridge.waitFor(
      (f) => f.event === "routing.completed" && at(f, "payload.runId") === "run-2",
      "routing.completed 2",
    );

    bridge.send({ type: "req", id: "h1", method: "chat.history", params: { sessionKey: "agent:default:main" } });
    const historyRes = await bridge.waitFor((f) => f.type === "res" && f.id === "h1", "chat.history");
    const messages = at(historyRes, "payload.messages") as { role: string; content: string }[];

    // Exactly 4 messages (2 turns × 2) — the bug this guards against would
    // have re-fetched and duplicated the caller's own growing history on
    // turn 2's ledger entry instead of treating it as one more "own" turn.
    expect(messages).toHaveLength(4);
    expect(messages[0].content).toContain("Login-Funktion");
    expect(messages[2].content).toContain("Gesamtarchitektur");
    expect(messages.filter((m) => m.role === "user" && m.content.includes("Login-Funktion"))).toHaveLength(1);
    expect(messages.filter((m) => m.role === "user" && m.content.includes("Gesamtarchitektur"))).toHaveLength(1);

    const ledgerPath = await ledgerPathFor(agent.url);
    const onDisk = JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as Record<
      string,
      { turns: { kind: string }[] }
    >;
    expect(onDisk["agent:default:main"].turns.map((t) => t.kind)).toEqual(["routed", "own"]);
  });

  it("recovers the caller's own turns, not just routed ones, after a reload", async () => {
    const agent = await startRoutingAwareFakeHermesAgent();
    const bridge1 = await openBridge(agent.url);
    bridge1.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge1.waitFor((f) => f.type === "res" && f.id === "c1", "connect");

    // Turn 1: an actual reroute, activating the ledger for this session.
    bridge1.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion.",
        idempotencyKey: "run-1",
      },
    });
    await bridge1.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");
    await bridge1.waitFor((f) => f.event === "routing.completed", "routing.completed 1");

    // Turn 2: frontdoor-classified but stays on Default — this is what
    // actually creates the caller's OWN session (agent:default:main is
    // never ensureSession'd by a routed turn, only by one that stays put).
    bridge1.send({
      type: "req",
      id: "m2",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Wie sollten wir die Gesamtarchitektur des Systems planen?",
        idempotencyKey: "run-2",
      },
    });
    await bridge1.waitFor((f) => f.type === "res" && f.id === "m2", "chat.send res 2");
    await bridge1.waitFor(
      (f) => f.event === "routing.completed" && at(f, "payload.runId") === "run-2",
      "routing.completed 2",
    );

    bridge1.upstream.terminate();

    // --- "page reload": a brand new bridge instance, empty in-memory maps ---
    const bridge2 = await openBridge(agent.url);
    bridge2.send({ type: "req", id: "c2", method: "connect", params: {} });
    await bridge2.waitFor((f) => f.type === "res" && f.id === "c2", "connect");

    bridge2.send({ type: "req", id: "h1", method: "chat.history", params: { sessionKey: "agent:default:main" } });
    const historyRes = await bridge2.waitFor((f) => f.type === "res" && f.id === "h1", "chat.history");
    const messages = at(historyRes, "payload.messages") as { role: string; content: string }[];

    // Before the P1 fix, turn 2's own exchange vanished here entirely —
    // sessions.get() was empty in the fresh bridge and the ledger had no
    // durable way to find it, so only the routed turn survived.
    expect(messages).toHaveLength(4);
    expect(messages[0].content).toContain("Login-Funktion");
    expect(messages[2].content).toContain("Gesamtarchitektur");
    expect(messages.filter((m) => m.role === "user" && m.content.includes("Gesamtarchitektur"))).toHaveLength(1);
  });

  it("sessions.reset clears the routed-turn ledger, so a new conversation never resumes the discarded one", async () => {
    const agent = await startRoutingAwareFakeHermesAgent();
    const bridge = await openBridge(agent.url);
    bridge.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge.waitFor((f) => f.type === "res" && f.id === "c1", "connect");

    // Route a message so the ledger becomes active for this sessionKey.
    bridge.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion.",
        idempotencyKey: "run-1",
      },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");
    await bridge.waitFor((f) => f.event === "routing.completed", "routing.completed");

    const ledgerPath = await ledgerPathFor(agent.url);
    expect(JSON.parse(fs.readFileSync(ledgerPath, "utf8"))["agent:default:main"].turns).toHaveLength(1);

    // Discard the conversation.
    bridge.send({ type: "req", id: "r1", method: "sessions.reset", params: { key: "agent:default:main" } });
    await bridge.waitFor((f) => f.type === "res" && f.id === "r1", "sessions.reset res");

    expect(JSON.parse(fs.readFileSync(ledgerPath, "utf8"))["agent:default:main"]).toBeUndefined();

    // A brand new routed turn on the SAME key must not resume the
    // discarded conversation's history (Codex review finding, P1,
    // 2026-09-01) — chat.history right after should show only the new turn.
    bridge.send({
      type: "req",
      id: "m2",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Noch ein Sicherheits-Review bitte, andere Datei.",
        idempotencyKey: "run-2",
      },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "m2", "chat.send res 2");
    await bridge.waitFor(
      (f) => f.event === "routing.completed" && at(f, "payload.runId") === "run-2",
      "routing.completed 2",
    );

    bridge.send({ type: "req", id: "h1", method: "chat.history", params: { sessionKey: "agent:default:main" } });
    const historyRes = await bridge.waitFor((f) => f.type === "res" && f.id === "h1", "chat.history");
    const messages = at(historyRes, "payload.messages") as { role: string; content: string }[];

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain("andere Datei");
    expect(messages.some((m) => m.content.includes("Login-Funktion"))).toBe(false);
  });

  it("drops a completed routed session's local bookkeeping instead of accumulating it forever", async () => {
    const agent = await startRoutingAwareFakeHermesAgent();
    const bridge = await openBridge(agent.url);
    bridge.send({ type: "req", id: "c1", method: "connect", params: {} });
    await bridge.waitFor((f) => f.type === "res" && f.id === "c1", "connect");

    bridge.send({
      type: "req",
      id: "m1",
      method: "chat.send",
      params: {
        sessionKey: "agent:default:main",
        message: "Bitte mache ein kritisches Sicherheits-Review dieser Login-Funktion.",
        idempotencyKey: "run-1",
      },
    });
    await bridge.waitFor((f) => f.type === "res" && f.id === "m1", "chat.send res");
    await bridge.waitFor((f) => f.event === "routing.completed", "routing.completed");

    bridge.send({ type: "req", id: "s1", method: "status", params: {} });
    const statusRes = await bridge.waitFor((f) => f.type === "res" && f.id === "s1", "status");
    const recentKeys = (at(statusRes, "payload.sessions.recent") as { key: string }[]).map((r) => r.key);

    // The throwaway agent:router-claude-review:routed-run-1 session must
    // not still be sitting in the bridge's own session map after its
    // durable id was safely persisted (Codex review finding, P2,
    // 2026-09-01) — it stays resumable via the ledger's storedId, just not
    // as a live "recent session" here.
    expect(recentKeys.some((key) => key.startsWith("agent:router-claude-review:routed-"))).toBe(false);
  });
});
