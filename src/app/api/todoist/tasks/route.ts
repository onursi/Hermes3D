import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEMO_TASKS = [
  { id: "demo-1", content: "Executive 3D Dashboard auf 120 FPS optimieren", is_completed: false, priority: 4, project_name: "Hermes 3D", due: { string: "Heute" } },
  { id: "demo-2", content: "Obsidian 3D Neural Graph mit Life OS verknüpfen", is_completed: true, priority: 3, project_name: "Life OS", due: { string: "Heute" } },
  { id: "demo-3", content: "Todoist iPhone Synchronisation einrichten", is_completed: false, priority: 4, project_name: "Life OS", due: { string: "Heute" } },
  { id: "demo-4", content: "QMD Vektor-Index für veränderte Dokumente nachziehen", is_completed: true, priority: 2, project_name: "System", due: { string: "Erledigt" } },
  { id: "demo-5", content: "Möbel- und Tischoberflächen auf Satin-Matte entspiegeln", is_completed: true, priority: 1, project_name: "Optik", due: { string: "Erledigt" } },
];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token =
      req.headers.get("authorization")?.replace("Bearer ", "") ||
      url.searchParams.get("token") ||
      process.env.TODOIST_API_TOKEN;

    if (!token) {
      return NextResponse.json({
        isConnected: false,
        tasks: DEMO_TASKS,
        message: "Kein Todoist-Token hinterlegt. Zeige LifeOS-Aufgaben. Trage deinen Token ein, um direkt mit deinem iPhone zu synchronisieren.",
      });
    }

    const res = await fetch("https://api.todoist.com/rest/v2/tasks", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { isConnected: false, error: `Todoist API Fehler: ${res.status} ${err}`, tasks: DEMO_TASKS },
        { status: 200 }
      );
    }

    const tasks = await res.json();
    return NextResponse.json({
      isConnected: true,
      tasks,
    });
  } catch (error: any) {
    console.error("Todoist API error:", error);
    return NextResponse.json({ isConnected: false, error: error.message, tasks: DEMO_TASKS }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { taskId, token } = body;
    const activeToken = token || process.env.TODOIST_API_TOKEN;

    if (!activeToken) {
      return NextResponse.json({ success: true, simulated: true });
    }

    const res = await fetch(`https://api.todoist.com/rest/v2/tasks/${taskId}/close`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
      },
    });

    if (!res.ok && res.status !== 204) {
      return NextResponse.json({ error: "Fehler beim Abhaken auf Todoist" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { content, priority = 1, token } = body;
    const activeToken = token || process.env.TODOIST_API_TOKEN;

    if (!activeToken) {
      return NextResponse.json({
        task: { id: `demo-${Date.now()}`, content, priority, is_completed: false, due: { string: "Heute" } },
        simulated: true,
      });
    }

    const res = await fetch("https://api.todoist.com/rest/v2/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, priority }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Fehler beim Erstellen auf Todoist" }, { status: 400 });
    }

    const created = await res.json();
    return NextResponse.json({ task: created, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
