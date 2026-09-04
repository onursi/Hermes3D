import { NextResponse } from "next/server";

/**
 * Todoist, as a thin honest proxy.
 *
 * The previous version answered a missing or broken token with five invented
 * tasks — "Executive 3D Dashboard auf 120 FPS optimieren" and friends — so a
 * disconnected account was indistinguishable from a working one, and an
 * outage looked like a tidy day. Nothing here fabricates a task. No token
 * means no tasks and a reason; a failed call means an error and no tasks.
 *
 * The token is read from the Authorization header rather than the query
 * string, because a query string ends up in server logs, browser history and
 * referrers, and this one grants full access to somebody's task list.
 */

export const dynamic = "force-dynamic";

/**
 * Todoist retired the REST v2 endpoints — they answer 410 with a note telling
 * you to move to v1 of the unified API. This is that one. It paginates via
 * `results` plus `next_cursor` and renamed `is_completed` to `checked`.
 */
const TODOIST_API = "https://api.todoist.com/api/v1";

/** Follows `next_cursor` so a long list is not silently cut at page one. */
async function fetchAllPages<T>(path: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  // A guard rather than `while (true)`: a cursor that never clears would
  // otherwise hang the request forever.
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${TODOIST_API}${path}`);
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await describeFailure(res));
    const body: { results?: T[]; next_cursor?: string | null } = await res.json();
    items.push(...(body.results ?? []));
    cursor = body.next_cursor ?? null;
    if (!cursor) break;
  }
  return items;
}

export type TodoistTask = {
  id: string;
  content: string;
  description?: string;
  isCompleted: boolean;
  /** Todoist counts 4 as urgent down to 1 as none. Kept in their scale. */
  priority: number;
  projectId?: string;
  projectName?: string;
  /** ISO date (no time) when the task is due, if it has a date at all. */
  dueDate?: string | null;
  /** Todoist's own human phrasing, e.g. "jeden Montag". */
  dueText?: string | null;
  url?: string;
  labels?: string[];
};

type TodoistApiTask = {
  id: string;
  content: string;
  description?: string;
  /** v1 spelling. */
  checked?: boolean;
  /** v2 spelling, kept so a rollback does not silently show everything as open. */
  is_completed?: boolean;
  is_deleted?: boolean;
  priority?: number;
  project_id?: string;
  labels?: string[];
  url?: string;
  due?: { date?: string; string?: string; is_recurring?: boolean } | null;
};

const readToken = (req: Request) =>
  req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
  process.env.TODOIST_API_TOKEN?.trim() ||
  "";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** Todoist returns plain text on failure; surface it instead of a generic 400. */
async function describeFailure(res: Response) {
  const body = await res.text().catch(() => "");
  const detail = body.trim().slice(0, 200);
  if (res.status === 401 || res.status === 403) {
    return "Token abgelehnt. Prüfe ihn in den Todoist-Einstellungen unter Integrationen.";
  }
  if (res.status === 429) return "Todoist drosselt gerade. In einer Minute erneut versuchen.";
  return `Todoist antwortete mit ${res.status}${detail ? `: ${detail}` : ""}`;
}

export async function GET(req: Request) {
  const token = readToken(req);
  if (!token) {
    return NextResponse.json({
      connected: false,
      tasks: [],
      reason:
        "Kein Todoist-Token hinterlegt. Über den Schlüssel oben rechts eintragen — er bleibt in diesem Browser.",
    });
  }

  try {
    // Projects come along so a task can show where it lives. The task endpoint
    // only returns `project_id`, and an id on screen helps nobody.
    const [rawTasks, projects] = await Promise.all([
      fetchAllPages<TodoistApiTask>("/tasks", token),
      // A failed project lookup is not worth failing the whole list over; the
      // tasks are the point and the project name is a nicety.
      fetchAllPages<{ id: string; name: string }>("/projects", token).catch(() => []),
    ]);

    const projectNames = new Map(projects.map((project) => [project.id, project.name]));

    const tasks: TodoistTask[] = rawTasks
      .filter((task) => !task.is_deleted)
      .map((task) => ({
        id: task.id,
        content: task.content,
        description: task.description || undefined,
        // v1 renamed `is_completed` to `checked`.
        isCompleted: Boolean(task.checked ?? task.is_completed),
        priority: task.priority ?? 1,
        projectId: task.project_id,
        projectName: task.project_id ? projectNames.get(task.project_id) : undefined,
        // A due date may arrive as a plain day or with a time attached; the
        // grouping only cares about the day.
        dueDate: task.due?.date ? task.due.date.slice(0, 10) : null,
        dueText: task.due?.string ?? null,
        url: task.url,
        labels: task.labels,
      }));

    return NextResponse.json({ connected: true, tasks });
  } catch (error) {
    console.error("Todoist tasks request failed:", error);
    return NextResponse.json({
      connected: false,
      tasks: [],
      reason: `Todoist nicht erreichbar: ${errorMessage(error)}`,
    });
  }
}

/** Complete or reopen. Both directions exist so the checkbox cannot lie. */
export async function POST(req: Request) {
  const token = readToken(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "Kein Todoist-Token hinterlegt." },
      { status: 400 },
    );
  }

  try {
    const { taskId, completed } = (await req.json()) as {
      taskId?: string;
      completed?: boolean;
    };
    if (!taskId) {
      return NextResponse.json({ ok: false, reason: "taskId fehlt." }, { status: 400 });
    }

    const action = completed ? "close" : "reopen";
    const res = await fetch(`${TODOIST_API}/tasks/${taskId}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    // Todoist answers 204 with no body on success.
    if (!res.ok && res.status !== 204) {
      return NextResponse.json(
        { ok: false, reason: await describeFailure(res) },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: errorMessage(error) }, { status: 500 });
  }
}

/** Create. Returns the task Todoist actually stored, not the one we sent. */
export async function PUT(req: Request) {
  const token = readToken(req);
  if (!token) {
    return NextResponse.json(
      { ok: false, reason: "Kein Todoist-Token hinterlegt." },
      { status: 400 },
    );
  }

  try {
    const { content, priority, dueString, projectId } = (await req.json()) as {
      content?: string;
      priority?: number;
      dueString?: string;
      projectId?: string;
    };
    const trimmed = content?.trim();
    if (!trimmed) {
      return NextResponse.json({ ok: false, reason: "Kein Text." }, { status: 400 });
    }

    const res = await fetch(`${TODOIST_API}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: trimmed,
        ...(priority ? { priority } : {}),
        // Todoist parses this itself, so "morgen 9 Uhr" works as typed.
        ...(dueString ? { due_string: dueString, due_lang: "de" } : {}),
        ...(projectId ? { project_id: projectId } : {}),
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: await describeFailure(res) },
        { status: 502 },
      );
    }

    const created: TodoistApiTask = await res.json();
    const task: TodoistTask = {
      id: created.id,
      content: created.content,
      description: created.description || undefined,
      isCompleted: Boolean(created.is_completed),
      priority: created.priority ?? 1,
      projectId: created.project_id,
      dueDate: created.due?.date ?? null,
      dueText: created.due?.string ?? null,
      url: created.url,
      labels: created.labels,
    };
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return NextResponse.json({ ok: false, reason: errorMessage(error) }, { status: 500 });
  }
}
