"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface Interactive3DFaceProps {
  active?: boolean;
  speaking?: boolean;
  className?: string;
  themeColor?: string; // hex string e.g. "#00f0ff"
}

/**
 * Interactive 3D Hologram Cybernetic Face
 *
 * Rendert ein interaktives, prozedurales 3D-Hologramm-Gesicht mit Three.js:
 * - Vektorielle Facetten & leuchtendes Wireframe-Gitter
 * - Glühende Augen-Knotenpunkte
 * - Konzentrische orbitale HUD-Telemetrie-Ringe
 * - Folgt flüssig den Mausbewegungen (Kopfneigung / Blickverfolgung)
 * - Unterstützt freies Drehen per Drag
 * - Pulsiert dynamisch bei Sprachausgabe
 */
export function Interactive3DFace({
  active = true,
  speaking = false,
  className = "",
  themeColor = "#00f0ff",
}: Interactive3DFaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 320;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 5.2;

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0x002030, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 2.5);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 3, 10);
    rimLight.position.set(-3, -2, 2);
    scene.add(rimLight);

    // 4. Hologram Head Construction (Parent Group)
    const headGroup = new THREE.Group();
    scene.add(headGroup);

    // 4a. Faceted Cyber Cranium
    const headGeom = new THREE.IcosahedronGeometry(1.6, 2);
    // Skaliere Geometrie leicht vertikal für Kopfform
    const pos = headGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      let z = pos.getZ(i);
      if (y > 0) y *= 1.15; // Stirn wölben
      else y *= 0.95; // Kinn anspitzen
      if (z > 0 && y < 0) z *= 1.1; // Nase / Wangenpartie
      pos.setXYZ(i, pos.getX(i), y, z);
    }
    headGeom.computeVertexNormals();

    // Inneres transparentes Glühen
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x003548,
      wireframe: false,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    const innerMesh = new THREE.Mesh(headGeom, innerMat);
    headGroup.add(innerMesh);

    // Äußeres leuchtendes Wireframe-Gitter
    const wireGeom = new THREE.WireframeGeometry(headGeom);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.75,
      linewidth: 1,
    });
    const wireLines = new THREE.LineSegments(wireGeom, wireMat);
    headGroup.add(wireLines);

    // 4b. Glühende Cyber-Augen
    const eyeGeom = new THREE.SphereGeometry(0.14, 16, 16);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyeHaloMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.6,
      wireframe: true,
    });

    const leftEyeGroup = new THREE.Group();
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    const leftEyeHalo = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), eyeHaloMat);
    leftEyeGroup.add(leftEye, leftEyeHalo);
    leftEyeGroup.position.set(-0.48, 0.22, 1.45);
    headGroup.add(leftEyeGroup);

    const rightEyeGroup = new THREE.Group();
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    const rightEyeHalo = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), eyeHaloMat);
    rightEyeGroup.add(rightEye, rightEyeHalo);
    rightEyeGroup.position.set(0.48, 0.22, 1.45);
    headGroup.add(rightEyeGroup);

    // 4c. Orbitale HUD-Telemetrie-Ringe
    const ringGeom1 = new THREE.TorusGeometry(2.3, 0.012, 8, 80);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.4 });
    const ring1 = new THREE.Mesh(ringGeom1, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    scene.add(ring1);

    const ringGeom2 = new THREE.TorusGeometry(2.6, 0.008, 6, 80);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.3 });
    const ring2 = new THREE.Mesh(ringGeom2, ringMat2);
    ring2.rotation.y = Math.PI / 4;
    scene.add(ring2);

    // 4d. Schwebende Quantenpartikel-Aura
    const particleCount = 140;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 2.0 + Math.random() * 1.5;
      particlePositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = r * Math.cos(phi);
    }
    particleGeom.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.04,
      transparent: true,
      opacity: 0.65,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // 5. Interaktion: Maus- & Pointer-Tracking
    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let isDragging = false;
    let prevPointerX = 0;
    let prevPointerY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      if (isDragging) {
        const deltaX = e.clientX - prevPointerX;
        const deltaY = e.clientY - prevPointerY;
        headGroup.rotation.y += deltaX * 0.01;
        headGroup.rotation.x += deltaY * 0.01;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;
      } else {
        mouseX = x;
        mouseY = y;
        targetRotY = mouseX * 0.75;
        targetRotX = -mouseY * 0.55;
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);

    // 6. Animations-Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Sanftes Lerpen zur Mausposition (wenn nicht gezogen wird)
      if (!isDragging) {
        headGroup.rotation.y += (targetRotY - headGroup.rotation.y) * 0.06;
        headGroup.rotation.x += (targetRotX - headGroup.rotation.x) * 0.06;
      }

      // Sanftes Atmen / Schweben
      headGroup.position.y = Math.sin(elapsed * 1.6) * 0.06;

      // Telemetrie-Ringe rotieren
      ring1.rotation.z += 0.005;
      ring2.rotation.x -= 0.004;
      particles.rotation.y += 0.002;

      // Sprach-Reaktion: Kiefer/Pulsieren bei speaking
      if (speakingRef.current) {
        const pulse = 1.0 + Math.sin(elapsed * 18) * 0.04;
        headGroup.scale.set(pulse, pulse, pulse);
        wireMat.opacity = 0.95 + Math.sin(elapsed * 25) * 0.15;
      } else {
        headGroup.scale.set(1, 1, 1);
        wireMat.opacity = 0.75;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const resizeObserver = new ResizeObserver(() => {
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      if (newW > 0 && newH > 0) {
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      headGeom.dispose();
      innerMat.dispose();
      wireGeom.dispose();
      wireMat.dispose();
      eyeGeom.dispose();
      eyeMat.dispose();
      eyeHaloMat.dispose();
      ringGeom1.dispose();
      ringMat1.dispose();
      ringGeom2.dispose();
      ringMat2.dispose();
      particleGeom.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full cursor-grab active:cursor-grabbing ${className}`}
      title="3D Hologramm-Kopf: Dreht sich mit der Maus / Klick & Ziehen zum Drehen"
    />
  );
}
