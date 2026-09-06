import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Funktioniert das Konzil — und wenn nein, woran genau liegt es.
 *
 * Onur hat das schon einmal gefragt ("funktioniert unser Council
 * theoretisch?"), und der Entwurf für ein Agenten-Deck beantwortet es nicht:
 * dort stehen Karten mit "Ideenfluss 91 %", "Risiko Low", "Threads 07". Diese
 * Zahlen kommen von nirgends. Hermes liefert keine Telemetrie — kein Wert
 * davon ist abfragbar, und ein Deck, das sie trotzdem zeigt, ist ein Bild von
 * einem System, das es nicht gibt.
 *
 * Diese Route **fragt nach**. Sie klopft die Endpunkte ab, die ein Konzil
 * bräuchte, und berichtet je Punkt: erreichbar, vorhanden, oder eben nicht.
 * Das ist unspektakulärer als 91 % und beantwortet dafür die Frage.
 *
 * Rein lesend. Kein Endpunkt hier startet eine Runde, keiner erzeugt eine
 * Sitzung, keiner kostet ein Token — es wird ausschließlich nachgesehen, ob
 * es etwas gibt.
 */

export const dynamic = "force-dynamic";

type HermesClient = {
  hermesJson: (route: string) => Promise<unknown>;
  hermesReachable?: () => Promise<boolean>;
  HTTP_BASE?: string;
};

function loadClient(): HermesClient {
  const nodeRequire = eval("require") as NodeJS.Require;
  return nodeRequire(path.join(process.cwd(), "server", "hermes-ws-client.js")) as HermesClient;
}

/**
 * Was ein Konzil braucht, Stück für Stück.
 *
 * Die Reihenfolge ist die Reihenfolge einer Runde: wer sitzt am Tisch, wer
 * moderiert, wie wird eine Runde gestartet, wo steht ihr Verlauf, wie wird
 * entschieden. Fehlt ein Stück, ist klar welches — statt "das Konzil geht
 * nicht".
 */
const CHECKS: { id: string; label: string; route: string; why: string }[] = [
  {
    id: "profiles",
    label: "Teilnehmer",
    route: "/api/profiles",
    why: "Wer überhaupt am Tisch sitzen kann.",
  },
  {
    id: "models",
    label: "Modelle",
    route: "/api/model/options",
    why: "Welche Modelle hinter den Teilnehmern stehen.",
  },
  {
    id: "council",
    label: "Konzil-Endpunkt",
    route: "/api/council",
    why: "Der Einstieg, über den eine Runde beginnt.",
  },
  {
    id: "council-sessions",
    label: "Runden",
    route: "/api/council/sessions",
    why: "Wo eine laufende Runde und ihr Verlauf stehen.",
  },
  {
    id: "approvals",
    label: "Freigaben",
    route: "/api/approvals",
    why: "Wie eine Entscheidung bei Onur landet.",
  },
];

export type CouncilCheck = {
  id: string;
  label: string;
  route: string;
  why: string;
  /** true = geantwortet, false = nicht vorhanden, null = gar nicht gefragt. */
  present: boolean | null;
  detail: string;
};

export async function GET() {
  let client: HermesClient;
  try {
    client = loadClient();
  } catch (error) {
    return NextResponse.json({
      ok: false,
      reachable: false,
      reason: error instanceof Error ? error.message : "Hermes-Client nicht ladbar.",
      checks: CHECKS.map((check) => ({ ...check, present: null, detail: "nicht gefragt" })),
    });
  }

  // Erst die Erreichbarkeit. Ist Hermes aus, sind alle weiteren Antworten
  // dieselbe Antwort, und fünf Fehlermeldungen sagen weniger als eine.
  let reachable = false;
  try {
    reachable = client.hermesReachable ? await client.hermesReachable() : true;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    return NextResponse.json({
      ok: true,
      reachable: false,
      reason: "Hermes antwortet nicht. Ohne laufenden Hermes ist nichts davon prüfbar.",
      checks: CHECKS.map((check) => ({ ...check, present: null, detail: "Hermes aus" })),
    });
  }

  const checks: CouncilCheck[] = [];
  for (const check of CHECKS) {
    try {
      const payload = await client.hermesJson(check.route);
      checks.push({
        ...check,
        present: true,
        detail: describe(payload),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Ein 404 heißt "gibt es nicht" und ist eine Antwort; alles andere ist
      // eine Störung. Die beiden zu vermischen wäre genau die Unschärfe, die
      // solche Anzeigen wertlos macht.
      const missing = /HTTP 40[04]/.test(message);
      checks.push({
        ...check,
        present: false,
        detail: missing ? "kein solcher Endpunkt" : message,
      });
    }
  }

  const ready = checks.every((check) => check.present === true);
  return NextResponse.json({
    ok: true,
    reachable: true,
    ready,
    checks,
    // Bewusst als Satz und nicht als Prozentzahl: "drei von fünf" wäre 60 %
    // und würde suggerieren, das Konzil laufe zu 60 %. Es läuft gar nicht,
    // solange ein Stück fehlt.
    summary: ready
      ? "Alle geprüften Teile antworten."
      : `${checks.filter((c) => c.present).length} von ${checks.length} Teilen antworten. Solange eines fehlt, kann keine Runde laufen.`,
  });
}

/** Eine kurze, nachprüfbare Beschreibung dessen, was zurückkam. */
function describe(payload: unknown): string {
  if (Array.isArray(payload)) return `${payload.length} Einträge`;
  if (payload && typeof payload === "object") {
    const keys = Object.keys(payload as Record<string, unknown>);
    const list = (payload as Record<string, unknown>).profiles;
    if (Array.isArray(list)) return `${list.length} Profile`;
    return keys.length > 0 ? `Felder: ${keys.slice(0, 5).join(", ")}` : "leere Antwort";
  }
  return "geantwortet";
}
