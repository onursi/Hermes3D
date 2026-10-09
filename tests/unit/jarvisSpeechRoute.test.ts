import { afterEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({release:vi.fn(),reserve:vi.fn(),status:vi.fn(),stream:vi.fn()}));
vi.mock("@/lib/jarvis/elevenVoice",()=>({reserveSpeech:mocks.reserve,speechStatus:mocks.status,streamSelectedVoice:mocks.stream}));
import { POST } from "@/app/api/jarvis/live/speech/route";
afterEach(()=>vi.resetAllMocks());
const request=(body:object,origin="http://localhost:3464")=>new Request("http://localhost:3464/api/jarvis/live/speech",{method:"POST",headers:{origin,host:"localhost:3464"},body:JSON.stringify(body)});
describe("live speech route",()=>{
  it("rejects cross-origin and unconsented synthesis before provider calls",async()=>{
    expect((await POST(request({consent:true,text:"Boss",session:"ticket"},"https://evil.invalid"))).status).toBe(403);
    expect((await POST(request({consent:false,text:"Boss",session:"ticket"}))).status).toBe(400);expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("blocks exhausted quota and releases the reservation without synthesis",async()=>{
    mocks.reserve.mockReturnValue({apiKey:"secret",voiceId:"chosen",release:mocks.release});mocks.status.mockResolvedValue({ready:false,error:"Kontingent fehlt"});
    const response=await POST(request({consent:true,text:"Boss",session:"ticket"}));expect(response.status).toBe(402);expect(mocks.stream).not.toHaveBeenCalled();expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("streams the server-pinned voice and releases its reservation only after playback bytes finish",async()=>{
    mocks.reserve.mockReturnValue({apiKey:"secret",voiceId:"chosen",release:mocks.release});mocks.status.mockResolvedValue({ready:true,remainingCredits:500});mocks.stream.mockResolvedValue(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.close();}}));
    const response=await POST(request({consent:true,text:"Boss.",session:"ticket",voiceId:"attacker-choice"}));expect(response.status).toBe(200);expect(mocks.stream.mock.calls[0][1]).toBe("chosen");expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1,2]);expect(mocks.release).toHaveBeenCalledOnce();expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("validates expression before reserving quota and counts generated audio tags",async()=>{
    const bad=await POST(request({consent:true,text:"Boss.",session:"ticket",expression:{delivery:"arbitrary",laugh:true}}));expect(bad.status).toBe(400);expect(mocks.reserve).not.toHaveBeenCalled();
    mocks.reserve.mockReturnValue({apiKey:"secret",voiceId:"chosen",release:mocks.release});mocks.status.mockResolvedValue({ready:true,remainingCredits:500});mocks.stream.mockResolvedValue(new ReadableStream({start(c){c.close();}}));
    const response=await POST(request({consent:true,text:"Boss.",session:"ticket",expression:{delivery:"dry",laugh:true}}));expect(response.status).toBe(200);await response.arrayBuffer();
    expect(mocks.reserve).toHaveBeenCalledWith("ticket","[sarcastic] Boss. [laughs]".length);expect(mocks.stream.mock.calls[0][5]).toEqual({delivery:"dry",laugh:true});
  });
});
