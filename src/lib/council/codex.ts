import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MAX_OUTPUT = 160_000;

/**
 * Runs a third, independent Council reading through the user's authenticated
 * Codex subscription. The process is ephemeral and read-only and starts in an
 * empty directory, so the model receives the approved brief but no LifeOS files.
 */
export function askCodexPerspective(prompt: string, timeoutMs = 150_000): Promise<string> {
  const sandbox = path.join(os.tmpdir(), "hermes3d-codex-council");
  const outputFile = path.join(sandbox, `answer-${randomUUID()}.txt`);
  fs.mkdirSync(sandbox, { recursive: true });

  return new Promise((resolve, reject) => {
    const codexArgs = [
        "exec",
        "--model",
        "gpt-6-astra",
        "--sandbox",
        "read-only",
        "--ephemeral",
        "--skip-git-repo-check",
        "--ignore-rules",
        "--output-last-message",
        outputFile,
        "-",
      ];
    // Use the native Windows binary rather than the npm .cmd shim. The user
    // brief travels on stdin and never becomes shell command text.
    const command = process.platform === "win32" ? "codex.exe" : "codex";
    const child = spawn(command, codexArgs, {
      cwd: sandbox,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    child.stdin.end(prompt, "utf8");

    let stdout = "";
    let stderr = "";
    let finished = false;
    const cleanup = () => {
      try {
        fs.rmSync(outputFile, { force: true });
      } catch {
        // The temporary answer is best-effort cleanup and contains only the brief.
      }
    };
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      cleanup();
      reject(new Error("Astra hat das Zeitlimit überschritten."));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = (stdout + chunk).slice(-MAX_OUTPUT);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8_000);
    });
    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      reject(error);
    });
    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        const answer = fs.existsSync(outputFile) ? fs.readFileSync(outputFile, "utf8").trim() : "";
        cleanup();
        if (!answer) throw new Error(stderr || stdout || `Codex wurde mit Code ${code ?? "?"} beendet.`);
        resolve(answer);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
}
