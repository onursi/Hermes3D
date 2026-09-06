"use client";

import * as THREE from "three";

/**
 * Die vier Brustzeichen — von Antigravity, in einem Bild.
 *
 * Seine Zeichenfunktionen kommen unverändert aus dem Übergabedokument. Neu ist
 * nur, was hier drumherum passiert: Sie werden nicht als vier Texturen
 * angelegt, sondern in **ein** Bild mit vier Feldern. Vier Texturen heißen vier
 * Materialien und damit vier Zeichenaufrufe; ein Atlas heißt einer, egal wie
 * viele Figuren dastehen.
 *
 * Jede Figur bekommt dafür nur eine Verschiebung in den Bildkoordinaten
 * mitgegeben — links oben, rechts oben, links unten, rechts unten.
 */

export type Archetype = "developer" | "designer" | "advisor" | "reserve";

/** Kantenlänge eines Feldes. 512 ist scharf genug für ein Zeichen von fünf Zentimetern. */
const TILE = 512;

export function archetypeOf(provider: string | null, name: string): Archetype {
  const lowerName = (name || "").toLowerCase();
  const lowerProvider = (provider || "").toLowerCase();
  if (lowerName.includes("claude") || lowerProvider.includes("anthropic")) return "developer";
  if (
    lowerName.includes("gemini") ||
    lowerName.includes("antigravity") ||
    lowerProvider.includes("gemini") ||
    lowerProvider.includes("google")
  ) {
    return "designer";
  }
  if (
    lowerName.includes("chatgpt") ||
    lowerName.includes("codex") ||
    lowerProvider.includes("openai")
  ) {
    return "advisor";
  }
  return "reserve";
}

/** Wo das Feld eines Archetyps im Atlas liegt, in Bildkoordinaten. */
export const LOGO_UV: Record<Archetype, [number, number]> = {
  developer: [0, 0.5],
  designer: [0.5, 0.5],
  advisor: [0, 0],
  reserve: [0.5, 0],
};

function drawClaudeLogo(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.46;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.16, cx, cy, r);
  grad.addColorStop(0, "#c2410c");
  grad.addColorStop(0.7, "#9a3412");
  grad.addColorStop(1, "#431407");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#fdba74";
  ctx.lineWidth = size * 0.032;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 7; i += 1) {
    const angle = -Math.PI * 0.45 + (i * Math.PI * 0.9) / 6;
    ctx.save();
    ctx.translate(cx, cy + size * 0.058);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.roundRect(-size * 0.031, -size * 0.32, size * 0.062, size * 0.25, [
      size * 0.031,
      size * 0.031,
      size * 0.012,
      size * 0.012,
    ]);
    ctx.fill();
    ctx.restore();
  }
}

function drawGeminiLogo(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.46;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.16, cx, cy, r);
  grad.addColorStop(0, "#7c3aed");
  grad.addColorStop(0.7, "#4c1d95");
  grad.addColorStop(1, "#2e1065");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#c4b5fd";
  ctx.lineWidth = size * 0.032;
  ctx.stroke();

  const starGrad = ctx.createLinearGradient(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7);
  starGrad.addColorStop(0, "#38bdf8");
  starGrad.addColorStop(0.5, "#ffffff");
  starGrad.addColorStop(1, "#c084fc");
  ctx.fillStyle = starGrad;

  const tip = size * 0.35,
    inner = size * 0.048;
  ctx.beginPath();
  ctx.moveTo(cx, cy - tip);
  ctx.quadraticCurveTo(cx + inner, cy - inner, cx + tip, cy);
  ctx.quadraticCurveTo(cx + inner, cy + inner, cx, cy + tip);
  ctx.quadraticCurveTo(cx - inner, cy + inner, cx - tip, cy);
  ctx.quadraticCurveTo(cx - inner, cy - inner, cx, cy - tip);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.055, 0, Math.PI * 2);
  ctx.fill();
}

function drawChatGptLogo(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.46;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.16, cx, cy, r);
  grad.addColorStop(0, "#047857");
  grad.addColorStop(0.75, "#064e3b");
  grad.addColorStop(1, "#022c22");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#6ee7b7";
  ctx.lineWidth = size * 0.032;
  ctx.stroke();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.05;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI) / 3;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.094);
    ctx.lineTo(size * 0.148, -size * 0.094);
    ctx.arc(size * 0.148, -size * 0.188, size * 0.094, Math.PI / 2, -Math.PI / 6, true);
    ctx.lineTo(size * 0.074, -size * 0.328);
    ctx.stroke();
    ctx.restore();
  }
}

function drawOpencodeLogo(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2,
    cy = size / 2,
    r = size * 0.46;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.16, cx, cy, r);
  grad.addColorStop(0, "#0284c7");
  grad.addColorStop(0.75, "#0369a1");
  grad.addColorStop(1, "#082f49");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = size * 0.032;
  ctx.stroke();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.062;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(cx - size * 0.125, cy - size * 0.188);
  ctx.lineTo(cx - size * 0.246, cy);
  ctx.lineTo(cx - size * 0.125, cy + size * 0.188);
  ctx.stroke();

  ctx.strokeStyle = "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.055, cy - size * 0.218);
  ctx.lineTo(cx - size * 0.055, cy + size * 0.218);
  ctx.stroke();

  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.125, cy - size * 0.188);
  ctx.lineTo(cx + size * 0.246, cy);
  ctx.lineTo(cx + size * 0.125, cy + size * 0.188);
  ctx.stroke();
}

/**
 * Alle vier Zeichen in ein Bild, einmal beim Laden.
 *
 * Ohne Fensterobjekt — auf dem Server gibt es kein Canvas — liefert das nichts
 * zurück, und die Brustzeichen bleiben einfach aus. Ein fehlendes Logo ist ein
 * fehlendes Logo; es darf keinen Absturz auslösen.
 */
export function buildLogoAtlas(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = TILE * 2;
  canvas.height = TILE * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Reihenfolge passt zu LOGO_UV: Bildkoordinaten zählen von unten, Canvas von
  // oben — deshalb liegen Entwickler und Designer in der oberen Bildhälfte und
  // damit in der unteren Canvas-Zeile.
  const draw = (
    fn: (c: CanvasRenderingContext2D, size: number) => void,
    column: number,
    row: number,
  ) => {
    ctx.save();
    ctx.translate(column * TILE, row * TILE);
    fn(ctx, TILE);
    ctx.restore();
  };

  draw(drawClaudeLogo, 0, 0);
  draw(drawGeminiLogo, 1, 0);
  draw(drawChatGptLogo, 0, 1);
  draw(drawOpencodeLogo, 1, 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
