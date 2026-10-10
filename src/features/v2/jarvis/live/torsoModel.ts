import * as THREE from "three";

/** Neck, collar and shoulder armour below the head. Faceted on purpose so it reads like the head's plates.
 * It stays almost still while the head turns on it. */
export function addTorso(scene: THREE.Scene) {
  const torso = new THREE.Group(); torso.position.y = .95; scene.add(torso);
  const armour = new THREE.MeshStandardMaterial({ color: "#2c3741", metalness: .6, roughness: .55, flatShading: true });
  const plate = new THREE.MeshStandardMaterial({ color: "#3d4954", metalness: .62, roughness: .48, flatShading: true });
  const seam = new THREE.MeshStandardMaterial({ color: "#02090d", roughness: .85 });
  const glow = new THREE.MeshBasicMaterial({ color: "#35bdff", toneMapped: false });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale: [number, number, number] = [1, 1, 1], rotation: [number, number, number] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation); torso.add(mesh); return mesh;
  };
  const depth = -.5;
  // Neck column with seams and light strips.
  add(new THREE.CylinderGeometry(1.12, 1.3, 1.9, 12, 2), armour, [0, -3.1, depth]);
  add(new THREE.TorusGeometry(1.24, .03, 6, 28), seam, [0, -3.25, depth], [1, 1, 1], [Math.PI / 2, 0, 0]);
  for (const angle of [-.8, .8]) add(new THREE.BoxGeometry(.03, .55, .03), glow, [Math.sin(angle) * 1.27, -3.45, depth + Math.cos(angle) * 1.27]);
  // Collar ring that the neck sits in.
  add(new THREE.TorusGeometry(1.5, .25, 6, 14), plate, [0, -3.98, depth], [1.18, .86, 1], [Math.PI / 2, 0, 0]);
  add(new THREE.TorusGeometry(1.5, .025, 6, 40), glow, [0, -3.78, depth], [1.18, .86, 1], [Math.PI / 2, 0, 0]);
  // Shoulder yoke and upper chest, mostly below the frame.
  add(new THREE.SphereGeometry(1, 14, 7), armour, [0, -4.95, depth], [4.1, 1.05, 1.6]);
  add(new THREE.SphereGeometry(1, 12, 7), armour, [0, -6.5, depth + .25], [3.2, 2.0, 1.45]);
  for (const side of [-1, 1]) {
    add(new THREE.SphereGeometry(1, 9, 6), plate, [side * 3.85, -5.0, depth], [1.3, .95, 1.4], [0, 0, side * -.22]);
    add(new THREE.TorusGeometry(1.0, .03, 6, 32, Math.PI), glow, [side * 3.85, -4.88, depth + .1], [1.25, .84, 1], [-.35, 0, side * -.22]);
    // Trapezius plate from collar to shoulder with a light line along it.
    add(new THREE.BoxGeometry(2.2, .34, 1.5), plate, [side * 2.05, -4.33, depth], [1, 1, 1], [0, 0, side * -.3]);
    add(new THREE.BoxGeometry(1.75, .03, .03), glow, [side * 2.0, -4.2, depth + .78], [1, 1, 1], [0, 0, side * -.3]);
    add(new THREE.BoxGeometry(.03, .9, .03), glow, [side * .62, -5.05, depth + 1.52], [1, 1, 1], [.2, 0, side * .28]);
  }
  add(new THREE.BoxGeometry(.9, .5, .2), plate, [0, -4.72, depth + 1.5], [1, 1, 1], [-.25, 0, 0]);
  add(new THREE.BoxGeometry(.5, .04, .03), glow, [0, -4.6, depth + 1.66], [1, 1, 1], [-.25, 0, 0]);
  return torso;
}
