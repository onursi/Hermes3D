// @vitest-environment node
import { describe, expect, it } from "vitest";
import { defaultSettings, plannedCalls, ROLES, validateSettings, type CatalogProvider, type Contribution, type CouncilRun } from "@/features/perspectives/model";
import { executeRun, sameOrigin } from "@/lib/perspectives/runs";
import { parseEnv } from "@/lib/perspectives/providers";

const providers: CatalogProvider[] = [{ id: "codex", name: "Codex", available: true, billing: "quota", models: [{ id: "test-model", name: "Test", efforts: ["low", "high"] }] }];
const settings = () => defaultSettings(providers[0].models);
function run(): CouncilRun {
  const config = settings();
  return { id: "test", mission: "Soll ich die Idee testen?", state: "running", phase: "opinions", opinions: config.roles.map((entry) => ({ ...entry, name: ROLES.find((r) => r.id === entry.role)!.name, state: "waiting" })), reviews: [], moderation: { ...config.moderator, role: "moderator", name: "Hermes", state: "waiting" }, createdAt: Date.now(), plannedCalls: 7 };
}

describe("Perspektivenrat model selection and orchestration", () => {
  it("allows all six roles and the moderator to use the same model independently", () => {
    expect(validateSettings(settings(), providers).roles).toHaveLength(6);
    expect(plannedCalls(settings())).toBe(7);
    expect(plannedCalls({ ...settings(), review: true })).toBe(13);
  });
  it("rejects duplicate roles, unavailable models and unsupported effort", () => {
    const duplicate = settings(); duplicate.roles[1].role = duplicate.roles[0].role;
    expect(() => validateSettings(duplicate, providers)).toThrow(/doppelte/);
    const invalid = settings(); invalid.roles[0].model = "not-in-catalog";
    expect(() => validateSettings(invalid, providers)).toThrow(/Katalog/);
    const effort = settings(); effort.moderator.effort = "max";
    expect(() => validateSettings(effort, providers)).toThrow(/Denkstufe/);
  });
  it("does not require valid models in disabled roles or launch their calls", () => {
    const config = settings(); config.roles[0] = { ...config.roles[0], enabled: false, model: "unavailable" };
    expect(validateSettings(config, providers).roles[0].enabled).toBe(false);
    expect(plannedCalls(config)).toBe(6);
    config.roles.forEach((role) => { role.enabled = false; });
    expect(() => validateSettings(config, providers)).toThrow(/Mindestens/);
  });
  it("isolates first opinions, limits concurrency, anonymizes review and moderates after completion", async () => {
    const job = run(); const config = { ...settings(), review: true };
    let inFlight = 0, maximum = 0;
    const prompts: string[] = [];
    const ask = async (prompt: string, choice: Contribution) => {
      prompts.push(prompt); maximum = Math.max(maximum, ++inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5)); inFlight--;
      return { text: `answer-${choice.role}`, inputTokens: 12, outputTokens: 8 };
    };
    await executeRun(job, "FACT", config, new AbortController().signal, ask);
    expect(maximum).toBe(2); expect(prompts).toHaveLength(13);
    expect(prompts.slice(0, 6).every((p) => !p.includes("answer-"))).toBe(true);
    expect(prompts[6]).toContain("Beitrag 1:"); expect(prompts[6]).not.toContain("test-model");
    expect(prompts[12]).toContain("ERSTSICHTEN"); expect(job.state).toBe("done");
    expect(job.opinions[4].name).toBe("Visionär");
  });
  it("keeps failed roles visible, never retries them, and labels them in moderation", async () => {
    const job = run(); const prompts: string[] = [];
    await executeRun(job, "", { ...settings(), review: true }, new AbortController().signal, async (prompt, choice) => {
      prompts.push(prompt); if (choice.role === "critic") throw new Error("quota"); return { text: "ok" };
    });
    expect(job.opinions[0].state).toBe("error"); expect(job.reviews).toHaveLength(5);
    expect(prompts).toHaveLength(12); expect(prompts.at(-1)).toContain("Kritiker: FEHLT: quota");
  });
  it("skips moderation when every first call failed", async () => {
    const job = run(); let calls = 0;
    await executeRun(job, "", settings(), new AbortController().signal, async () => { calls++; throw new Error("offline"); });
    expect(calls).toBe(6); expect(job.state).toBe("error"); expect(job.moderation.state).toBe("skipped");
  });
  it("cancels queued roles and never starts review or moderation after abort", async () => {
    const job = run(); const controller = new AbortController(); let calls = 0;
    await executeRun(job, "", { ...settings(), review: true }, controller.signal, async () => { calls++; controller.abort(); throw new Error("stopped"); });
    expect(calls).toBe(1); expect(job.state).toBe("cancelled"); expect(job.opinions.every((entry) => entry.state === "cancelled")).toBe(true); expect(job.moderation.state).toBe("cancelled");
  });
  it("rejects cross-origin mutation and safely parses quoted existing env values", () => {
    expect(sameOrigin(new Request("http://localhost:3464/api", { headers: { origin: "https://foreign.example", host: "localhost:3464" } }))).toBe(false);
    expect(sameOrigin(new Request("http://localhost/api", { headers: { origin: "https://private.example", "x-forwarded-host": "private.example" } }))).toBe(true);
    expect(parseEnv('KEY="a#b"\nEMPTY=\nexport SECOND=foo # note\n#ignore')).toEqual({ KEY: "a#b", SECOND: "foo" });
  });
});
