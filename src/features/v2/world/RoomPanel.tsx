"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

/**
 * Eine Arbeitsfläche, die im Raum steht statt am Bildschirmrand.
 *
 * Bisher öffnete ein Dokument den Leser als Leiste rechts. Das ist lesbar und
 * fühlt sich an wie eine Webseite über einem Bild. Was Onur wollte, ist etwas
 * anderes: „eine scharfe 2D-Arbeitsfläche öffnet sich direkt im Raum" — an der
 * Stelle, an der das Dokument liegt, mit dem Raum sichtbar dahinter.
 *
 * **Warum HTML und keine Textur.** Text als Textur auf einer Fläche ist bei
 * jeder Entfernung unscharf und bei kleiner Schrift unlesbar; man müsste die
 * Textur ständig neu zeichnen. `Html` von drei setzt echte DOM-Knoten über die
 * Canvas und rechnet ihre Lage aus der 3D-Position — der Text bleibt damit
 * gestochen scharf und auswählbar, und die Fläche steht trotzdem im Raum und
 * bewegt sich mit ihm.
 *
 * **Was das kostet:** keinen einzigen Zeichenaufruf. Die Fläche ist kein
 * Objekt in der Szene, sondern ein Fenster darüber, dessen Ort aus der Szene
 * kommt. Was sie kostet, ist Layoutarbeit im Browser — und die fällt nur an,
 * solange etwas offen ist.
 */

export function RoomPanel({
  position,
  title,
  subtitle,
  children,
  onClose,
  tone = "#a5f3ff",
}: {
  /** Wo im Raum die Fläche hängt — üblicherweise die Notiz, die geöffnet wurde. */
  position: THREE.Vector3;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  tone?: string;
}) {
  const anchor = useRef<THREE.Group>(null);

  /**
   * Die Fläche dreht sich zur Kamera, kippt aber nicht mit ihr.
   *
   * Voll zur Kamera gedreht wirkt sie wie ein Aufkleber auf der Linse. Nur um
   * die Hochachse gedreht bleibt sie ein Ding im Raum, das einem zugewandt
   * ist — dasselbe Prinzip wie bei den Namen auf dem Deck.
   */
  useFrame(({ camera }) => {
    if (!anchor.current) return;
    anchor.current.rotation.y = Math.atan2(
      camera.position.x - position.x,
      camera.position.z - position.z,
    );
  });

  return (
    <group position={position}>
      <group ref={anchor}>
        {/* Ein dünner Rahmen im Raum, damit die Fläche einen Ort hat und nicht
            frei schwebt. Zwei Aufrufe, und sie sind die ganze Geometrie. */}
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[3.05, 2.15]} />
          <meshBasicMaterial color="#070c12" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        <lineSegments position={[0, 0, -0.015]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(3.05, 2.15)]} />
          <lineBasicMaterial color={tone} transparent opacity={0.55} />
        </lineSegments>

        <Html
          transform
          distanceFactor={2.6}
          position={[0, 0, 0]}
          // Ohne das fängt die Fläche jeden Zeiger ab, auch neben dem Text —
          // dann kann man den Raum dahinter nicht mehr bedienen.
          pointerEvents="auto"
          style={{ pointerEvents: "auto" }}
        >
          <div
            style={{
              width: 620,
              maxHeight: 440,
              overflowY: "auto",
              background: "rgba(7,12,18,.97)",
              border: `1px solid ${tone}44`,
              color: "#e8eef6",
              fontFamily: "system-ui, sans-serif",
              padding: "18px 22px 20px",
              borderRadius: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 10,
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: `${tone}`,
                    opacity: 0.75,
                    marginBottom: 4,
                  }}
                >
                  Im Raum geöffnet
                </div>
                <h2 style={{ margin: 0, fontSize: 19, lineHeight: 1.25, fontWeight: 600 }}>
                  {title}
                </h2>
                {subtitle ? (
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 12,
                      fontFamily: "ui-monospace, monospace",
                      color: "#8fa0b0",
                    }}
                  >
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "transparent",
                  border: `1px solid ${tone}55`,
                  color: tone,
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: ".14em",
                  padding: "4px 9px",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                ESC
              </button>
            </div>
            <div style={{ marginTop: 14 }}>{children}</div>
          </div>
        </Html>
      </group>
    </group>
  );
}
