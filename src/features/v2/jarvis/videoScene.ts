export const VIDEO_SCENE_STORAGE_KEY = "hermes.jarvis.video-scene.v1";

export const DEFAULT_VIDEO_TASKS = [
  "Paket zur Post bringen. Den Versand-QR-Code vorher aufs Handy speichern",
  "Wäsche anstellen",
  "Einkaufen",
] as const;

export type VideoSceneTurn = { id: string; cue: string; reply: string };

export function readVideoTasks(value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== 3 || value.some(task => typeof task !== "string")) {
    return [...DEFAULT_VIDEO_TASKS];
  }
  return value.map((task, index) => task.trim().slice(0, 220) || DEFAULT_VIDEO_TASKS[index]);
}

export function makeVideoScene(tasks: string[]): VideoSceneTurn[] {
  const safe = readVideoTasks(tasks);
  const sentence = (text: string) => text.replace(/[.!?]+$/, "");
  return [
    {
      id: "briefing",
      cue: "Jarvis, was steht heute an?",
      reply: `Guten Morgen, Chef. Drei Dinge. Erstens, ${sentence(safe[0])}. Zweitens, ${sentence(safe[1])}. Und drittens, ${sentence(safe[2])}. Der Kaffee darf mit. Der erledigt allerdings keine davon.`,
    },
    {
      id: "coffee",
      cue: "Erst mal mein Käffchen.",
      reply: "Natürlich, Chef. Ohne Kaffee läuft hier offenbar nur die künstliche Intelligenz.",
    },
    {
      id: "parcel",
      cue: "Kannst du nicht für mich zur Post gehen?",
      reply: "Wenn du mir Beine baust, reden wir darüber, Chef.",
    },
  ];
}
