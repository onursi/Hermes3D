// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  commitMemoryProposal,
  createMemoryProposal,
  rememberProposal,
} from "@/lib/jarvis/memoryGate";
import { POST } from "@/app/api/jarvis/remember/route";

let root: string;
let previousStateDir: string | undefined;

beforeEach(async () => {
  previousStateDir = process.env.HERMES_STATE_DIR;
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hermes-memory-gate-"));
  process.env.HERMES_STATE_DIR = path.join(root, "state");
  await fs.mkdir(path.join(root, "00📥Inbox"), { recursive: true });
  await fs.mkdir(path.join(root, "05 🚀 Projekte", "Hermes"), { recursive: true });
  await fs.mkdir(path.join(root, "02⚙️ System"), { recursive: true });
  await fs.writeFile(path.join(root, "02⚙️ System", "Log.md"), "# Log\n");
  await fs.writeFile(path.join(root, "05 🚀 Projekte", "Hermes", "Hermes3D.md"), "---\nstatus: geprüft\n---\n\nHermes3D ist die räumliche Oberfläche des LifeOS.\n");
});

afterEach(async () => {
  if (previousStateDir === undefined) delete process.env.HERMES_STATE_DIR;
  else process.env.HERMES_STATE_DIR = previousStateDir;
  await fs.rm(root, { recursive: true, force: true });
});

describe("Jarvis // Hermes Memory Gate", () => {
  it("prüft zuerst lesend und trennt direkte Aussage von KI-Synthese", async () => {
    const before = await fs.readdir(path.join(root, "00📥Inbox"));
    const proposal = await createMemoryProposal(root, {
      question: "Ich habe entschieden, Hermes3D als zentrale Oberfläche weiterzubauen.",
      answer: "Die Entscheidung betrifft das Projekt Hermes3D.",
      sources: [{ id: "05 🚀 Projekte/Hermes/Hermes3D.md", title: "Hermes3D" }],
    });
    expect(proposal.kind).toBe("entscheidung");
    expect(proposal.status).toBe("direkte-eingabe");
    expect(proposal.matches.some((match) => match.id.endsWith("Hermes3D.md"))).toBe(true);
    expect(proposal.preview).toContain("### Direkte Eingabe");
    expect(proposal.preview).toContain("### Jarvis // Hermes Synthese");
    expect(await fs.readdir(path.join(root, "00📥Inbox"))).toEqual(before);
  });

  it("legt nur nach Bestätigung eine eindeutige Inbox-Datei an", async () => {
    const proposal = await createMemoryProposal(root, { question: "Neue unabhängige Idee für einen mobilen Tagesrückblick.", answer: "Noch ungeprüft." });
    rememberProposal(proposal);
    const result = await commitMemoryProposal(root, { proposalId: proposal.id, action: "defer", title: "Mobiler Tagesrückblick" });
    expect(result.file).toMatch(/^00📥Inbox\/Mobiler Tagesrückblick /);
    const written = await fs.readFile(path.join(root, result.file), "utf8");
    expect(written.startsWith("---\nstatus: ungeprüft")).toBe(true);
    expect(written).toContain("später prüfen");
    expect(written).toContain("Neue unabhängige Idee");
  });

  it("ergänzt nur eine geprüfte Kandidatenseite und sichert die Vorversion", async () => {
    const proposal = await createMemoryProposal(root, { question: "Hermes3D braucht ein Memory Gate für den LifeOS Kontext.", answer: "Der Vorschlag gehört zum Hermes3D Projekt." });
    const target = proposal.matches.find((match) => match.id.endsWith("Hermes3D.md"))?.id;
    expect(target).toBeTruthy();
    rememberProposal(proposal);
    const result = await commitMemoryProposal(root, { proposalId: proposal.id, action: "append", targetId: target });
    const changed = await fs.readFile(path.join(root, result.file), "utf8");
    expect(changed).toContain("Jarvis // Hermes ·");
    expect(changed).toContain("Memory Gate für den LifeOS Kontext");
    const history = await fs.readdir(path.join(root, "05 🚀 Projekte", "Hermes", ".hermes-history"));
    expect(history).toHaveLength(1);
  });

  it("stoppt bei einer Änderung zwischen Vorschau und Bestätigung", async () => {
    const proposal = await createMemoryProposal(root, { question: "Hermes3D erhält eine konfliktgeprüfte Ergänzung.", answer: "Projektstand." });
    const target = proposal.matches.find((match) => match.id.endsWith("Hermes3D.md"))!.id;
    rememberProposal(proposal);
    await fs.appendFile(path.join(root, target), "\nExterne Änderung.\n");
    await expect(commitMemoryProposal(root, { proposalId: proposal.id, action: "append", targetId: target })).rejects.toMatchObject({ status: 409 });
  });

  it("bewahrt bestätigte Anhänge bytegleich und verlinkt ihre Prüfsumme", async () => {
    const uploads = path.join(process.env.HERMES_STATE_DIR!, "hermes3d", "uploads");
    await fs.mkdir(uploads, { recursive: true });
    const stored = "abc12345-beleg.txt";
    await fs.writeFile(path.join(uploads, stored), Buffer.from([0, 1, 2, 3, 255]));
    const proposal = await createMemoryProposal(root, {
      question: "Eine neue belegte Erinnerung.",
      answer: "Der Anhang bleibt Originalquelle.",
      attachments: [{ id: "abc12345", name: "Beleg.txt", url: `/api/files/${stored}`, contentType: "text/plain" }],
    });
    rememberProposal(proposal);
    const result = await commitMemoryProposal(root, { proposalId: proposal.id, action: "inbox" });
    const note = await fs.readFile(path.join(root, result.file), "utf8");
    expect(note).toContain("Unverändert gesicherte Eingangsdateien");
    expect(note).toContain("SHA-256");
    const copied = path.join(root, "00📥Inbox", "_Hermes-Eingänge", proposal.createdAt.slice(0, 10), proposal.id, "Beleg.txt");
    expect([...await fs.readFile(copied)]).toEqual([0, 1, 2, 3, 255]);
  });

  it("verweigert fremde Browser-Ursprünge", async () => {
    const previous = process.env.OBSIDIAN_VAULT_PATH;
    process.env.OBSIDIAN_VAULT_PATH = root;
    try {
      const response = await POST(new Request("http://localhost/api/jarvis/remember", {
        method: "POST",
        headers: { origin: "https://foreign.example", "content-type": "application/json" },
        body: JSON.stringify({ mode: "propose", question: "Test" }),
      }));
      expect(response.status).toBe(403);
    } finally {
      if (previous === undefined) delete process.env.OBSIDIAN_VAULT_PATH;
      else process.env.OBSIDIAN_VAULT_PATH = previous;
    }
  });
});
