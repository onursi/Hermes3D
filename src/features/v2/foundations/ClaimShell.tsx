"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import type { Claim } from "./claims";

/**
 * Die Anspruchsschale um den Hermes-Kern.
 *
 * Jeder Körper ist **ein echtes Objekt mit einer `id`** — keine Zierpartikel.
 * Das ist die Bedingung, ohne die die ganze Anzeige wertlos wäre: Wer drei
 * Körper sieht, muss sich darauf verlassen können, dass drei Dinge etwas von
 * ihm wollen, und nicht rätseln, ob zwei davon Effekt sind.
 *
 * Abgelesen wird ohne ein Wort: **Anzahl** sagt wie viel, **Rot** sagt
 * liegengeblieben. Der Text kommt erst beim Näherkommen dazu.
 *
 * Was hier bewusst fehlt: Zahlenabzeichen, Symbole je Art, ein Zähler für
 * Undatiertes. Onur lässt Aufgaben absichtlich ohne Datum, um sich keinen
 * Tagesdruck zu machen — sie hier zu zeigen, und sei es als stille Zahl, wäre
 * genau der Druck durch die Hintertür.
 */

const FARBE_OFFEN = "#7fd7ff";
const FARBE_LIEGT = "#ffb45c";

/** Mehr Körper als das wird Matsch; der Rest wird zusammengefasst. */
const MAX_KOERPER = 5;

export function ClaimShell({
  claims,
  radius = 0.95,
  onSelect,
}: {
  claims: Claim[];
  radius?: number;
  onSelect?: (claim: Claim) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  /**
   * Die Bahn wird einmal je Zusammenstellung gerechnet, nicht pro Bild.
   *
   * Der Winkelabstand ist gleichmäßig, damit man die Anzahl zählen kann, ohne
   * hinzusehen — bei zufälliger Verteilung sieht vier wie drei aus.
   */
  const koerper = useMemo(() => {
    const sichtbar = claims.slice(0, MAX_KOERPER);
    return sichtbar.map((claim, i) => ({
      claim,
      winkel: (i / Math.max(sichtbar.length, 1)) * Math.PI * 2,
      /** Leichte Höhenstreuung, damit sie sich nicht gegenseitig verdecken. */
      hoehe: Math.sin(i * 1.7) * 0.16,
    }));
  }, [claims]);

  const rest = Math.max(0, claims.length - MAX_KOERPER);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    // Langsam. Die Schale soll ablesbar sein, nicht beschäftigt wirken.
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.09;
  });

  if (claims.length === 0) return null;

  return (
    <group ref={groupRef} position={[0, 1.35, 0]}>
      {koerper.map(({ claim, winkel, hoehe }) => {
        const farbe = claim.overdue ? FARBE_LIEGT : FARBE_OFFEN;
        const x = Math.cos(winkel) * radius;
        const z = Math.sin(winkel) * radius;
        return (
          <group key={claim.id} position={[x, hoehe, z]}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelect?.(claim);
              }}
            >
              <sphereGeometry args={[claim.overdue ? 0.075 : 0.058, 16, 16]} />
              <meshStandardMaterial
                color={farbe}
                emissive={farbe}
                emissiveIntensity={claim.overdue ? 2.1 : 1.3}
                roughness={0.3}
              />
            </mesh>

            {/*
              Der Titel steht am Körper, nicht in einer Liste daneben. Sonst
              muss man zwischen Raum und Text hin und her springen, um zu
              wissen, welcher Punkt welcher ist.
            */}
            <Billboard>
              <Text
                position={[0, 0.16, 0]}
                fontSize={0.072}
                color={farbe}
                anchorX="center"
                anchorY="bottom"
                maxWidth={1.5}
                outlineWidth={0.004}
                outlineColor="#05080d"
              >
                {claim.title.length > 34 ? `${claim.title.slice(0, 33)}…` : claim.title}
              </Text>
              <Text
                position={[0, 0.105, 0]}
                fontSize={0.048}
                color="#9fb2c4"
                anchorX="center"
                anchorY="bottom"
                maxWidth={1.5}
              >
                {claim.reason}
              </Text>
            </Billboard>
          </group>
        );
      })}

      {/*
        Der Rest wird gezählt, nicht gezeigt. Fünf Körper sind ablesbar,
        zwölf sind eine Wolke — und eine Wolke sagt nur noch „viel".
      */}
      {rest > 0 ? (
        <Billboard position={[0, -0.42, 0]}>
          <Text fontSize={0.055} color="#9fb2c4" anchorX="center" anchorY="middle">
            {`und ${rest} weitere`}
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}
