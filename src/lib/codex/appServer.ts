import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

type RpcResponse = {
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
};

type PendingCall = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

type RawThread = {
  id?: unknown;
  name?: unknown;
  preview?: unknown;
  updatedAt?: unknown;
  cwd?: unknown;
  status?: unknown;
};

export type CodexThreadSnapshot = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  cwd: string | null;
  status: string;
};

const CALL_TIMEOUT_MS = 9_000;

function cleanText(value: unknown, limit: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function statusLabel(value: unknown) {
  if (!value || typeof value !== "object") return "unbekannt";
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" ? type : "unbekannt";
}

function threadTitle(thread: RawThread) {
  const name = cleanText(thread.name, 120);
  if (name) return name;
  return cleanText(thread.preview, 120) || "Codex-Aufgabe ohne Titel";
}

/** Read-only JSON-RPC client for Codex' local app-server. */
class CodexAppServerClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly pending = new Map<number, PendingCall>();
  private sequence = 0;
  private buffer = "";
  private stderr = "";

  constructor() {
    this.child = spawn("codex", ["app-server", "--stdio"], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: process.env,
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.consume(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr = (this.stderr + chunk).slice(-800);
    });
    this.child.on("error", (error) => this.failAll(error));
    this.child.on("exit", (code) => {
      if (this.pending.size) {
        this.failAll(new Error(`Codex App Server beendet (${code ?? "ohne Code"}). ${this.stderr}`.trim()));
      }
    });
  }

  private consume(chunk: string) {
    this.buffer += chunk;
    let newline = this.buffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (line) {
        try {
          const message = JSON.parse(line) as RpcResponse;
          if (typeof message.id === "number") {
            const call = this.pending.get(message.id);
            if (call) {
              clearTimeout(call.timer);
              this.pending.delete(message.id);
              if (message.error) call.reject(new Error(message.error.message ?? "Codex RPC fehlgeschlagen."));
              else call.resolve(message.result);
            }
          }
        } catch {
          // Only valid RPC becomes a briefing fact.
        }
      }
      newline = this.buffer.indexOf("\n");
    }
  }

  private failAll(error: Error) {
    for (const [, call] of this.pending) {
      clearTimeout(call.timer);
      call.reject(error);
    }
    this.pending.clear();
  }

  call(method: string, params: Record<string, unknown>) {
    const id = ++this.sequence;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex App Server antwortet nicht auf ${method}.`));
      }, CALL_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  notify(method: string) {
    this.child.stdin.write(`${JSON.stringify({ method })}\n`);
  }

  close() {
    this.failAll(new Error("Codex App Server geschlossen."));
    this.child.kill();
  }
}

export async function listRecentCodexThreads(options?: {
  since?: Date;
  limit?: number;
}): Promise<CodexThreadSnapshot[]> {
  const since = options?.since ?? new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const limit = Math.max(1, Math.min(options?.limit ?? 12, 30));
  const client = new CodexAppServerClient();

  try {
    await client.call("initialize", {
      clientInfo: { name: "hermes3d", title: "Hermes3D Briefing", version: "1.0.0" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    client.notify("initialized");
    const result = (await client.call("thread/list", {
      limit,
      sortKey: "updated_at",
      sortDirection: "desc",
      archived: false,
      useStateDbOnly: true,
    })) as { data?: RawThread[] } | null;

    return (Array.isArray(result?.data) ? result.data : [])
      .filter((thread) => typeof thread.id === "string" && typeof thread.updatedAt === "number")
      .filter((thread) => Number(thread.updatedAt) * 1_000 >= since.getTime())
      .map((thread) => ({
        id: String(thread.id),
        title: threadTitle(thread),
        preview: cleanText(thread.preview, 900),
        updatedAt: new Date(Number(thread.updatedAt) * 1_000).toISOString(),
        cwd: typeof thread.cwd === "string" ? thread.cwd : null,
        status: statusLabel(thread.status),
      }));
  } finally {
    client.close();
  }
}

