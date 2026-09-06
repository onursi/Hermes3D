"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { AREA_COLORS, AREA_FALLBACK, SELECTION_COLOR } from "@/features/v2/palette";
import { useV2 } from "@/features/v2/state";
import { useDocument } from "@/features/v2/useDocument";
import type { Project, ProjectArea, ProjectNote } from "@/features/v2/useProjects";
import { RoomPanel } from "@/features/v2/world/RoomPanel";

/**
 * Ein Projekt von innen.
 *
 * Bisher war ein Projekt ein Liegeplatz in der Ergebniswerft: ein Turm, dessen
 * Höhe die Notizanzahl zeigt. Man konnte es ansehen und nicht betreten. Das
 * hier ist das Innere — der erste vollständig benutzbare Ort hinter einem
 * Portal, und die Vorlage für jedes weitere Projekt.
 *
 * **Die Bereiche sind Onurs Ordner, nicht meine Erfindung.**
 *
 * Der naheliegende Entwurf wären drei feste Bereiche gewesen: Quellen,
 * Werkbank, Ergebnisse. Genau das wäre falsch — seine Projekte *haben* schon
 * eine Ordnung („Architektur & Betrieb", „Code", „Website", „Ströer
 * Kundenportfolio"), und die ist von ihm. Ein Bereich ist deshalb ein
 * Unterordner. Was direkt im Projektordner liegt, wird ein Bereich mit dem
 * Namen des Projekts. Ein Projekt ohne Unterordner hat einen Bereich, und das
 * ist die richtige Antwort und keine halbe Welt.
 *
 * **Kosten.** Alle Notizen aller Bereiche liegen in *einem* InstancedMesh, die
 * Bereichsschalen in einem zweiten. Eine einzige Bildschleife bewegt beides.
 * Das ist dieselbe Regel, die das Deck von 122 auf 55 Zeichenaufrufe gebracht
 * hat: ein Aufruf pro Sache, nie einer pro Exemplar.
 */

/** Wie weit die Bereiche vom Kern entfernt liegen. */
const AREA_RADIUS = 7.4;
/** Grösse einer Bereichsschale, abgeleitet aus der Notizanzahl. */
const areaSize = (noteCount: number): number =>
  Math.max(1.15, Math.sqrt(noteCount) * 0.62);

export type NoteHandle = {
  note: ProjectNote;
  area: ProjectArea;
  position: THREE.Vector3;
};

/**
 * Wo alles steht.
 *
 * Fest aus den Daten gerechnet und in stabiler Reihenfolge: Ein Bereich soll
 * zwischen zwei Besuchen nicht wandern. Ein Ort, den man lernen kann, ist mehr
 * wert als eine Anordnung, die an einem einzelnen Tag optimal ist.
 */
export function layoutProject(project: Project): {
  areas: { area: ProjectArea; position: THREE.Vector3; size: number; colour: string }[];
  notes: NoteHandle[];
} {
  const list = project.areas ?? [];
  const areas = list.map((area, index) => {
    // Nach vorn offen, damit der Eintritt frei bleibt und niemand hinter dem
    // Kern steht: derselbe Bogen wie beim Kommandodeck.
    const spread = Math.PI * 1.62;
    const t = list.length === 1 ? 0.5 : index / (list.length - 1);
    const angle = -Math.PI / 2 - spread / 2 + spread * t;
    return {
      area,
      position: new THREE.Vector3(
        Math.cos(angle) * AREA_RADIUS,
        // Grössere Bereiche liegen etwas tiefer — das gibt dem Raum eine
        // Neigung, an der man sich orientiert, ohne dass etwas verdeckt wird.
        0.4 - Math.min(1, area.noteCount / 24) * 0.9,
        Math.sin(angle) * AREA_RADIUS,
      ),
      size: areaSize(area.noteCount),
      colour: AREA_COLORS[area.folder] ?? pickColour(area.name),
    };
  });

  const notes: NoteHandle[] = [];
  for (const entry of areas) {
    const count = entry.area.notes.length;
    entry.area.notes.forEach((note, index) => {
      // Fibonacci-Punkte auf der Schale: gleichmässig verteilt, ohne Pole und
      // ohne Naht, und ohne dass zwei Notizen aufeinanderliegen.
      const k = index + 0.5;
      const phi = Math.acos(1 - (2 * k) / Math.max(1, count));
      const theta = Math.PI * (1 + Math.sqrt(5)) * k;
      const r = entry.size * 0.92;
      notes.push({
        note,
        area: entry.area,
        position: new THREE.Vector3(
          entry.position.x + Math.cos(theta) * Math.sin(phi) * r,
          entry.position.y + Math.cos(phi) * r * 0.72,
          entry.position.z + Math.sin(theta) * Math.sin(phi) * r,
        ),
      });
    });
  }

  return { areas, notes };
}

/** Eine Farbe je Bereich, wenn die Palette keine kennt — stabil über den Namen. */
function pickColour(name: string): string {
  const palette = ["#c8a77c", "#9dbbc8", "#c2b19a", "#a8b8a0", "#c9a6a6", "#a7a2c4"];
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return palette[sum % palette.length] ?? AREA_FALLBACK;
}

export function ProjectWorld({
  project,
  openPath,
  onOpenNote,
  onCloseNote,
}: {
  project: Project;
  /** Die gerade geöffnete Notiz, damit sie im Raum hervorsticht. */
  openPath: string | null;
  onOpenNote: (note: ProjectNote) => void;
  onCloseNote: () => void;
}) {
  const { prefs } = useV2();
  const { areas, notes } = useMemo(() => layoutProject(project), [project]);

  const shells = useRef<THREE.InstancedMesh>(null);
  const dots = useRef<THREE.InstancedMesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const live = useRef({ notes, hovered, openPath, reduced: prefs.reducedMotion });
  useEffect(() => {
    live.current = { notes, hovered, openPath, reduced: prefs.reducedMotion };
  }, [notes, hovered, openPath, prefs.reducedMotion]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.cursor = hovered !== null ? "pointer" : "auto";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [hovered]);

  /**
   * Die Trefferkugel von Hand setzen.
   *
   * Ein InstancedMesh merkt sich seine Hüllkugel beim ersten Strahlentest.
   * Wird sie berechnet, bevor die Bildschleife Matrizen geschrieben hat, ist
   * sie entartet — und danach ist nichts mehr anklickbar, dauerhaft und ohne
   * Fehlermeldung. Genau das ist auf dem Deck passiert und war nur durch
   * Abrastern zu finden.
   */
  useEffect(() => {
    const reach = new THREE.Sphere(new THREE.Vector3(0, 0, 0), AREA_RADIUS + 6);
    if (dots.current) dots.current.boundingSphere = reach.clone();
  }, [notes.length]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quaternion: new THREE.Quaternion(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(1, 1, 1),
      colour: new THREE.Color(),
    }),
    [],
  );

  /** Farben stehen fest, sobald das Projekt steht — nicht pro Bild. */
  useEffect(() => {
    if (shells.current) {
      for (let i = 0; i < areas.length; i += 1) {
        scratch.colour.set(areas[i].colour);
        shells.current.setColorAt(i, scratch.colour);
        scratch.position.copy(areas[i].position);
        scratch.scale.setScalar(areas[i].size);
        scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
        shells.current.setMatrixAt(i, scratch.matrix);
      }
      if (shells.current.instanceColor) shells.current.instanceColor.needsUpdate = true;
      shells.current.instanceMatrix.needsUpdate = true;
    }

    if (dots.current) {
      for (let i = 0; i < notes.length; i += 1) {
        const open = notes[i].note.path === openPath;
        scratch.colour.set(open ? SELECTION_COLOR : "#e8eef6");
        dots.current.setColorAt(i, scratch.colour);
      }
      if (dots.current.instanceColor) dots.current.instanceColor.needsUpdate = true;
    }
  }, [areas, notes, openPath, scratch]);

  /** Eine Schleife für alles: Notizen atmen, der Kern dreht sich langsam. */
  useFrame(({ clock }) => {
    const state = live.current;
    const now = state.reduced ? 0 : clock.elapsedTime;

    if (core.current && !state.reduced) {
      core.current.rotation.y = now * 0.12;
    }

    const mesh = dots.current;
    if (!mesh) return;
    for (let i = 0; i < state.notes.length; i += 1) {
      const handle = state.notes[i];
      const open = handle.note.path === state.openPath;
      const near = state.hovered === i;
      // Die geöffnete Notiz und die unter dem Zeiger werden grösser. Sonst ein
      // sehr leichtes Atmen, damit der Raum nicht erstarrt.
      const pulse = state.reduced ? 1 : 1 + Math.sin(now * 1.1 + i * 0.7) * 0.06;
      const scale = (open ? 2.1 : near ? 1.7 : 1) * pulse;
      scratch.position.copy(handle.position);
      scratch.scale.setScalar(scale);
      scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  const pick = (event: { stopPropagation: () => void; instanceId?: number }) => {
    event.stopPropagation();
    const handle = notes[event.instanceId ?? -1];
    if (handle) onOpenNote(handle.note);
  };

  const hoveredNote = hovered !== null ? notes[hovered] : null;
  /** Die geöffnete Notiz — die Fläche hängt an ihrem Ort, nicht am Bildrand. */
  const openHandle = openPath
    ? (notes.find((entry) => entry.note.path === openPath) ?? null)
    : null;

  return (
    <group>
      {/* Der Kern: das Projekt selbst. Kein Schild, ein Körper — man kann ihn
          umrunden, und er sagt beim Näherkommen, worum es geht. */}
      <mesh ref={core}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshStandardMaterial
          color="#1b2530"
          emissive={SELECTION_COLOR}
          emissiveIntensity={0.16}
          roughness={0.42}
          metalness={0.55}
          flatShading
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.62, 1]} />
        <meshBasicMaterial color={SELECTION_COLOR} wireframe transparent opacity={0.14} />
      </mesh>
      <pointLight color={SELECTION_COLOR} intensity={2.2} distance={16} decay={2} />

      <Billboard position={[0, 2.5, 0]}>
        <Text
          fontSize={0.42}
          color="#f3f7fb"
          anchorX="center"
          outlineWidth={0.012}
          outlineColor="#000000"
        >
          {project.name}
        </Text>
        <Text
          position={[0, -0.4, 0]}
          fontSize={0.19}
          color="#aebdcb"
          anchorX="center"
          outlineWidth={0.008}
          outlineColor="#000000"
        >
          {`${project.noteCount} Notizen · ${project.areas.length} ${
            project.areas.length === 1 ? "Bereich" : "Bereiche"
          }`}
        </Text>
      </Billboard>

      {/* Die Bereichsschalen: ein Aufruf für alle. */}
      <instancedMesh ref={shells} args={[undefined, undefined, Math.max(1, areas.length)]}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial wireframe transparent opacity={0.15} />
      </instancedMesh>

      {/* Die Notizen: ebenfalls ein Aufruf, egal wie viele. */}
      <instancedMesh
        ref={dots}
        args={[undefined, undefined, Math.max(1, notes.length)]}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(event.instanceId ?? null);
        }}
        onPointerOut={() => setHovered(null)}
        onClick={pick}
      >
        {/* Größer als nötig fürs Auge: eine Notiz muss man treffen können,
            ohne zu zielen. Mit 0,09 war sie sichtbar und kaum anklickbar. */}
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* Bereichsnamen. Immer sichtbar, weil sie die Ordnung des Raums sind —
          anders als Notiztitel, die erst auf Nachfrage erscheinen. */}
      {areas.map((entry) => (
        <Billboard
          key={entry.area.folder || "__root"}
          position={[entry.position.x, entry.position.y + entry.size + 0.5, entry.position.z]}
        >
          <Text
            fontSize={0.26}
            color={entry.colour}
            anchorX="center"
            outlineWidth={0.008}
            outlineColor="#000000"
          >
            {entry.area.name}
          </Text>
          <Text
            position={[0, -0.26, 0]}
            fontSize={0.15}
            color="#93a3b2"
            anchorX="center"
            outlineWidth={0.006}
            outlineColor="#000000"
          >
            {`${entry.area.noteCount}`}
          </Text>
        </Billboard>
      ))}

      {/* Die geöffnete Notiz als Fläche im Raum, an ihrem Ort. */}
      {openHandle ? (
        <RoomPanel
          position={
            new THREE.Vector3(
              openHandle.position.x,
              openHandle.position.y + 1.5,
              openHandle.position.z,
            )
          }
          title={openHandle.note.title}
          subtitle={`${openHandle.area.name} · ${new Date(openHandle.note.modified).toLocaleDateString("de-DE")}`}
          onClose={onCloseNote}
        >
          <NoteBody path={openHandle.note.path} />
        </RoomPanel>
      ) : null}

      {/* Der Titel einer Notiz erst, wenn man sie meint. Ein festes Schild an
          jedem Punkt macht aus dem Raum ein Schaubild. */}
      {hoveredNote ? (
        <Billboard
          position={[
            hoveredNote.position.x,
            hoveredNote.position.y + 0.34,
            hoveredNote.position.z,
          ]}
        >
          <Text
            fontSize={0.2}
            color="#f3f7fb"
            anchorX="center"
            maxWidth={5}
            textAlign="center"
            outlineWidth={0.008}
            outlineColor="#000000"
          >
            {hoveredNote.note.title}
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}

/**
 * Der Inhalt einer Notiz in der Fläche.
 *
 * Absichtlich schlicht: Der volle Leser mit Kopfdaten, Nachbarn und
 * Obsidian-Verweis bleibt der Leiste vorbehalten. Hier geht es darum, dass man
 * *im Raum* liest, ohne herausgerissen zu werden — Anfang des Textes, scharf,
 * scrollbar, und ein Hinweis, wenn es mehr ist als das.
 *
 * Jeder Zustand wird benannt. „Lädt", „fehlt", „leer" und „nicht darstellbar"
 * sehen gleich aus, wenn man nur Inhalt-oder-nicht kennt, und sie
 * auseinanderzuhalten ist das meiste an einem vertrauenswürdigen Leser.
 */
function NoteBody({ path }: { path: string }) {
  const document = useDocument(path);
  const muted = { color: "#8fa0b0", fontFamily: "ui-monospace, monospace", fontSize: 12 };

  if (document.status === "loading" || document.status === "idle") {
    return <p style={muted}>Wird gelesen …</p>;
  }
  if (document.status === "missing") {
    return <p style={muted}>Diese Notiz steht im Verzeichnis, aber nicht mehr auf der Platte. Meist ein Umbenennen.</p>;
  }
  if (document.status === "unsupported") {
    return (
      <p style={muted}>
        {`Kein Text, sondern ${document.extension} (${Math.round(document.bytes / 1024)} kB). Wird hier nicht dargestellt.`}
      </p>
    );
  }
  if (document.status === "failed") {
    return <p style={muted}>{`Konnte nicht gelesen werden: ${document.reason}`}</p>;
  }

  const body = document.content.replace(/^---[\s\S]*?---\s*/, "").trim();
  if (!body) return <p style={muted}>Die Notiz ist leer. Das ist kein Fehler, nur nichts drin.</p>;

  return (
    <>
      <div
        style={{
          fontSize: 13.5,
          lineHeight: 1.62,
          whiteSpace: "pre-wrap",
          color: "#cdd8e4",
          maxHeight: 300,
          overflowY: "auto",
        }}
      >
        {body.slice(0, 4000)}
      </div>
      {body.length > 4000 || document.truncated ? (
        <p style={{ ...muted, marginTop: 10 }}>
          Gekürzt. Der vollständige Text steht im Leser an der Seite.
        </p>
      ) : null}
    </>
  );
}
