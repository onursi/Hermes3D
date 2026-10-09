import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/elevenlabs/localConfig",()=>({getElevenLabsConfig:()=>({apiKey:process.env.TEST_SPEECH_KEY||"test-speech-key",voices:{jarvis:{id:"testvoice",name:"Test voice"}}})}));
import { issueSpeechGrant, reserveSpeech, speechStatus } from "@/lib/jarvis/elevenVoice";
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("server speech grants and availability",()=>{
  it("reads the selected voice and flags exhausted quota without returning the key",async()=>{
    const fetcher=vi.fn(async(url:string)=>new Response(JSON.stringify(url.includes('/voices/')?{voice_id:"testvoice",name:"Selected",preview_url:"https://example.com/demo.mp3"}:{character_count:99,character_limit:100})));vi.stubGlobal("fetch",fetcher);
    const status=await speechStatus(undefined,true);expect(status.ready).toBe(false);expect(status.remainingCredits).toBe(1);expect(status.voiceName).toBe("Selected");expect(JSON.stringify(status)).not.toContain("test-speech-key");
  });
  it("rejects missing, parallel, expired and account-swapped grants",()=>{
    expect(()=>reserveSpeech("forged",5)).toThrow("ungültig");const ticket=issueSpeechGrant();const first=reserveSpeech(ticket,5);
    expect(()=>reserveSpeech(ticket,5)).toThrow("Sprachlimit");first.release();
    vi.stubEnv("TEST_SPEECH_KEY","different-account");expect(()=>reserveSpeech(ticket,5)).toThrow("ungültig");vi.unstubAllEnvs();
    const now=vi.spyOn(Date,"now").mockReturnValue(Date.now()+601000);expect(()=>reserveSpeech(ticket,5)).toThrow("abgelaufen");now.mockRestore();
  });
  it("caps the total synthesis budget even with valid session grants",()=>{
    const ticket=issueSpeechGrant();reserveSpeech(ticket,7900).release();expect(()=>reserveSpeech(ticket,101)).toThrow("Sprachlimit");
  });
});
