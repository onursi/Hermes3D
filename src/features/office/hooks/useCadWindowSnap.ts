"use client";

import { useCallback, useRef, useState } from "react";
import { cyberAudio } from "@/lib/sound/cyberAudio";

export type CadDockZone = "none" | "left" | "right" | "bottom" | "top" | "center";

export function useCadWindowSnap({
  storageKey,
  initialPosition,
  width = 400,
  height = 160,
  snapThreshold = 36,
}: {
  storageKey?: string;
  initialPosition?: () => { x: number; y: number };
  width?: number;
  height?: number;
  snapThreshold?: number;
}) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined" && storageKey) {
      try {
        const saved = localStorage.getItem(`cad_window_pos_${storageKey}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            return parsed;
          }
        }
      } catch {}
    }
    return initialPosition ? initialPosition() : { x: 20, y: 100 };
  });

  const [dockZone, setDockZone] = useState<CadDockZone>("none");
  const [isMinimized, setIsMinimized] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });
  const lastSnapZoneRef = useRef<CadDockZone>("none");

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...pos };
    lastSnapZoneRef.current = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;

      let nextX = initialPosRef.current.x + dx;
      let nextY = initialPosRef.current.y + dy;

      const winW = window.innerWidth;
      const winH = window.innerHeight;
      let detectedZone: CadDockZone = "none";

      // 1. Horizontal Center Snap
      const centerX = Math.round((winW - width) / 2);
      if (Math.abs(nextX - centerX) < snapThreshold) {
        nextX = centerX;
        detectedZone = "center";
      }

      // 2. Left Edge Snap
      if (nextX < snapThreshold) {
        nextX = 14;
        detectedZone = "left";
      }

      // 3. Right Edge Snap
      const rightEdge = winW - width - 14;
      if (winW - (nextX + width) < snapThreshold) {
        nextX = rightEdge;
        detectedZone = "right";
      }

      // 4. Top Edge Snap
      if (nextY < snapThreshold) {
        nextY = 14;
        detectedZone = "top";
      }

      // 5. Bottom Edge Snap
      const bottomEdge = winH - height - 14;
      if (winH - (nextY + height) < snapThreshold) {
        nextY = bottomEdge;
        detectedZone = "bottom";
      }

      // Hard Boundary Clamping - NEVER exceed screen edges
      nextX = Math.max(10, Math.min(winW - width - 10, nextX));
      nextY = Math.max(10, Math.min(winH - height - 10, nextY));

      // Sound & Zone change
      if (detectedZone !== "none" && detectedZone !== lastSnapZoneRef.current) {
        cyberAudio.playSnap();
        lastSnapZoneRef.current = detectedZone;
      } else if (detectedZone === "none") {
        lastSnapZoneRef.current = "none";
      }

      setDockZone(detectedZone);
      setPos({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (storageKey) {
        try {
          localStorage.setItem(`cad_window_pos_${storageKey}`, JSON.stringify(pos));
        } catch {}
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [height, pos, snapThreshold, storageKey, width]);

  return {
    pos,
    setPos,
    dockZone,
    isMinimized,
    setIsMinimized,
    toggleMinimize: () => setIsMinimized((prev) => !prev),
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      className: "cursor-grab active:cursor-grabbing select-none",
    },
  };
}
