import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveVoiceOutput } from "@/features/v2/jarvis/live/voiceOutput";
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const pcmResponse=(parts:number[][])=>new Response(new ReadableStream({start(c){parts.forEach(p=>c.enqueue(new Uint8Array(p)));c.close();}}),{headers:{"X-Audio-Sample-Rate":"24000"}});
describe("selected live voice output",()=>{
  it("speaks sentence fragments in order and retains PCM bytes across odd network chunks",async()=>{
    const fetcher=vi.fn(async()=>pcmResponse([[1],[2,3],[4]]));vi.stubGlobal("fetch",fetcher);
    const bytes:number[]=[],error=vi.fn(),activity=vi.fn();const voice=new LiveVoiceOutput("session-only",b=>bytes.push(...b),error,activity);
    voice.append("Boss, ");expect(fetcher).not.toHaveBeenCalled();voice.append("pack es an. Weiter geht");voice.append(" es");voice.flush();
    await vi.waitFor(()=>expect(voice.busy).toBe(false));
    expect(bytes).toEqual([1,2,3,4,1,2,3,4]);expect(error).not.toHaveBeenCalled();
    const first=JSON.parse(fetcher.mock.calls[0][1].body),second=JSON.parse(fetcher.mock.calls[1][1].body);
    expect(first.text).toBe("Boss, pack es an.");expect(second.text).toBe("Weiter geht es");expect(second.previousText).toBe(first.text);expect(first.consent).toBe(true);
  });
  it("cancels pending synthesis and rejects late audio after an interruption",async()=>{
    let finish!:(r:Response)=>void;vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
    const pcm=vi.fn(),error=vi.fn();const voice=new LiveVoiceOutput("session",pcm,error,vi.fn());voice.append("Alte Antwort.");
    await vi.waitFor(()=>expect(finish).toBeTypeOf("function"));voice.interrupt();finish(pcmResponse([[1,2]]));
    await Promise.resolve();await Promise.resolve();expect(pcm).not.toHaveBeenCalled();expect(error).not.toHaveBeenCalled();expect(voice.busy).toBe(false);
  });
  it("reports provider failure without playing native or stale queued answers",async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({error:"Kontingent fehlt"}),{status:402}));vi.stubGlobal("fetch",fetcher);
    const pcm=vi.fn(),error=vi.fn();const voice=new LiveVoiceOutput("session",pcm,error,vi.fn());voice.append("Erster Satz. Zweiter Satz.");voice.flush();
    await vi.waitFor(()=>expect(error).toHaveBeenCalledWith("Kontingent fehlt"));expect(fetcher).toHaveBeenCalledOnce();expect(pcm).not.toHaveBeenCalled();expect(voice.busy).toBe(false);
  });
});
