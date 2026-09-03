import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const VAULT_PATH = "C:\\Users\\User\\Desktop\\Life OS";

export type GraphNode = {
  id: string;
  name: string;
  folder: string;
  group: string;
  color: string;
  wordCount: number;
  excerpt: string;
  x: number;
  y: number;
  z: number;
  val: number;
};

export type GraphLink = {
  source: string;
  target: string;
};

// Anatomical Human Brain Regions & Electric Sci-Fi Palette (Reference Image 2)
const BRAIN_REGIONS: Record<string, { group: string; color: string; isLeft: boolean; zMin: number; zMax: number; yMin: number; yMax: number; xMin: number; xMax: number }> = {
  // Left Hemisphere: Logic, Planning, Infrastructure, Execution
  "05 🚀 Projekte":   { group: "projects",  color: "#00f0ff", isLeft: true,  zMin: 0.8,  zMax: 3.5,  yMin: 0.2,  yMax: 2.2,  xMin: -3.2, xMax: -0.6 },
  "02⚙️ System":       { group: "system",    color: "#38bdf8", isLeft: true,  zMin: -1.6, zMax: 1.0,  yMin: 0.8,  yMax: 2.5,  xMin: -3.0, xMax: -0.6 },
  "00📥Inbox":        { group: "inbox",     color: "#60a5fa", isLeft: true,  zMin: 0.5,  zMax: 2.8,  yMin: -1.4, yMax: 0.2,  xMin: -3.2, xMax: -0.8 },
  "01📦RAW":          { group: "raw",       color: "#818cf8", isLeft: true,  zMin: -2.8, zMax: -0.4, yMin: -1.2, yMax: 0.5,  xMin: -3.0, xMax: -0.8 },

  // Right Hemisphere: Knowledge, Identity, Creativity, Sensory Memory
  "07🧠Wissen":       { group: "knowledge", color: "#00f0ff", isLeft: false, zMin: 0.8,  zMax: 3.5,  yMin: 0.2,  yMax: 2.2,  xMin: 0.6,  xMax: 3.2 },
  "09🅿️Ideenparkplatz": { group: "ideas",     color: "#e879f9", isLeft: false, zMin: 1.2,  zMax: 3.6,  yMin: 0.8,  yMax: 2.4,  xMin: 0.8,  xMax: 3.0 },
  "03🪪 Identität":   { group: "identity",  color: "#34d399", isLeft: false, zMin: -0.8, zMax: 1.8,  yMin: -1.2, yMax: 0.6,  xMin: 0.8,  xMax: 3.0 },
  "04📖 Lebensprofil": { group: "profile",   color: "#a78bfa", isLeft: false, zMin: -2.2, zMax: -0.2, yMin: -1.0, yMax: 0.8,  xMin: 0.8,  xMax: 3.0 },
  "08📚Quellen":      { group: "sources",   color: "#38bdf8", isLeft: false, zMin: -3.6, zMax: -1.0, yMin: -0.6, yMax: 1.8,  xMin: 0.6,  xMax: 3.2 },
  "06💡Interessen":    { group: "interests", color: "#fbbf24", isLeft: false, zMin: -1.8, zMax: 0.5,  yMin: 1.0,  yMax: 2.4,  xMin: 0.8,  xMax: 2.8 },

  // Brainstem & Corpus Callosum (Core Central Integration)
  core:               { group: "core",      color: "#ffffff", isLeft: false, zMin: -0.8, zMax: 0.6,  yMin: -2.2, yMax: 0.0,  xMin: -0.5, xMax: 0.5 },
};

let cachedResponse: any = null;
let lastScanTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

// Generous ceiling so no real note is ever cut short; only guards against a
// pathological file. The largest note in the vault is well under this.
const MAX_NOTE_CHARS = 512 * 1024;

/** Drop the YAML frontmatter block so excerpts show prose, not `status: entwurf`. */
function stripFrontmatter(content: string) {
  if (!content.startsWith("---")) return content;
  const end = content.indexOf("\n---", 3);
  return end === -1 ? content : content.slice(end + 4);
}

/**
 * First line of real prose. Skips headings, horizontal rules, images and
 * embeds, and unwraps Obsidian callouts, whose `> [!note]` markers otherwise
 * hide the actual sentence behind them.
 */
function firstProseLine(body: string) {
  for (const rawLine of body.split("\n")) {
    const line = rawLine.replace(/^\s*>\s?/, "").replace(/^\[![a-z]+\]\s*/i, "").trim();
    if (!line) continue;
    if (line.startsWith("#") || line.startsWith("![") || line.startsWith("|")) continue;
    if (/^([-*_])\1{2,}$/.test(line.replace(/\s/g, ""))) continue;
    return line.length > 160 ? line.slice(0, 160) + "..." : line;
  }
  return "";
}

function scanDir(dir: string, baseDir: string, results: { filePath: string; relPath: string; folder: string }[] = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      scanDir(fullPath, baseDir, results);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      const parts = relPath.split(path.sep);
      const folder = parts.length > 1 ? parts[0] : "core";
      results.push({ filePath: fullPath, relPath, folder });
    }
  }
  return results;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get("refresh") === "true";

    if (!forceRefresh && cachedResponse && Date.now() - lastScanTime < CACHE_TTL_MS) {
      return NextResponse.json(cachedResponse, {
        headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=120" },
      });
    }

    if (!fs.existsSync(VAULT_PATH)) {
      return NextResponse.json({ error: "Vault path not found", nodes: [], links: [] }, { status: 404 });
    }

    const files = scanDir(VAULT_PATH, VAULT_PATH);
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nameToId = new Map<string, string>();

    const hashStr = (str: string) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
      return Math.abs(h);
    };

    files.forEach((file) => {
      const baseName = path.basename(file.filePath, ".md");
      const id = file.relPath.replace(/\\/g, "/");
      nameToId.set(baseName.toLowerCase(), id);
      nameToId.set(id.toLowerCase(), id);

      const reg = BRAIN_REGIONS[file.folder] ?? { group: "other", color: "#38bdf8", isLeft: true, zMin: -1, zMax: 1, yMin: 0, yMax: 1.5, xMin: -2.5, xMax: -0.5 };
      const h = hashStr(id);

      const u = (h % 1000) / 1000;
      const v = ((h >> 4) % 1000) / 1000;
      const w = ((h >> 8) % 1000) / 1000;

      const x = reg.xMin + u * (reg.xMax - reg.xMin);
      const y = reg.yMin + v * (reg.yMax - reg.yMin);
      const z = reg.zMin + w * (reg.zMax - reg.zMin);

      nodes.push({
        id,
        name: baseName,
        folder: file.folder,
        group: reg.group,
        color: reg.color,
        wordCount: 0,
        excerpt: "",
        x,
        y,
        z,
        val: 1,
      });
    });

    const wikilinkRegex = /\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
    const linkSet = new Set<string>();

    files.forEach((file, idx) => {
      try {
        // Read the whole note. A previous 8 KB window silently dropped every
        // wikilink past that offset, which cost roughly half of all edges, and
        // cutting mid-byte mangled the emoji in the vault's folder names.
        const raw = fs.readFileSync(file.filePath, "utf8");
        const content = raw.length > MAX_NOTE_CHARS ? raw.slice(0, MAX_NOTE_CHARS) : raw;

        const node = nodes[idx];
        const body = stripFrontmatter(content);
        const words = body.trim().split(/\s+/).length;
        node.wordCount = words;
        node.val = Math.min(5, 1 + Math.log10(Math.max(1, words)) * 0.9);

        node.excerpt = firstProseLine(body);

        let match: RegExpExecArray | null;
        while ((match = wikilinkRegex.exec(content)) !== null) {
          const rawTarget = match[1].trim();
          const targetBase = path.basename(rawTarget, ".md").toLowerCase();
          const targetId = nameToId.get(targetBase) || nameToId.get(rawTarget.toLowerCase());

          if (targetId && targetId !== node.id) {
            const key = [node.id, targetId].sort().join("<->");
            if (!linkSet.has(key)) {
              linkSet.add(key);
              links.push({
                source: node.id,
                target: targetId,
              });
            }
          }
        }
      } catch (err) {
        console.error("Error reading " + file.filePath, err);
      }
    });

    cachedResponse = {
      vaultPath: VAULT_PATH,
      totalNotes: nodes.length,
      totalLinks: links.length,
      nodes,
      links,
      cachedAt: new Date().toISOString(),
    };
    lastScanTime = Date.now();

    return NextResponse.json(cachedResponse, {
      headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=120" },
    });
  } catch (error: any) {
    console.error("Obsidian Graph API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
