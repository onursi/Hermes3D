"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Your projects, in orbit.
 *
 * Every property is measured, none is chosen for looks — which is the only
 * reason this belongs in a room that is not allowed to decorate:
 *
 *   size     open tasks. Routinen with fourteen is a giant, Work with one is
 *            a pebble, on a log scale so the giant does not swallow the sky.
 *   distance urgency. Overdue work pulls a planet *towards* you: what presses
 *            comes closer, which is the one spatial metaphor everybody
 *            already understands without being told.
 *   colour   amber the moment anything is overdue, neutral otherwise. The
 *            same amber the rest of the room uses for "a decision is waiting",
 *            and nowhere else.
 *   speed    the closer, the faster. A planet bearing down on you should not
 *            look becalmed.
 *
 * The point is to see the shape of the day without reading a list. If Todoist
 * is unreachable there are no planets — an empty sky is honest, an invented
 * one is not.
 */

export type ProjectOrbit = {
  name: string;
  open: number;
  overdue: number;
};

/** Farthest and nearest a project can orbit, in metres from the centre. */
const ORBIT_FAR = 15;
const ORBIT_NEAR = 7.5;

export function ProjectOrbits({
  projects,
  position = [0, 6, 0],
  onSelect,
}: {
  projects: ProjectOrbit[];
  position?: [number, number, number];
  onSelect?: (projectName: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const bodies = useMemo(() => {
    const mostOpen = Math.max(1, ...projects.map((project) => project.open));
    const mostOverdue = Math.max(1, ...projects.map((project) => project.overdue));

    return projects.map((project, index) => {
      // Log scale: fourteen against one is a 14× difference in count and only
      // about 2.4× in radius, which keeps the small projects visible.
      const weight = Math.log1p(project.open) / Math.log1p(mostOpen);
      const radius = 0.22 + weight * 0.55;

      // Urgency is the share of this project that is overdue, not the raw
      // count — three overdue out of seven presses harder than five out of
      // fourteen, and that is the honest reading.
      const urgency = project.open > 0 ? project.overdue / project.open : 0;
      const pressure = Math.max(urgency, project.overdue / mostOverdue * 0.6);
      const distance = ORBIT_FAR - (ORBIT_FAR - ORBIT_NEAR) * Math.min(1, pressure);

      return {
        ...project,
        radius,
        distance,
        // Spread the starting angles so they do not launch in a line.
        phase: (index / Math.max(1, projects.length)) * Math.PI * 2,
        speed: 0.035 + (1 - distance / ORBIT_FAR) * 0.06,
        colour: project.overdue > 0 ? "#fbbf24" : "#38bdf8",
      };
    });
  }, [projects]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.children.forEach((child, index) => {
      const body = bodies[index];
      if (!body) return;
      child.userData.angle = (child.userData.angle ?? body.phase) + delta * body.speed;
      const angle = child.userData.angle as number;
      child.position.set(
        Math.cos(angle) * body.distance,
        // A slight tilt per body, so the orbits read as a system rather than
        // as a single flat ring of beads.
        Math.sin(angle * 0.6) * (1.2 + index * 0.35),
        Math.sin(angle) * body.distance,
      );
    });
  });

  if (bodies.length === 0) return null;

  return (
    <group ref={groupRef} position={position}>
      {bodies.map((body) => (
        <group key={body.name}>
          <mesh
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.(body.name);
            }}
          >
            <sphereGeometry args={[body.radius, 24, 16]} />
            <meshStandardMaterial
              color={body.colour}
              emissive={body.colour}
              // Overdue glows harder. Brightness is the second channel
              // carrying the same fact, for anyone who cannot separate the
              // amber from the blue.
              emissiveIntensity={body.overdue > 0 ? 1.6 : 0.7}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>
          <Billboard position={[0, body.radius + 0.32, 0]}>
            <Text
              fontSize={0.19}
              color="#e2e8f0"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.012}
              outlineColor="#000000"
            >
              {`${body.name}  ${body.open}`}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  );
}
