import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type AntigravityEnvelope = {
  status?: string;
  response?: string;
  conversation_id?: string;
};

const MAX_OUTPUT = 160_000;

/**
 * Ask the locally authenticated Antigravity CLI for one independent opinion.
 * It runs in an empty sandbox directory and receives only the council brief.
 */
export function askAntigravity(prompt: string, timeoutMs = 90_000): Promise<string> {
  const sandbox = path.join(os.tmpdir(), "hermes3d-council-sandbox");
  fs.mkdirSync(sandbox, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(
      "agy",
      [
        "--print",
        prompt,
        "--output-format",
        "json",
        "--disable-slash-commands",
        "--sandbox",
        "--print-timeout",
        "75s",
      ],
      { cwd: sandbox, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: process.env },
    );
    let stdout = "";
    let stderr = "";
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      reject(new Error("Gemini hat das Zeitlimit überschritten."));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(-MAX_OUTPUT);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-4_000);
    });
    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        const jsonLine = stdout.trim().split(/\r?\n/).reverse().find((line) => line.trim().startsWith("{"));
        if (!jsonLine) throw new Error(stderr || `Antigravity wurde mit Code ${code ?? "?"} beendet.`);
        const result = JSON.parse(jsonLine) as AntigravityEnvelope;
        if (result.status !== "SUCCESS" || typeof result.response !== "string" || !result.response.trim()) {
          throw new Error(stderr || `Antigravity-Status: ${result.status ?? "unbekannt"}`);
        }
        resolve(result.response.trim());
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}

