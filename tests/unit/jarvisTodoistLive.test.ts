import { afterEach, describe, expect, it, vi } from "vitest";
import { taskSummary, midnight, prepareCompletion, completeTask } from "@/lib/jarvis/todoistLive";
import { liveSetup } from "@/lib/jarvis/live";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const json = (value: unknown) => new Response(JSON.stringify(value));
describe("Live Todoist", () => {
 it("locks tools into the live setup only when enabled", () => {
  expect(liveSetup("Charon")).not.toHaveProperty("tools");
  expect(liveSetup("Charon", true).tools![0].functionDeclarations.map(t=>t.name)).toEqual(["get_todoist_summary", "prepare_todoist_completion"]);
 });
 it("uses local midnight including daylight-saving transitions", () => {
  expect(midnight("2026-10-09", "Europe/Budapest")).toBe("2026-10-08T22:00:00.000Z");
  expect(midnight("2026-03-29", "Europe/Budapest")).toBe("2026-03-28T23:00:00.000Z");
  expect(midnight("2026-03-30", "Europe/Budapest")).toBe("2026-03-29T22:00:00.000Z");
 });
 it("paginates tasks and separates completed, overdue, today and tomorrow", async () => {
  const mock = vi.fn(async (input: string) => {
   const url = new URL(input);
   if (url.pathname.includes("completed")) { expect(url.searchParams.get("since")).toBe("2026-10-08T22:00:00.000Z"); return json({items:[{id:"event", task_id:"done",content:"Paket verschickt"}], next_cursor:null}); }
   if(url.searchParams.has("cursor")) return json({results:[{id:"b",content:"Morgen",due:{date:"2026-10-10"}}],next_cursor:null});
   return json({results:[{id:"a",content:"Heute",due:{date:"2026-10-09"}},{id:"c",content:"Überfällig",due:{date:"2026-10-08"}}],next_cursor:"more"});
  }); vi.stubGlobal("fetch", mock);
  const result = await taskSummary("fake", "today", "Europe/Budapest",new Date("2026-10-09T10:00:00Z"));
  expect(result.due.map(t=>t.id)).toEqual(["a"]); expect(result.completed.map(t=>t.id)).toEqual(["done"]); expect(result.overdueCount).toBe(1);
  const tomorrow = await taskSummary("fake", "tomorrow", "Europe/Budapest",new Date("2026-10-09T10:00:00Z")); expect(tomorrow.due.map(t=>t.id)).toEqual(["b"]);
 });
 it("does not claim zero completed tasks when that endpoint fails", async () => {
  vi.stubGlobal("fetch",vi.fn(async (url:string)=>url.includes("completed")?new Response("",{status:403}):json({results:[],next_cursor:null})));
  const result = await taskSummary("fake","today","UTC"); expect(result.completedCount).toBeNull(); expect(result.completedError).toContain("Berechtigung");
 });
 it("prepares without writing, binds the confirmation to its account and closes once", async () => {
  const mock=vi.fn(async (_url:string, opts:RequestInit)=>opts.method==="POST"?new Response(null,{status:204}):json({id:"real",content:"Video hochladen"})); vi.stubGlobal("fetch",mock);
  const prepared=await prepareCompletion("fake-owner","real"); expect(mock.mock.calls.every(c=>c[1].method==="GET")).toBe(true);
  await expect(completeTask("other",prepared.pendingTask.proof)).rejects.toThrow("Aufgabenfreigabe");
  expect((await completeTask("fake-owner",prepared.pendingTask.proof)).completed.id).toBe("real");
  await expect(completeTask("fake-owner",prepared.pendingTask.proof)).rejects.toThrow("Aufgabenfreigabe");
  expect(mock.mock.calls.filter(c=>c[1].method==="POST")).toHaveLength(1);
  await expect(prepareCompletion("fake","../bad")).rejects.toThrow("ID");
 });
});
