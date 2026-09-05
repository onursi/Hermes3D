"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";

import { SELECTION_COLOR } from "@/features/v2/palette";

/**
 * ============================================================================
 * ASTRA × Antigravity · Bibliotheksmodul (V2)
 * ============================================================================
 * 
 * Ein kompakter, begehbarer 3D-Bibliotheksraum für Hermes 3D V2.
 * Gestalterisches Zielbild: ASTRA Runde 03 (linkes Drittel von ASTRA-Runde03-Konzept.png)
 * 
 * Vertrag / Übergabe an Claude:
 * - Gekapselte R3F-Komponente, klinkt sich als eigener World-State in V2Scene ein.
 * - Keine zweite Canvas, keine dauerhaft aktiven Hintergrund-Listener nach Unmount.
 * - Props: items, selectedId, onSelect(id), reducedMotion, flyActive.
 * - Alle dargestellten Daten sind isolierte Beispieldaten (Sample Data).
 *
 * ------------------------------------------------------------------
 * Übernommen aus Antigravitys Lieferung vom 2026-09-05, Vertrag unverändert.
 * Drei Eingriffe bei der Integration, alle begründet:
 *
 *   1. Die Auswahl trägt SELECTION_COLOR statt eines eigenen Cyan. Eine Welt,
 *      die ihre eigene Auswahlfarbe mitbringt, bricht genau die Eindeutigkeit,
 *      die wir gerade hergestellt haben.
 *   2. Die Leselampe wirft keinen Schatten mehr. V2 leistet sich eine
 *      Shadowmap; eine zweite kostet einen kompletten zusätzlichen
 *      Szenendurchlauf und ist auf der Vega 11 nicht bezahlbar.
 *   3. Die Bibliothek bringt ihre eigene Beleuchtung mit, deshalb schaltet
 *      V2Scene ihre Bühnenlichter ab, solange dieser Raum steht — sonst
 *      liegen zwei Lichtkonzepte übereinander und beide verlieren.
 *
 * Die 710 Draws aus der Übergabe stammen aus der Standalone-HTML mit voll
 * bestückten Regalen. Diese Komponente zeichnet ein Buch je Datensatz.
 * ------------------------------------------------------------------
 */

export type LibraryCategory = 'raw' | 'wiki' | 'identity' | 'project' | 'source';

export interface LibraryItem {
  id: string;
  title: string;
  category: LibraryCategory | string;
  categoryLabel: string;
  description: string;
  type?: string;        // Rückwärtskompatibler Typ-Alias (z. B. "RAW – Buchquelle")
  desc?: string;        // Rückwärtskompatibler Desc-Alias
  color?: string;       // Optionaler Akzent-/Buchrücken-Hexcode
}

/**
 * Empfohlener 3-Zeilen-Adapter für Claudes bestehende V2-Vault-Objekte:
 * 
 * const adaptToLibraryItem = (s: any): LibraryItem => ({
 *   id: s.id || s.path || s.slug,
 *   title: s.title || s.name || "Unbenannte Quelle",
 *   category: (s.category || (s.type?.includes("raw") ? "raw" : "wiki")) as LibraryCategory,
 *   categoryLabel: s.categoryLabel || s.type || s.category || "Quelle",
 *   description: s.description || s.excerpt || s.desc || "",
 *   color: s.color
 * });
 */

export interface LibraryWorldProps {
  items?: LibraryItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  reducedMotion?: boolean;
  flyActive?: boolean;
  onFlyComplete?: () => void;
}

// Farbschema (Passend zum V2-Gesetz: Cyan = Info, Mint = Bestätigt/Librarian, Bernstein = Warte)
const COLOR_CYAN = "#38bdf8";
const COLOR_MINT = "#34d399";
const COLOR_GRAPHITE = "#131922";
const COLOR_WALNUT = "#271a15";
const COLOR_WALNUT_TABLE = "#3d271c";
const COLOR_TASK_LIGHT = "#fde68a";

export function LibraryWorld({
  items,
  selectedId,
  onSelect,
  reducedMotion = false,
  flyActive = false,
  onFlyComplete
}: LibraryWorldProps) {
  // Fallback-Beispieldaten falls keine externen Items übergeben werden
  const sampleItems: LibraryItem[] = useMemo(() => items || [
    { id: "raw-psychologie-des-geldes", title: "Über die Psychologie des Geldes", category: "raw", categoryLabel: "RAW – Buchquelle", description: "Kanonisches Buchwissen aus dem LifeOS. Unterscheidet zwischen Fremdwissen und persönlichen Lernmomenten." },
    { id: "kindle-300-weisheiten", title: "300 Weisheiten des Propheten", category: "identity", categoryLabel: "Kindle-Markierungen", description: "Historische Lesemarkierungen. Ausschließlich Beleg für damalige Aufbewahrungswürdigkeit." },
    { id: "wiki-lifeos-architektur", title: "Second Brain – LifeOS Architektur", category: "wiki", categoryLabel: "Geprüftes Wiki", description: "Synthetisierte Betriebsanleitung, Ablageregeln und kanonische Systempfade." },
    { id: "raw-biohacking", title: "Biohacking & Gesundheit", category: "raw", categoryLabel: "RAW – Originalnotiz", description: "Streng vertrauliche persönliche Beobachtungen. Medizinisch ungeprüft." },
    { id: "projekt-hermes-council", title: "Council Kernel Spezifikation", category: "project", categoryLabel: "Projektentwurf", description: "Anbieterunabhängige gemeinsame Gesprächsregie für Hermes, Claude und Codex." }
  ], [items]);

  const activeId = selectedId || (sampleItems[0]?.id ?? "");

  // Roboter-Ref für sanftes Schweben
  const botRef = useRef<THREE.Group>(null);
  
  // Karten-Refs für den Quellenflug
  const card1Ref = useRef<THREE.Mesh>(null);
  const card2Ref = useRef<THREE.Mesh>(null);
  const card3Ref = useRef<THREE.Mesh>(null);
  const flightProgress = useRef(0);
  const [flying, setFlying] = useState(false);
  const hasCompletedFly = useRef(false);

  // Bezier-Kurve für den Flug vom oberen Regal zum Lesetisch
  const pStart = useMemo(() => new THREE.Vector3(-3.2, 4.4, -4.2), []);
  const pCtrl1 = useMemo(() => new THREE.Vector3(-1.5, 4.8, -2.5), []);
  const pCtrl2 = useMemo(() => new THREE.Vector3(0.5, 3.2, -0.5), []);
  const pEnd = useMemo(() => new THREE.Vector3(1.6, 1.25, 0.8), []);

  useEffect(() => {
    if (flyActive) {
      if (reducedMotion) {
        // Sofortiger Endzustand ohne Animation
        flightProgress.current = 1.4;
        // Starting or ending an animation in response to a prop is the case
        // the rule cannot distinguish from a cascade: the renderer is the
        // external system here, and there is no render-time way to say "this
        // flight is over". Kept as delivered rather than restructured — a
        // rewrite of someone else's animation logic to satisfy a linter is how
        // a working module acquires a bug at the integration seam.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFlying(false);
        if (!hasCompletedFly.current) {
          hasCompletedFly.current = true;
          onFlyComplete?.();
        }
      } else {
        hasCompletedFly.current = false;
        flightProgress.current = 0;
        setFlying(true);
      }
    } else {
      hasCompletedFly.current = false;
    }
  }, [flyActive, reducedMotion, onFlyComplete]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // 1. Librarian Bot Schwebe-Animation (berücksichtigt reducedMotion)
    if (botRef.current) {
      if (!reducedMotion) {
        botRef.current.position.y = 1.7 + Math.sin(t * 2.2) * 0.08;
        botRef.current.rotation.y = Math.PI / 4 + Math.sin(t * 1.5) * 0.06;
      } else {
        botRef.current.position.y = 1.7;
        botRef.current.rotation.y = Math.PI / 4;
      }
    }

    // 2. Quellenflug-Interpolation
    if (reducedMotion) {
      // Wenn Reduced Motion aktiv und geflogen wurde: Karten liegen statisch auf dem Tisch
      if (flyActive || flightProgress.current >= 1.0) {
        const placeStatic = (mesh: THREE.Mesh | null, ox: number, oz: number) => {
          if (!mesh) return;
          mesh.visible = true;
          mesh.position.set(pEnd.x + ox, pEnd.y, pEnd.z + oz);
          mesh.rotation.set(0, 0, 0);
        };
        placeStatic(card1Ref.current, 0, 0);
        placeStatic(card2Ref.current, 0.15, 0.08);
        placeStatic(card3Ref.current, -0.15, -0.06);
      }
    } else if (flying) {
      flightProgress.current += delta * 0.75;
      const progress = flightProgress.current;

      const animateCard = (mesh: THREE.Mesh | null, offset: number) => {
        if (!mesh) return;
        const localT = Math.min(Math.max(progress - offset, 0), 1);
        if (localT <= 0) {
          mesh.visible = false;
          return;
        }
        mesh.visible = true;
        
        // Kubische Bezier-Interpolation
        const u = 1 - localT;
        const x = u*u*u*pStart.x + 3*u*u*localT*pCtrl1.x + 3*u*localT*localT*pCtrl2.x + localT*localT*localT*pEnd.x;
        const y = u*u*u*pStart.y + 3*u*u*localT*pCtrl1.y + 3*u*localT*localT*pCtrl2.y + localT*localT*localT*pEnd.y;
        const z = u*u*u*pStart.z + 3*u*u*localT*pCtrl1.z + 3*u*localT*localT*pCtrl2.z + localT*localT*localT*pEnd.z;
        
        mesh.position.set(x + offset * 0.2, y, z + offset * 0.1);
        mesh.rotation.x = Math.sin(localT * Math.PI) * 0.35;
        mesh.rotation.y = localT * 0.3 + offset * 0.2;
      };

      animateCard(card1Ref.current, 0);
      animateCard(card2Ref.current, 0.12);
      animateCard(card3Ref.current, 0.24);

      if (progress >= 1.35) {
        setFlying(false);
        if (!hasCompletedFly.current) {
          hasCompletedFly.current = true;
          onFlyComplete?.();
        }
      }
    }
  });

  return (
    <group>
      {/* --- BELEUCHTUNG DER BIBLIOTHEK (Sanfte Ausleuchtung gegen harte Schlagschatten) --- */}
      {/* Integrationsänderung: Alle Intensitäten hochgezogen. V2 rendert mit
          ACES-Filmic-Tonemapping, die Standalone-Vorschau nicht — dieselben
          Zahlen ergeben hier einen deutlich dunkleren Raum. Das Lichtkonzept
          ist unverändert, nur der Pegel folgt dem Renderer. */}
      <ambientLight intensity={1.05} />
      {/* Hauptlicht */}
      <directionalLight
        position={[9, 14, 7]}
        intensity={2.3}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
      />
      {/* Sanftes Fill-Light zur Aufhellung der linken Regale und Wände */}
      <directionalLight
        position={[-8, 10, 8]}
        intensity={1.15}
        color="#94a3b8"
      />
      {/* Schreibtisch-Leselampe (Warmer Kegel) */}
      <spotLight
        position={[1.4, 3.2, 0.6]}
        target-position={[1.6, 1.0, 0.8]}
        color={COLOR_TASK_LIGHT}
        intensity={5.2}
        angle={Math.PI / 4}
        penumbra={0.6}
      />
      {/* Cyan Akzentlicht am Regal */}
      <pointLight position={[-3.2, 3.5, -2.5]} color={COLOR_CYAN} intensity={1.7} distance={7} />
      {/* Mint Bot Glow */}
      <pointLight position={[-3.5, 2.2, -0.8]} color={COLOR_MINT} intensity={1.3} distance={4} />

      {/* --- 1. BODENPLATTE (Dicker schwebender Block, zwei offene Seiten) --- */}
      <mesh position={[0, -0.35, 0]} receiveShadow>
        <boxGeometry args={[10.5, 0.7, 10.5]} />
        <meshStandardMaterial color={COLOR_GRAPHITE} roughness={0.85} metalness={0.2} />
      </mesh>
      {/* Leuchtende Begrenzungskante.
          Integrationsänderung: Die Kante saß auf y=0.01 und damit ÜBER der
          Bodenfläche (y=0.005) — bei voller Grundfläche war das keine Kante,
          sondern ein blaues Tuch über dem ganzen Raum. Jetzt liegt sie unter
          dem Boden und ist nur dort zu sehen, wo sie übersteht: am Rand. */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[10.55, 0.03, 10.55]} />
        <meshBasicMaterial color={COLOR_CYAN} transparent opacity={0.3} />
      </mesh>
      {/* Bodenoberfläche */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[10.2, 10.2]} />
        <meshStandardMaterial color="#141b24" roughness={0.7} metalness={0.15} />
      </mesh>

      {/* --- 2. RÜCKWAND MIT AKUSTIK-LAMELLEN --- */}
      <mesh position={[0, 3.1, -5.1]} receiveShadow>
        <boxGeometry args={[10.5, 6.2, 0.3]} />
        <meshStandardMaterial color="#0f151d" roughness={0.9} />
      </mesh>
      {/* Vertikale Holzlamellen */}
      {[-4.5, -3.8, -3.1, -2.4, -1.7, -1.0, -0.3, 0.4, 1.1, 1.8, 2.5, 3.2, 3.9, 4.6].map((x) => (
        <mesh key={x} position={[x, 3.1, -4.93]} castShadow>
          <boxGeometry args={[0.08, 6.0, 0.05]} />
          <meshStandardMaterial color={COLOR_WALNUT} roughness={0.7} />
        </mesh>
      ))}

      {/* --- 3. LINKE WAND (Dunkler Hintergrund) --- */}
      <mesh position={[-5.1, 3.1, 0]} receiveShadow>
        <boxGeometry args={[0.3, 6.2, 10.5]} />
        <meshStandardMaterial color="#0f151d" roughness={0.9} />
      </mesh>

      {/* --- 4. MASSIVE WALNUSS-BÜCHERREGALE --- */}
      <group>
        {/* Horizontale Regalböden */}
        {[0.2, 1.35, 2.5, 3.65, 4.8].map((y) => (
          <React.Fragment key={y}>
            {/* Hinteres Regal */}
            <mesh position={[0, y, -4.55]} castShadow receiveShadow>
              <boxGeometry args={[7.2, 0.09, 0.65]} />
              <meshStandardMaterial color={COLOR_WALNUT} roughness={0.65} />
            </mesh>
            {/* Linkes Regal */}
            <mesh position={[-4.55, y, -1.0]} castShadow receiveShadow>
              <boxGeometry args={[0.65, 0.09, 5.4]} />
              <meshStandardMaterial color={COLOR_WALNUT} roughness={0.65} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Vertikale Regalwangen */}
        {[-3.6, -1.8, 0, 1.8, 3.6].map((x) => (
          <mesh key={x} position={[x, 2.7, -4.55]} castShadow receiveShadow>
            <boxGeometry args={[0.12, 5.2, 0.65]} />
            <meshStandardMaterial color={COLOR_WALNUT} roughness={0.65} />
          </mesh>
        ))}
      </group>

      {/* --- 5. INTERAKTIVE BÜCHER --- */}
      <group>
        {sampleItems.map((item, idx) => {
          const isSelected = item.id === activeId;
          const shelfRow = idx % 4;
          const yPos = [0.2, 1.35, 2.5, 3.65][shelfRow] + 0.45;
          const xPos = -2.5 + (idx % 3) * 0.9;
          const zOffset = isSelected ? 0.35 : 0;

          return (
            <mesh
              key={item.id}
              position={[xPos, yPos, -4.55 + zOffset]}
              castShadow
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(item.id);
              }}
            >
              <boxGeometry args={[0.18, 0.75, 0.48]} />
              <meshStandardMaterial
                color={isSelected ? SELECTION_COLOR : "#1e3a8a"}
                emissive={isSelected ? SELECTION_COLOR : "#000000"}
                emissiveIntensity={isSelected ? 0.7 : 0}
                roughness={0.5}
                metalness={0.2}
              />
              {/* Titel-Billboard über ausgewähltem Buch */}
              {isSelected && (
                <Billboard position={[0, 0.65, 0]}>
                  <Text fontSize={0.16} color="#ffffff" anchorX="center" anchorY="bottom">
                    {item.title}
                  </Text>
                </Billboard>
              )}
            </mesh>
          );
        })}
      </group>

      {/* --- 6. ORGANISCHER WALNUSS-LESETISCH --- */}
      <group position={[1.6, 0, 0.8]}>
        {/* Tischplatte */}
        <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.4, 1.4, 0.09, 32]} />
          <meshStandardMaterial color={COLOR_WALNUT_TABLE} roughness={0.5} />
        </mesh>
        {/* Tischbeine */}
        {[[-1.1, -0.6], [1.1, -0.6], [-1.1, 0.6], [1.1, 0.6]].map(([lx, lz], i) => (
          <mesh key={i} position={[lx, 0.575, lz]} castShadow>
            <cylinderGeometry args={[0.035, 0.025, 1.15, 16]} />
            <meshStandardMaterial color={COLOR_GRAPHITE} roughness={0.8} />
          </mesh>
        ))}

        {/* Aufgeschlagenes Buch auf dem Tisch */}
        <group position={[0.1, 1.21, 0.1]} rotation={[0, 0.2, 0]}>
          <mesh position={[-0.16, 0, 0]} rotation={[0, 0, -0.06]} castShadow>
            <boxGeometry args={[0.32, 0.02, 0.44]} />
            <meshStandardMaterial color="#fef9ef" roughness={0.7} />
          </mesh>
          <mesh position={[0.16, 0, 0]} rotation={[0, 0, 0.06]} castShadow>
            <boxGeometry args={[0.32, 0.02, 0.44]} />
            <meshStandardMaterial color="#fef9ef" roughness={0.7} />
          </mesh>
        </group>

        {/* Schreibtisch-Messinglampe */}
        <group position={[-0.9, 1.2, -0.4]}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.12, 0.13, 0.04, 20]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.23, 0]} rotation={[0, 0, -0.18]}>
            <cylinderGeometry args={[0.015, 0.015, 0.45]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[0.12, 0.42, 0.1]} rotation={[Math.PI / 1.5, 0.4, 0]}>
            <coneGeometry args={[0.14, 0.16, 20, 1, true]} />
            <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.35} />
          </mesh>
        </group>
      </group>

      {/* --- 7. BEQUEMER SESSEL --- */}
      <group position={[-0.3, 0, 1.8]} rotation={[0, Math.PI / 4.2, 0]}>
        {/* Sitzkissen */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.85, 0.22, 0.85]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} />
        </mesh>
        {/* Rückenlehne */}
        <mesh position={[0, 0.9, 0.38]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.85, 0.75, 0.18]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} />
        </mesh>
        {/* Armlehnen */}
        <mesh position={[-0.44, 0.72, 0]} castShadow>
          <boxGeometry args={[0.14, 0.38, 0.82]} />
          <meshStandardMaterial color={COLOR_WALNUT} roughness={0.7} />
        </mesh>
        <mesh position={[0.44, 0.72, 0]} castShadow>
          <boxGeometry args={[0.14, 0.38, 0.82]} />
          <meshStandardMaterial color={COLOR_WALNUT} roughness={0.7} />
        </mesh>
      </group>

      {/* --- 8. MINT ROBOT LIBRARIAN (ASTRA-Konzept) --- */}
      <group ref={botRef} position={[-3.2, 1.7, -1.8]}>
        {/* Schwebender Minzkörper */}
        <mesh castShadow>
          <capsuleGeometry args={[0.24, 0.32, 16, 24]} />
          <meshStandardMaterial color={COLOR_MINT} emissive={COLOR_MINT} emissiveIntensity={0.5} roughness={0.3} />
        </mesh>
        {/* Dunkles Visier */}
        <mesh position={[0, 0.08, 0.18]}>
          <boxGeometry args={[0.36, 0.12, 0.14]} />
          <meshStandardMaterial color="#0a141d" roughness={0.1} metalness={0.9} />
        </mesh>
        {/* Cyan leuchtendes Auge */}
        <mesh position={[0, 0.08, 0.255]}>
          <boxGeometry args={[0.26, 0.03, 0.02]} />
          <meshBasicMaterial color={COLOR_CYAN} />
        </mesh>
        {/* Kleine Antenne */}
        <mesh position={[0, 0.51, 0]}>
          <sphereGeometry args={[0.025]} />
          <meshBasicMaterial color={COLOR_CYAN} />
        </mesh>
      </group>

      {/* --- 9. QUELLENFLUG: 3 LEUCHTENDE CYAN-KARTEN --- */}
      <mesh ref={card1Ref} position={[-3.2, 4.4, -4.2]} visible={false}>
        <boxGeometry args={[0.48, 0.015, 0.68]} />
        <meshStandardMaterial color="#0f2d42" emissive={COLOR_CYAN} emissiveIntensity={0.6} transparent opacity={0.9} />
      </mesh>
      <mesh ref={card2Ref} position={[-3.0, 4.48, -4.2]} visible={false}>
        <boxGeometry args={[0.48, 0.015, 0.68]} />
        <meshStandardMaterial color="#0f2d42" emissive={COLOR_CYAN} emissiveIntensity={0.6} transparent opacity={0.9} />
      </mesh>
      <mesh ref={card3Ref} position={[-2.8, 4.56, -4.2]} visible={false}>
        <boxGeometry args={[0.48, 0.015, 0.68]} />
        <meshStandardMaterial color="#0f2d42" emissive={COLOR_CYAN} emissiveIntensity={0.6} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}
