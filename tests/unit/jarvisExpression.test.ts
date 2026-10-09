import { describe, expect, it } from "vitest";
import { expressiveText, readExpression } from "@/lib/jarvis/expression";
import { liveSetup } from "@/lib/jarvis/live";
describe("Jarvis vocal expression",()=>{
 it("uses actual nonverbal audio tags without spelling a laugh",()=>{
  expect(expressiveText("Boss, pack es an.",{delivery:"dry",laugh:true})).toBe("[sarcastic] Boss, pack es an. [laughs]");
  expect(expressiveText("Heute ist Freitag.",readExpression(null))).toBe("Heute ist Freitag.");
  expect(()=>readExpression({delivery:"singing",laugh:true})).toThrow();expect(()=>readExpression({delivery:"dry",laugh:"yes"})).toThrow();
 });
 it("adds only a local expression tool for the external voice, alongside optional Todoist",()=>{
  expect(liveSetup("Charon",false,true).tools![0].functionDeclarations.map(t=>t.name)).toEqual(["set_voice_expression"]);
  expect(liveSetup("Charon",true,true).tools![0].functionDeclarations.map(t=>t.name)).toEqual(["set_voice_expression","get_todoist_summary","prepare_todoist_completion"]);
  expect(liveSetup("Charon",false,false)).not.toHaveProperty("tools");
 });
});
