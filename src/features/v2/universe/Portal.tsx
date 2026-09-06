"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * A way in, rather than a thing in the way.
 *
 * Onur's own diagnosis, and it was the right one: a knowledge body twenty
 * units across takes up space it has not earned. You do not need to see the
 * whole of a place in order to go there — you need to see the door, and the
 * door should tell you what is behind it.
 *
 * So each destination is a portal: a ring of turbulent light with something
 * visible through it. Small on screen, unmistakable as an entrance, and about
 * three draw calls.
 *
 * **The rule that keeps this from being a mistake:** the frame is the same for
 * every portal, the view through it is not. The plan forbids interchangeable
 * columns, and eleven identical rings with eleven labels would be exactly that
 * with a nicer shader — he would read the label and never the shape. So the
 * caller passes what shows through, and the portal is a frame around it.
 *
 * Written as a shader rather than as geometry because it has to *move*: flow,
 * swirl and flicker are functions of time and position, which is what a
 * fragment shader is for. Animating this with meshes would cost per-frame CPU
 * work for every portal and look worse.
 */

const PORTAL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  uniform mediump float uTime;
  uniform float uRadius;
  void main() {
    vUv = uv;
    vec2 p = uv * 2.0 - 1.0;
    float r = length(p);
    vec3 warped = position;
    warped.z += uRadius * (0.45 * sin(r * 5.0) + 0.07 * sin(atan(p.y,p.x) * 5.0 + uTime * 1.6));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(warped, 1.0);
  }
`;

/**
 * The surface, in polar coordinates.
 *
 * Everything here is a function of radius and angle, because that is what a
 * portal is: rings of stuff turning at different speeds. Cartesian noise would
 * have needed three times the instructions to look half as circular.
 */
const PORTAL_FRAGMENT = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;
  uniform mediump float uTime;
  uniform vec3 uRim;
  uniform vec3 uCore;
  uniform float uOpen;   // 0 = calm, 1 = reacting to attention
  uniform float uSeed;
  /**
   * 1 = voller Shader, 0 = billige Fassung fuer weit entfernte Tore.
   *
   * Ein Tor, das neunzig Einheiten weit weg dreissig Pixel breit ist, bekommt
   * dieselbe Rauschrechnung pro Pixel wie eines direkt vor der Nase. Zuhause
   * stehen acht davon am Himmel, und genau das hat die Bildrate an die
   * Vsync-Schwelle gedrueckt: bei identischen Zeichenaufrufen kippte sie nach
   * dem zweiten Weltwechsel von 56 auf 32 und kam nicht zurueck.
   *
   * Nah bleibt alles wie es war. Fern wird aus dem Wirbel ein Ring — auf
   * dreissig Pixeln ist das derselbe Anblick zum halben Preis.
   */
  uniform float uDetail;

  // Value noise ohne sin(). Die erste Fassung rief pro Pixel 32 mal sin()
  // auf — vier Oktaven mal vier Ecken mal zwei fbm — und das kostete auf der
  // Vega 11 die Hälfte der Bildrate: 60 fps fielen auf 35. Diese Variante
  // rechnet dasselbe mit Multiplikationen.
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * (0.1031 + uSeed * 0.0007));
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Zwei Oktaven. Bei vieren war der Unterschied auf einem Tor von hundert
  // Pixeln nicht zu sehen und im Bildratenzähler sehr wohl.
  float fbm(vec2 p) {
    float sum = noise(p) * 0.62;
    sum += noise(p * 2.07) * 0.31;
    return sum;
  }

  void main() {
    vec2 centred = vUv * 2.0 - 1.0;
    float radius = length(centred);

    // Outside the disc there is nothing. A round mask on a square quad.
    if (radius > 1.0) discard;

    float angle = atan(centred.y, centred.x);

    if (uDetail < 0.5) {
      float wave = sin(angle*9.0-uTime*2.0)*0.035 + sin(angle*17.0+uTime*3.1)*0.017;
      float rim = 0.67 + wave;
      float band = exp(-abs(radius-rim)*14.0);
      float electricity = exp(-abs(radius-rim-sin(angle*31.0-uTime*5.0)*0.013)*125.0);
      float mist = exp(-abs(radius-rim)*8.0)*(0.65+0.3*sin(angle*13.0+radius*33.0-uTime*2.0));
      vec3 tint = mix(uRim,vec3(0.2,0.65,1.0),0.5);
      gl_FragColor=vec4(tint*(band*0.7+mist*1.2)+vec3(0.6,0.85,1.0)*electricity*0.75, clamp(band*0.65+mist*0.65+electricity*0.35,0.0,1.0));
      return;
    }

    // The swirl: inner rings turn faster than outer ones, which is the whole
    // reason this reads as a vortex rather than as a spinning texture.
    float twist = angle + uTime * (0.35 + 0.9 * (1.0 - radius)) ;
    vec2 flow = vec2(cos(twist), sin(twist)) * radius;

    float turbulence = fbm(flow * 3.2 + vec2(uTime * 0.42, -uTime * 0.31));
    float filaments = fbm(flow * 7.0 - vec2(uTime * 1.05, uTime * 0.72));

    // Funken: eine schnelle, feine Lage, die nur den Rand trifft. Sie laeuft
    // gegen die Stroemung, damit der Ring lebt statt zu rotieren — ein Rad
    // dreht sich, ein Tor flackert.
    float sparks = fbm(flow * 15.0 + vec2(-uTime * 2.1, uTime * 1.7));
    sparks = pow(clamp(sparks, 0.0, 1.0), 3.5);

    // The rim: a broad band just inside the edge, pushed in and out by the
    // noise so the ring is torn rather than drawn. This is the part that
    // makes it a portal instead of a glowing coin, so it gets the width.
    // Der Ring sitzt bei 0.62 statt am Rand, damit außerhalb Platz für den
    // Lichtsaum bleibt. Die Fläche ist entsprechend größer als das Tor.
    float ring = 0.62 + turbulence * 0.18;
    float edge = 1.0 - abs(radius - ring) * 9.0;
    edge = clamp(edge, 0.0, 1.0);
    edge = pow(edge, 1.35) * (0.62 + filaments * 0.75 + sparks * 1.8);

    // Light spilling outward. Without it the disc ends where the geometry
    // ends, and an edge you can see is the one thing a portal must not have.
    float halo = exp(-abs(radius - ring) * 16.0) * 0.18;

    // The throat. Streaks live in a band just inside the rim and die out
    // toward the middle, which stays almost black — a portal you can see the
    // far side of is a lamp. Filling this in was what made the first version
    // read as a glowing ball instead of a way through.
    float band = smoothstep(0.12, 0.5, radius) * (1.0 - smoothstep(0.5, 0.66, radius));
    float inner = (0.1 + filaments * 0.95) * band * 0.62;

    // Attention brightens the rim, not the middle: the thing showing through
    // has to stay readable, and washing it out is how a highlight goes wrong.
    float lift = 1.0 + uOpen * 1.1;

    // Die Strähnen im Schlund tragen einen Hauch der Randfarbe, damit das
    // Innere zum Tor gehört und nicht wie ein zweites Objekt wirkt.
    vec3 throat = mix(uCore, uRim, 0.35) * inner * 1.9;
    float lightning = pow(max(0.0, 1.0 - abs(radius - ring - sin(angle*17.0+uTime*4.0)*0.018)*95.0), 2.0);
    float tunnel = pow(max(0.0, sin(radius*42.0 + angle*2.0 - uTime*3.2)), 12.0) * smoothstep(0.15,0.45,radius)*(1.0-smoothstep(0.48,0.68,radius))*0.35;
    vec3 colour = throat + mix(uRim, vec3(0.25,0.65,1.0),0.5) * (edge*1.4 + halo + tunnel)*lift + vec3(0.65,0.9,1.0)*lightning*1.7;

    float alpha = clamp(edge * 1.35 * lift + halo * lift + inner * 0.7 + lightning * 0.6 + tunnel, 0.0, 1.0);

    gl_FragColor = vec4(colour, alpha);
  }
`;


/**
 * Ein Griff auf ein Tor, den die gemeinsame Schleife bedienen kann.
 *
 * Das Tor hat bewusst **keine eigene Bildschleife**. Genau daran hing die
 * halbe Bildrate: acht Tore stehen zuhause am Himmel, jedes hatte seinen
 * eigenen `useFrame`, und acht Schleifen kosten acht Schleifen. Gemessen war
 * das der Unterschied zwischen 56 und 32 Bildern — bei identischen
 * Zeichenaufrufen, identischen Geometrien und identischer Szene.
 *
 * Ich hatte dieselbe Regel bei den Ortsnamen richtig angewandt und drei
 * Dateien weiter gebrochen. Die Zahl der laufenden Schleifen steht deshalb
 * jetzt in den Entwicklerwerten: Draw Calls können diesen Fehler nicht zeigen.
 */
export type PortalHandle = {
  group: THREE.Group | null;
  material: THREE.ShaderMaterial | null;
  /** Der eingeschwungene Wert von `uOpen`. Gehört der Schleife. */
  open: number;
};

export function Portal({
  radius,
  seed = 0,
  onHandle,
  children,
}: {
  radius: number;
  /** Unterscheidet das Rauschen eines Tores vom nächsten. Fest je Ort. */
  seed?: number;
  /** Meldet Gruppe und Material an die Schleife der Eltern. */
  onHandle: (handle: PortalHandle | null) => void;
  children?: React.ReactNode;
}) {
  const handle = useRef<PortalHandle>({ group: null, material: null, open: 0 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRadius: { value: radius },
      uRim: { value: new THREE.Color("#ffffff") },
      uCore: { value: new THREE.Color("#000000") },
      uOpen: { value: 0 },
      uSeed: { value: seed },
      uDetail: { value: 1 },
    }),
    // Farben und Zeit setzt die gemeinsame Schleife; einmal bauen genügt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const current = handle.current;
    onHandle(current);
    return () => onHandle(null);
  }, [onHandle]);

  return (
    <group
      ref={(group) => {
        handle.current.group = group;
      }}
    >
      {/* Was hindurchscheint — hinter der Fläche und von ihr eingerahmt. */}
      {children}
      <mesh>
        <planeGeometry args={[radius * 2.6, radius * 2.6, 32, 32]} />
        <shaderMaterial
          ref={(material) => {
            handle.current.material = material;
          }}
          vertexShader={PORTAL_VERTEX}
          fragmentShader={PORTAL_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
