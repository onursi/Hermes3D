import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/jarvis/todoistLive",()=>({todoistToken:()=>"private-test",taskSummary:vi.fn(async()=>({ok:true,due:[]})),prepareCompletion:vi.fn(),completeTask:vi.fn()}));
import {GET,POST} from "@/app/api/jarvis/todoist/route";
import {taskSummary,completeTask} from "@/lib/jarvis/todoistLive";
afterEach(()=>vi.clearAllMocks());
const req=(body:object,origin="http://localhost:3464")=>new Request("http://localhost:3464/api/jarvis/todoist",{method:"POST",headers:{origin,host:"localhost:3464"},body:JSON.stringify(body)});
describe("Todoist live route",()=>{
 it("availability reveals no token or tasks",async()=>{expect(await(await GET()).json()).toEqual({connected:true});expect(taskSummary).not.toHaveBeenCalled();});
 it("rejects an external origin before reading or writing tasks",async()=>{expect((await POST(req({action:"summary",period:"today"},"https://other.invalid"))).status).toBe(403);expect(taskSummary).not.toHaveBeenCalled();expect(completeTask).not.toHaveBeenCalled();});
 it("requires an explicit confirmation before closing a prepared task",async()=>{expect((await POST(req({action:"complete",proof:"fake"}))).status).toBe(400);expect(completeTask).not.toHaveBeenCalled();await POST(req({action:"complete",proof:"fake",confirmed:true}));expect(completeTask).toHaveBeenCalledWith("private-test","fake",expect.anything());});
});
