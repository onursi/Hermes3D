import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { resolveStateDir } from "@/lib/hermes/paths";

export type MemoryKind = "entscheidung" | "idee" | "aufgabe" | "projektstand" | "wissen";
export type MemoryStatus = "direkte-eingabe" | "ki-synthese";
export type MemoryAction = "inbox" | "defer" | "append" | "task-candidate";

export type MemorySource = { id: string; title: string; kind?: string; navigable?: boolean };
export type MemoryAttachment = {
  id: string;
  name: string;
  url: string;
  contentType: string;
  extractedText?: string;
};

export type MemoryMatch = {
  id: string;
  title: string;
  score: number;
  reason: string;
  duplicate: boolean;
};

export type MemoryProposal = {
  id: string;
  createdAt: string;
  expiresAt: string;
  title: string;
  kind: MemoryKind;
  status: MemoryStatus;
  sourceLabel: string;
  summary: string;
  links: string[];
  attachments: MemoryAttachment[];
  sources: MemorySource[];
  matches: MemoryMatch[];
  recommendation: "discard" | "inbox" | "append";
  recommendationReason: string;
  target?: string;
  inboxFile: string;
  preview: string;
  question: string;
  answer: string;
  candidateDigests: Record<string, string>;
};

const MAX_CAPTURE_CHARS = 120_000;
const MAX_NOTE_BYTES = 1_000_000;
const PROPOSAL_TTL_MS = 45 * 60 * 1000;
const WIKI_ROOTS = ["03🪪 Identität", "04📖 Lebensprofil", "05 🚀 Projekte", "06💡Interessen", "07🧠Wissen", "08📚Quellen", "09🅿️Ideenparkplatz"];
const SKIP_DIRS = new Set([".git", ".obsidian", ".trash", ".hermes-history", "Code", "_Assets", "node_modules"]);
const STOPWORDS = new Set([
  "aber", "alle", "auch", "das", "dass", "dem", "den", "der", "die", "eine", "einem", "einen", "einer", "eines", "für", "habe", "haben", "hier", "ich", "ist", "mit", "nicht", "noch", "oder", "sich", "sind", "und", "vom", "von", "was", "wie", "wird", "wir", "zu", "zum", "zur",
]);

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const slash = (value: string) => value.split(path.sep).join("/");
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, " ").replace(/\s+/g, " ").trim();
const tokens = (value: string) => [...new Set(normalize(value).split(" ").filter((word) => word.length > 3 && !STOPWORDS.has(word)))];

function safeTitle(value: string) {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, " ").replace(/\.\.+/g, ".").replace(/\s+/g, " ").trim().slice(0, 80);
  return cleaned || "Neue Erinnerung";
}

function titleFrom(question: string, answer: string) {
  const source = question.trim() || answer.trim();
  const first = source.split(/\r?\n/).find((line) => line.trim())?.replace(/^[-*#>\s]+/, "").trim() ?? "";
  const sentence = first.split(/(?<=[.!?])\s/)[0] ?? first;
  const short = sentence.length > 68 ? sentence.slice(0, 68).replace(/\s\S*$/, "") : sentence;
  return safeTitle(short || "Neue Erinnerung");
}

export function classifyMemory(text: string): MemoryKind {
  const lower = text.toLowerCase();
  if (/\b(entscheide|entschieden|entscheidung|beschlossen|festgelegt)\b/.test(lower)) return "entscheidung";
  if (/\b(idee|einfall|könnte man|vorschlag|brainstorm)\b/.test(lower)) return "idee";
  if (/\b(todo|aufgabe|muss ich|erledigen|nächster schritt|termin)\b/.test(lower)) return "aufgabe";
  if (/\b(projekt|arbeitsstand|fortschritt|blocker|umgesetzt|fertiggestellt)\b/.test(lower)) return "projektstand";
  return "wissen";
}

function linksFrom(text: string) {
  return [...new Set(text.match(/https?:\/\/[^\s<>()\]]+/gi)?.map((url) => url.replace(/[.,;!?]+$/, "")) ?? [])].slice(0, 12);
}

async function collectMarkdown(dir: string, out: string[] = [], depth = 0): Promise<string[]> {
  if (depth > 8) return out;
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.isSymbolicLink() || entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collectMarkdown(full, out, depth + 1);
    else if (entry.name.toLowerCase().endsWith(".md")) out.push(full);
  }
  return out;
}

async function findMatches(vault: string, query: string) {
  const terms = tokens(query).slice(0, 40);
  if (!terms.length) return { matches: [] as MemoryMatch[], digests: {} as Record<string, string> };
  const files: string[] = [];
  for (const root of WIKI_ROOTS) await collectMarkdown(path.join(vault, root), files);
  const queryNorm = normalize(query).slice(0, 1600);
  const scored: Array<MemoryMatch & { digest: string }> = [];
  for (const file of files) {
    let raw: string;
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > MAX_NOTE_BYTES) continue;
      raw = await fs.readFile(file, "utf8");
    } catch { continue; }
    const id = slash(path.relative(vault, file));
    const title = path.basename(file, path.extname(file));
    const titleNorm = normalize(title);
    const bodyNorm = normalize(raw);
    const matched = terms.filter((term) => titleNorm.includes(term) || bodyNorm.includes(term));
    if (!matched.length) continue;
    const titleHits = terms.filter((term) => titleNorm.includes(term)).length;
    const coverage = matched.length / terms.length;
    const score = Number((titleHits * 12 + coverage * 20 + Math.min(6, matched.length)).toFixed(2));
    const duplicate = queryNorm.length > 36 && bodyNorm.includes(queryNorm);
    scored.push({ id, title, score, duplicate, reason: duplicate ? "Der Inhalt steht dort bereits nahezu wörtlich." : `${matched.length} passende Begriffe: ${matched.slice(0, 4).join(", ")}`, digest: sha(raw) });
  }
  scored.sort((a, b) => Number(b.duplicate) - Number(a.duplicate) || b.score - a.score);
  const selected = scored.slice(0, 5);
  return {
    matches: selected.map(({ digest: _digest, ...match }) => match),
    digests: Object.fromEntries(selected.map((match) => [match.id, match.digest])),
  };
}

function markdownBlock(input: {
  question: string;
  answer: string;
  kind: MemoryKind;
  status: MemoryStatus;
  sources: MemorySource[];
  links: string[];
  attachments: MemoryAttachment[];
  date: string;
}) {
  const lines = [
    `## Jarvis // Hermes · ${input.date}`,
    "",
    `> Typ: ${input.kind} · Prüfstatus: ${input.status === "direkte-eingabe" ? "direkte Eingabe Onurs; externe Tatsachen darin bleiben ungeprüft" : "KI-Synthese, ungeprüft"}`,
  ];
  if (input.question) lines.push("", "### Direkte Eingabe", "", input.question);
  if (input.answer) lines.push("", "### Jarvis // Hermes Synthese", "", input.answer);
  if (input.links.length) lines.push("", "### Weblinks", "", ...input.links.map((link) => `- ${link}`));
  if (input.sources.length) lines.push("", "### Verwendete Quellen", "", ...input.sources.map((source) => {
    const id = source.id.replace(/\\/g, "/");
    const safeTitle = source.title.replace(/[\[\]|\r\n]/g, " ").trim();
    const vaultNote = source.kind !== "codex" && source.kind !== "task" && source.kind !== "approval" && source.navigable !== false && id.endsWith(".md") && !id.split("/").some((part) => !part || part === ".." || part.includes("[") || part.includes("]"));
    return vaultNote ? `- [[${id.replace(/\.md$/i, "")}|${safeTitle}]]` : `- ${safeTitle} (${source.kind || "externe Laufzeitquelle"}; nicht als Vault-Notiz verlinkt)`;
  }));
  if (input.attachments.length) lines.push("", "### Eingangsdateien", "", ...input.attachments.map((file) => `- ${file.name} (${file.contentType}) · wird bei Bestätigung unverändert mitgesichert`));
  return `${lines.join("\n")}\n`;
}

export async function createMemoryProposal(vault: string, input: { question?: string; answer?: string; sources?: MemorySource[]; attachments?: MemoryAttachment[] }): Promise<MemoryProposal> {
  const question = (input.question ?? "").trim().slice(0, MAX_CAPTURE_CHARS);
  const answer = (input.answer ?? "").trim().slice(0, MAX_CAPTURE_CHARS);
  if (!question && !answer) throw new Error("Nichts für das Memory Gate übergeben.");
  const stat = await fs.stat(vault);
  if (!stat.isDirectory()) throw new Error("LifeOS-Vault ist nicht erreichbar.");
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const title = titleFrom(question, answer);
  const kind = classifyMemory(question || answer);
  const status: MemoryStatus = question ? "direkte-eingabe" : "ki-synthese";
  const sources = (input.sources ?? []).filter((source) => typeof source?.id === "string" && typeof source?.title === "string" && source.id && source.title).slice(0, 20);
  const attachments = (input.attachments ?? []).filter((file) => typeof file?.id === "string" && typeof file?.name === "string" && typeof file?.url === "string" && file.id && file.name && file.url).slice(0, 8);
  const links = linksFrom(`${question}\n${answer}`);
  const { matches, digests } = await findMatches(vault, question || title);
  const duplicate = matches.find((match) => match.duplicate);
  const strong = matches.find((match) => match.score >= 20);
  const recommendation = duplicate ? "discard" : strong ? "append" : "inbox";
  const recommendationReason = duplicate
    ? `Sehr ähnlicher Inhalt wurde bereits in „${duplicate.title}“ gefunden.`
    : strong
      ? `„${strong.title}“ ist der stärkste bestehende Zusammenhang. Vor dem Ergänzen bleibt die genaue Änderung sichtbar.`
      : "Keine bestehende Seite ist eindeutig genug. Die Inbox ist der sichere Eingang zur späteren Einordnung.";
  const preview = markdownBlock({ question, answer, kind, status, sources, links, attachments, date });
  return {
    id: randomUUID(),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString(),
    title,
    kind,
    status,
    sourceLabel: question ? "Direkte Eingabe von Onur + Jarvis-Synthese" : "Jarvis-Synthese ohne direkte Eingabe",
    summary: (question || answer).replace(/\s+/g, " ").slice(0, 280),
    links,
    attachments,
    sources,
    matches,
    recommendation,
    recommendationReason,
    target: strong?.id,
    inboxFile: slash(path.join("00📥Inbox", `${title} ${date}.md`)),
    preview,
    question,
    answer,
    candidateDigests: digests,
  };
}

const proposals = new Map<string, MemoryProposal>();

export function rememberProposal(proposal: MemoryProposal) {
  const now = Date.now();
  for (const [id, value] of proposals) if (new Date(value.expiresAt).getTime() <= now) proposals.delete(id);
  proposals.set(proposal.id, proposal);
}

export function forgetProposal(id: string) { proposals.delete(id); }

function loadProposal(id: string) {
  const proposal = proposals.get(id);
  if (!proposal || new Date(proposal.expiresAt).getTime() <= Date.now()) {
    proposals.delete(id);
    throw Object.assign(new Error("Diese Vorschau ist abgelaufen. Bitte erneut prüfen lassen."), { status: 410 });
  }
  return proposal;
}

async function uniquePath(dir: string, title: string, date: string) {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    const suffix = attempt === 1 ? "" : ` (${attempt})`;
    const candidate = path.join(dir, `${safeTitle(title)} ${date}${suffix}.md`);
    try { await fs.access(candidate); } catch { return candidate; }
  }
  throw new Error("Zu viele gleichnamige Inbox-Dateien.");
}

function originalAttachmentName(file: MemoryAttachment) {
  const name = file.name.trim();
  if (!name || path.basename(name) !== name || /[\\/:*?"<>|\0]/.test(name)) throw new Error(`Ungültiger Dateiname: ${name || "(leer)"}`);
  return name;
}

async function preserveAttachments(vault: string, proposal: MemoryProposal, action: MemoryAction) {
  if (!proposal.attachments.length) return { markdown: "", cleanup: async () => undefined };
  const root = await fs.realpath(vault);
  const date = proposal.createdAt.slice(0, 10);
  const relativeDir = action === "append"
    ? path.join("01📦RAW", "Hermes Memory Gate", date, proposal.id)
    : path.join("00📥Inbox", "_Hermes-Eingänge", date, proposal.id);
  const targetDir = path.join(root, relativeDir);
  if (!isInside(root, targetDir)) throw new Error("Ungültiger Quellenordner.");
  await fs.mkdir(targetDir, { recursive: true });
  try {
    const links: string[] = [];
    for (const attachment of proposal.attachments) {
      const storedName = decodeURIComponent(attachment.url.replace(/^\/api\/files\//, ""));
      if (!attachment.url.startsWith("/api/files/") || path.basename(storedName) !== storedName || !storedName.startsWith(`${attachment.id}-`)) throw new Error(`Ungültiger lokaler Dateiverweis: ${attachment.name}`);
      const sourceDir = path.resolve(resolveStateDir(), "hermes3d", "uploads");
      const source = path.resolve(sourceDir, storedName);
      if (!source.startsWith(`${sourceDir}${path.sep}`)) throw new Error("Lokaler Dateiverweis liegt außerhalb des Eingangs.");
      const target = path.join(targetDir, originalAttachmentName(attachment));
      const before = await fs.readFile(source);
      await fs.writeFile(target, before, { flag: "wx" });
      const after = await fs.readFile(target);
      if (sha(before) !== sha(after)) throw new Error(`Prüfsumme von ${attachment.name} stimmt nach dem Kopieren nicht überein.`);
      const relative = slash(path.relative(root, target));
      links.push(`- [[${relative}|${attachment.name}]] · SHA-256 \`${sha(after)}\``);
    }
    return {
      markdown: `\n### Unverändert gesicherte Eingangsdateien\n\n${links.join("\n")}\n`,
      cleanup: async () => fs.rm(targetDir, { recursive: true, force: true }),
    };
  } catch (error) {
    await fs.rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

function isInside(root: string, target: string) {
  const rel = path.relative(root, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function appendToExisting(vault: string, proposal: MemoryProposal, targetId: string, attachmentMarkdown = "") {
  if (!Object.hasOwn(proposal.candidateDigests, targetId)) throw new Error("Zielseite war nicht Teil der geprüften Vorschau.");
  const root = await fs.realpath(vault);
  const full = await fs.realpath(path.join(root, targetId));
  if (!isInside(root, full) || path.extname(full).toLowerCase() !== ".md") throw new Error("Ungültige Zielseite.");
  const before = await fs.readFile(full, "utf8");
  if (sha(before) !== proposal.candidateDigests[targetId]) throw Object.assign(new Error("Die Zielseite wurde seit der Vorschau geändert. Bitte neu prüfen."), { status: 409 });
  const lock = `${full}.hermes-lock`;
  let handle;
  try { handle = await fs.open(lock, "wx"); } catch { throw Object.assign(new Error("Die Zielseite wird gerade bearbeitet."), { status: 409 }); }
  try {
    const current = await fs.readFile(full, "utf8");
    if (sha(current) !== sha(before)) throw Object.assign(new Error("Die Zielseite wurde während des Speicherns geändert."), { status: 409 });
    const history = path.join(path.dirname(full), ".hermes-history");
    await fs.mkdir(history, { recursive: true });
    await fs.writeFile(path.join(history, `${path.basename(full)}.${sha(before)}.md`), before, { encoding: "utf8", flag: "wx" }).catch((error: NodeJS.ErrnoException) => { if (error.code !== "EEXIST") throw error; });
    const nl = before.includes("\r\n") ? "\r\n" : "\n";
    const addition = `${before.endsWith("\n") ? "" : nl}${nl}${(proposal.preview + attachmentMarkdown).replace(/\n/g, nl)}`;
    const temp = `${full}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, before + addition, { encoding: "utf8", flag: "wx" });
    try { await fs.rename(temp, full); } finally { await fs.unlink(temp).catch(() => undefined); }
    return slash(path.relative(root, full));
  } finally {
    await handle.close();
    await fs.unlink(lock).catch(() => undefined);
  }
}

async function writeInbox(vault: string, proposal: MemoryProposal, action: Exclude<MemoryAction, "append">, titleOverride?: string, attachmentMarkdown = "") {
  const root = await fs.realpath(vault);
  const inbox = path.join(root, "00📥Inbox");
  await fs.mkdir(inbox, { recursive: true });
  const date = proposal.createdAt.slice(0, 10);
  const title = safeTitle(titleOverride || proposal.title);
  const target = await uniquePath(inbox, title, date);
  if (!isInside(root, target)) throw new Error("Ungültiger Inbox-Pfad.");
  const label = action === "defer" ? "später prüfen" : action === "task-candidate" ? "Aufgabenkandidat, nicht an Todoist gesendet" : "zur Einordnung";
  const frontmatter = [
    "---",
    `status: ${action === "defer" ? "ungeprüft" : "entwurf"}`,
    "quelle:",
    `  - Direkte Eingabe an Jarvis // Hermes am ${date}`,
    `erfasst_am: ${date}`,
    `zeitbezug: ${date}`,
    "sensibilität: persönlich",
    "---",
    "",
    `> Memory Gate: ${label}. Diese Inbox-Datei ist noch kein kanonisches Wissen.`,
    "",
  ].join("\n");
  await fs.writeFile(target, frontmatter + proposal.preview + attachmentMarkdown, { encoding: "utf8", flag: "wx" });
  return slash(path.relative(root, target));
}

export async function commitMemoryProposal(vault: string, input: { proposalId?: string; action?: MemoryAction; targetId?: string; title?: string }) {
  const proposalId = input.proposalId?.trim() ?? "";
  if (!proposalId) throw new Error("Vorschau-ID fehlt.");
  const action = input.action;
  if (!action || !["inbox", "defer", "append", "task-candidate"].includes(action)) throw new Error("Speicherentscheidung fehlt.");
  const proposal = loadProposal(proposalId);
  const preserved = await preserveAttachments(vault, proposal, action);
  let file: string;
  try {
    if (action === "append") file = await appendToExisting(vault, proposal, input.targetId || proposal.target || "", preserved.markdown);
    else file = await writeInbox(vault, proposal, action, input.title, preserved.markdown);
  } catch (error) {
    await preserved.cleanup();
    throw error;
  }
  proposals.delete(proposalId);
  const warnings: string[] = [];
  if (action === "append") {
    try {
      const root = await fs.realpath(vault);
      const log = await fs.realpath(path.join(root, "02⚙️ System", "Log.md"));
      if (!isInside(root, log)) throw new Error("Log liegt außerhalb des Vaults.");
      const date = proposal.createdAt.slice(0, 10);
      const rawNote = `\n## [${date}] ingest | Jarvis // Hermes Memory Gate\nQuelle/Freigabe: Onurs ausdrückliche Bestätigung in Hermes3D. Ergänzt: [[${file.replace(/\.md$/i, "")}]]. Typ: ${proposal.kind}. Externe Tatsachen bleiben entsprechend der Vorschau ungeprüft; Vorversion wurde gesichert.${proposal.attachments.length ? " Eingangsdateien wurden unverändert mit SHA-256 unter 01📦RAW/Hermes Memory Gate bewahrt." : ""}\n`;
      await fs.appendFile(log, rawNote, "utf8");
    } catch {
      warnings.push("Die Zielseite wurde ergänzt, aber Log.md konnte nicht automatisch fortgeschrieben werden.");
    }
  }
  return { ok: true, action, file, title: input.title?.trim() || proposal.title, warnings };
}
