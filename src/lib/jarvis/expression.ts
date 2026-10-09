/** Expression is separate from spoken words: the Live model never dictates tags. */
export type VoiceExpression = { delivery: "neutral" | "dry"; laugh: boolean };
export const neutralExpression = (): VoiceExpression => ({ delivery: "neutral", laugh: false });
export function readExpression(value: unknown): VoiceExpression {
  if (value == null) return neutralExpression();
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültiger Sprachausdruck.");
  const v = value as Record<string, unknown>;
  if (!["neutral", "dry"].includes(String(v.delivery)) || typeof v.laugh !== "boolean") throw new Error("Ungültiger Sprachausdruck.");
  return { delivery: v.delivery as VoiceExpression["delivery"], laugh: v.laugh };
}
export function expressiveText(text: string, expression: VoiceExpression) {
  return `${expression.delivery === "dry" ? "[sarcastic] " : ""}${text.trim()}${expression.laugh ? " [laughs]" : ""}`;
}
