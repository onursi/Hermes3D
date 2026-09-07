import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";

const VAULT_PATH =
  process.env.OBSIDIAN_VAULT_PATH?.trim() ||
  path.join(os.homedir(), "Desktop", "Life OS");

export type IdeaItem = {
  id: string;
  title: string;
  category: "open" | "discarded" | "inbox";
  summary: string;
  date?: string;
  phase: number; // 1 (Funke) to 7 (Reife Idee)
  phaseName: string;
  reife: number; // 0.0 to 1.0
  status: "active" | "parked" | "discarded" | "promoted";
  decisionDeadline?: string;
  sourceFile: string;
  learning?: string;
  sourceGround?: "quran" | "hadith" | "interpretation" | "general";
  tags?: string[];
};

const PHASES = [
  { level: 1, name: "Funke", minReife: 0.05, maxReife: 0.15 },
  { level: 2, name: "Gedankenwolke", minReife: 0.16, maxReife: 0.30 },
  { level: 3, name: "Silhouette", minReife: 0.31, maxReife: 0.45 },
  { level: 4, name: "Formung", minReife: 0.46, maxReife: 0.60 },
  { level: 5, name: "Reality Check", minReife: 0.61, maxReife: 0.75 },
  { level: 6, name: "Prototype Gate", minReife: 0.76, maxReife: 0.90 },
  { level: 7, name: "Reife Idee", minReife: 0.91, maxReife: 1.0 },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseIdeenFile(content: string, filePath: string): IdeaItem[] {
  const ideas: IdeaItem[] = [];
  const lines = content.split(/\r?\n/);

  let currentCategory: "open" | "discarded" = "open";
  let currentIdea: Partial<IdeaItem> | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (currentIdea && currentIdea.title) {
      const summaryText = bodyLines.join("\n").trim();
      const phase = currentIdea.category === "discarded" ? 1 : (currentIdea.phase || 2);
      const phaseObj = PHASES[phase - 1] || PHASES[1];
      const reife = currentIdea.reife ?? (currentIdea.category === "discarded" ? 0.0 : (phaseObj.minReife + phaseObj.maxReife) / 2);

      ideas.push({
        id: slugify(currentIdea.title),
        title: currentIdea.title,
        category: currentIdea.category || "open",
        summary: summaryText.slice(0, 450),
        date: currentIdea.date || "2026-08-29",
        phase: phase,
        phaseName: phaseObj.name,
        reife: Math.round(reife * 100) / 100,
        status: currentIdea.category === "discarded" ? "discarded" : "active",
        decisionDeadline: currentIdea.decisionDeadline || "2026-09-30",
        sourceFile: filePath,
        learning: currentIdea.category === "discarded" ? summaryText.slice(0, 180) : undefined,
        sourceGround: "general",
        tags: ["ideenparkplatz"],
      });
    }
    currentIdea = null;
    bodyLines = [];
  };

  for (const line of lines) {
    if (line.startsWith("## Offene Ideen")) {
      flush();
      currentCategory = "open";
      continue;
    }
    if (line.startsWith("## Verworfene Ideen")) {
      flush();
      currentCategory = "discarded";
      continue;
    }

    if (currentCategory === "open" && line.startsWith("### ")) {
      flush();
      const rawTitle = line.replace(/^###\s+/, "").trim();
      const dateMatch = rawTitle.match(/(\d{4}-\d{2}-\d{2})/);
      const cleanTitle = rawTitle.replace(/—.*$/, "").trim();

      // Estimate initial phase based on content clues
      let phase = 2; // Default: Gedankenwolke
      if (cleanTitle.toLowerCase().includes("werkzeuge für den vault") || cleanTitle.toLowerCase().includes("tagesliste")) {
        phase = 4; // Formung
      } else if (cleanTitle.toLowerCase().includes("journal-anwendung")) {
        phase = 5; // Reality Check
      } else if (cleanTitle.toLowerCase().includes("tiktok") || cleanTitle.toLowerCase().includes("kontingent")) {
        phase = 1; // Funke

      }

      currentIdea = {
        title: cleanTitle,
        category: "open",
        date: dateMatch ? dateMatch[1] : undefined,
        phase: phase,
      };
      continue;
    }

    if (currentCategory === "discarded" && line.startsWith("**") && line.includes("—")) {
      flush();
      const rawTitle = line.replace(/^\*\*/, "").replace(/\*\*.*$/, "").trim();
      currentIdea = {
        title: rawTitle,
        category: "discarded",
        phase: 1,
        reife: 0.0,
      };
      bodyLines.push(line);
      continue;
    }

    if (currentIdea) {
      bodyLines.push(line);
    }
  }
  flush();

  return ideas;
}

function parseInboxIdea(content: string, filePath: string): IdeaItem | null {
  const text = content.trim();
  if (!text) return null;

  return {
    id: "youtube-3d-hadith-welten",
    title: "YouTube: Begehbare 3D-Räume nach Koran & authentischen Hadithen",
    category: "inbox",
    summary: text.slice(0, 480),
    date: "2026-09-07",
    phase: 3, // Silhouette: Klares Konzept, aber noch kein 3D-Prototyp
    phaseName: "Silhouette",
    reife: 0.38,
    status: "active",
    decisionDeadline: "2026-09-21",
    sourceFile: filePath,
    sourceGround: "quran", // Special religious 3D concept!
    tags: ["youtube", "religion", "hadith", "3d", "art"],
  };
}

export async function GET() {
  try {
    const ideasPath = path.join(VAULT_PATH, "09🅿️Ideenparkplatz", "Ideen.md");
    const inboxPath = path.join(VAULT_PATH, "00📥Inbox", "Idee.md");

    let allIdeas: IdeaItem[] = [];

    if (fs.existsSync(ideasPath)) {
      const content = fs.readFileSync(ideasPath, "utf-8");
      const parsed = parseIdeenFile(content, "09🅿️Ideenparkplatz/Ideen.md");
      allIdeas.push(...parsed);
    }

    if (fs.existsSync(inboxPath)) {
      const content = fs.readFileSync(inboxPath, "utf-8");
      const inboxIdea = parseInboxIdea(content, "00📥Inbox/Idee.md");
      if (inboxIdea) {
        allIdeas.unshift(inboxIdea); // Top priority pilot idea!
      }
    }

    // Stats
    const totalOpen = allIdeas.filter((i) => i.category === "open" || i.category === "inbox").length;
    const totalDiscarded = allIdeas.filter((i) => i.category === "discarded").length;

    return NextResponse.json({
      success: true,
      vaultPath: VAULT_PATH,
      stats: {
        totalOpen,
        totalDiscarded,
        totalIdeas: allIdeas.length,
      },
      phases: PHASES,
      exits: [
        { id: "singularity", label: "In Singularität starten", icon: "🚀", description: "Befördert die Idee zum aktiven Vorhaben auf Bahn 1 des Erfolgsmagneten." },
        { id: "moon", label: "Als Mond andocken", icon: "🪐", description: "Hängt die Idee als Teilziel/Mond an einen bestehenden Projektplaneten an." },
        { id: "wissen", label: "Ins Wissensnetz", icon: "📚", description: "Archiviert die Erkenntnisse nach 07🧠Wissen oder 06💡Interessen." },
        { id: "discard", label: "Erkenntnis-Bucht (Verwerfen)", icon: "💎", description: "Erlischt zu einem Bernstein-Gedächtnisstein mit 1 Satz Begründung." },
        { id: "park", label: "Frist festlegen", icon: "⏳", description: "Setzt ein konkretes Datum: 'Bis wann entschieden?' (kein endloser Parkplatz)." },
        { id: "delegate", label: "Menschliche Übergabe", icon: "🤝", description: "Übergabe an Partner, Ehefrau oder externen Mitarbeiter." },
      ],
      ideas: allIdeas,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to parse ideas" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, ideaId, reife, exitId, learning, deadline } = body;

    // Log action to System Log if applicable
    const logPath = path.join(VAULT_PATH, "02⚙️ System", "Log.md");
    const today = new Date().toISOString().split("T")[0];

    let logEntry = "";
    if (action === "update_reife") {
      logEntry = `\n## [${today}] update | Ideenatelier: Reifegrad angepasst für ${ideaId} auf ${reife}\n`;
    } else if (action === "exit_action") {
      logEntry = `\n## [${today}] decision | Ideenatelier Ausgang [${exitId}] für ${ideaId} gewählt: ${learning || deadline || "ausgeführt"}\n`;
    }

    if (logEntry && fs.existsSync(logPath)) {
      fs.appendFileSync(logPath, logEntry, "utf-8");
    }

    return NextResponse.json({
      success: true,
      action,
      ideaId,
      reife,
      exitId,
      message: `Aktion ${action} erfolgreich verarbeitet.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process idea action" },
      { status: 500 }
    );
  }
}
