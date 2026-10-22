"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { LOOP_SECONDS, T } from "./timeline";

/**
 * Desktop-only 3D version of the hero scene, built from simple shapes so it
 * needs no model files. Loaded lazily (see HeroBackground) so phones never
 * download Three.js.
 */
export default function RobotVault3D({
  onReady,
  onError,
}: {
  onReady: () => void;
  onError: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      onError();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      onError();
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(-1, 2.4, 11);
    camera.lookAt(-1, 1.4, 0);

    // Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-4, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 5, bottom: -2 });
    scene.add(sun);

    // Ground that only shows shadows
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 10),
      new THREE.ShadowMaterial({ opacity: 0.25 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const mat = (color: THREE.ColorRepresentation, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });

    // Theme-coloured accents follow the site's --primary colour
    const accent = mat("#3b82f6", { emissive: "#3b82f6", emissiveIntensity: 0.15 });
    const readAccent = () => {
      const c = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
      if (c) {
        accent.color.set(c);
        accent.emissive.set(c);
      }
    };
    readAccent();
    const themeObserver = new MutationObserver(readAccent);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const add = <T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x = 0, y = 0, z = 0): T => {
      obj.position.set(x, y, z);
      obj.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = true;
      });
      parent.add(obj);
      return obj;
    };

    // ---------- Robot ----------
    const yellow = mat("#fcd34d");
    const denim = mat("#2563eb");
    const dark = mat("#1f2937");
    const shoe = mat("#111827");

    const robot = new THREE.Group(); // walks along x
    const hop = add(robot, new THREE.Group()); // hops up and down
    scene.add(robot);

    add(hop, new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.6, 8, 24), yellow), 0, 1.05);
    // Overalls: bottom half-sphere + a short band
    add(hop, new THREE.Mesh(new THREE.SphereGeometry(0.465, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), denim), 0, 0.75);
    add(hop, new THREE.Mesh(new THREE.CylinderGeometry(0.465, 0.465, 0.22, 24), denim), 0, 0.86);
    add(hop, new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.1), denim), 0, 1.0, 0.4);
    // Goggle
    add(hop, new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 24, 1, true), dark), 0, 1.47);
    const goggle = add(hop, new THREE.Group(), 0, 1.47, 0.44);
    add(goggle, new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.055, 12, 32), mat("#cbd5e1", { metalness: 0.8, roughness: 0.25 })));
    add(goggle, new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), mat("#ffffff")), 0, 0, 0.01);
    add(goggle, new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), mat("#7c4a1e")), 0.02, 0, 0.02);
    add(goggle, new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), shoe), 0.02, 0, 0.03);
    // Smile
    const smile = add(hop, new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 16, Math.PI), shoe), 0, 1.24, 0.43);
    smile.rotation.z = Math.PI;
    // Antenna
    add(hop, new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), mat("#64748b")), 0, 1.85);
    const antennaTip = add(hop, new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), accent), 0, 1.97);

    // Arms pivot at the shoulders; rotation.z = PI points them straight up
    const makeArm = (side: 1 | -1) => {
      const pivot = add(hop, new THREE.Group(), 0.47 * side, 1.22);
      add(pivot, new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.5, 6, 12), yellow), 0, -0.36);
      add(pivot, new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), shoe), 0, -0.72);
      return pivot;
    };
    const armL = makeArm(-1);
    const armR = makeArm(1);

    // Legs pivot at the hips
    const makeLeg = (side: 1 | -1) => {
      const pivot = add(hop, new THREE.Group(), 0.17 * side, 0.36);
      add(pivot, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 12), denim), 0, -0.13);
      add(pivot, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.3), shoe), 0, -0.3, 0.05);
      return pivot;
    };
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    // ---------- Files ----------
    const files = new THREE.Group();
    scene.add(files);
    const paper = mat("#f8fafc", { transparent: true });
    const paperShade = mat("#e2e8f0", { transparent: true });
    const sheetGeo = new THREE.BoxGeometry(0.5, 0.64, 0.02);
    const s1 = add(files, new THREE.Mesh(sheetGeo, paperShade), 0.04, 0, -0.06);
    s1.rotation.z = 0.14;
    const s2 = add(files, new THREE.Mesh(sheetGeo, paper), -0.03, 0, -0.03);
    s2.rotation.z = -0.1;
    add(files, new THREE.Mesh(sheetGeo, paper), 0, 0, 0);
    const folderMat = accent.clone();
    folderMat.transparent = true;
    add(files, new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 0.04), folderMat), 0, -0.15, 0.04);
    const fileMats = [paper, paperShade, folderMat];

    // ---------- Vault ----------
    const VAULT_X = 3.6;
    const steel = mat("#5b6478", { metalness: 0.5, roughness: 0.4 });
    const vault = add(scene, new THREE.Group(), VAULT_X, 0, -0.2);
    add(vault, new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.0, 1.5), steel), 0, 1.1);
    add(vault, new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 0.05), mat("#0b0f16")), 0, 1.1, 0.74);
    for (const fx of [-0.7, 0.7]) add(vault, new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 1.2), dark), fx, 0.05);
    const light = add(vault, new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mat("#f59e0b", { emissive: "#f59e0b", emissiveIntensity: 1 })), 0.82, 2.0, 0.76);

    // Door hinges on its left edge
    const doorPivot = add(vault, new THREE.Group(), -0.75, 1.1, 0.78);
    const door = add(doorPivot, new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 0.1), mat("#6b7489", { metalness: 0.5, roughness: 0.35 })), 0.75, 0, 0);
    add(door, new THREE.Mesh(new THREE.BoxGeometry(1.52, 1.62, 0.06), accent), 0, 0, -0.03);
    add(door, new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.1), mat("#d8dee9", { metalness: 0.8 })), 0.6, 0, 0.08);
    const dial = add(door, new THREE.Group(), 0, 0, 0.07);
    const dialFace = add(dial, new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 32), mat("#2e3440", { metalness: 0.7 })));
    dialFace.rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const spoke = add(dial, new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.05), mat("#d8dee9", { metalness: 0.8 })), 0, 0, 0.05);
      spoke.rotation.z = (i * Math.PI) / 4;
    }
    add(dial, new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), accent), 0, 0, 0.06);

    // ---------- Animation ----------
    const START_X = -6.5;
    const STOP_X = VAULT_X - 1.75;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    const ease = (v: number) => v * v * (3 - 2 * v);
    const seg = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a));
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const AMBER = new THREE.Color("#f59e0b");
    const GREEN = new THREE.Color("#22c55e");
    const lightMat = light.material as THREE.MeshStandardMaterial;

    function pose(t: number, time: number) {
      const walkingIn = t < T.walkInEnd;
      const walkingOut = t >= T.walkOut[0];

      // Position + facing
      if (walkingIn) robot.position.x = lerp(START_X, STOP_X, t / T.walkInEnd);
      else if (walkingOut) robot.position.x = lerp(STOP_X, START_X, seg(t, T.walkOut));
      else robot.position.x = STOP_X;
      const targetYaw = walkingOut ? -1.1 : walkingIn ? 0.9 : t < T.doorClose[1] ? 0.6 : 0;
      robot.rotation.y += (targetYaw - robot.rotation.y) * 0.12;

      // Walk cycle
      const walking = walkingIn || walkingOut;
      const swing = walking ? Math.sin(time * 11) * 0.5 : 0;
      legL.rotation.x += (swing - legL.rotation.x) * 0.3;
      legR.rotation.x += (-swing - legR.rotation.x) * 0.3;
      hop.position.y = walking ? Math.abs(Math.sin(time * 11)) * 0.05 : 0;

      // Hops
      const c = seg(t, T.celebrate);
      if (c > 0 && c < 1) hop.position.y = Math.abs(Math.sin(c * Math.PI * 2)) * 0.45;

      // Arms: up holding files -> tip forward to throw -> down -> wave -> down.
      // rotation.z raises the arm sideways (PI = straight up), rotation.x tips it forward.
      const UP = Math.PI - 0.15;
      const DOWN = 0.15;
      const throwK = seg(t, T.throwFiles);
      let armZ = DOWN;
      let armX = walkingOut ? -swing * 0.6 : 0;
      if (t < T.throwFiles[0]) armZ = UP;
      else if (throwK < 1) {
        armZ = throwK < 0.5 ? UP : lerp(UP, DOWN, ease((throwK - 0.5) * 2));
        armX = Math.sin(throwK * Math.PI) * 1.1;
      } else if (c > 0 && c < 1) armZ = UP - 0.25 + Math.sin(time * 14) * 0.25;
      armL.rotation.z += (-armZ - armL.rotation.z) * 0.2;
      armR.rotation.z += (armZ - armR.rotation.z) * 0.2;
      armL.rotation.x += (armX - armL.rotation.x) * 0.2;
      armR.rotation.x += (armX - armR.rotation.x) * 0.2;

      // Files: over the head, then arc into the vault
      const flyK = ease(seg(t, T.throwFiles));
      if (t < T.throwFiles[0]) {
        files.position.set(robot.position.x, 2.3 + hop.position.y, 0.05);
        files.scale.setScalar(1);
        files.rotation.set(0, robot.rotation.y * 0.5, 0);
      } else {
        files.position.set(
          lerp(STOP_X, VAULT_X, flyK),
          lerp(2.3, 1.1, flyK) + Math.sin(flyK * Math.PI) * 0.9,
          lerp(0.05, 0.1, flyK),
        );
        files.scale.setScalar(lerp(1, 0.35, flyK));
        files.rotation.z = -flyK * 1.2;
      }
      const opacity = t < T.throwFiles[0] ? clamp01(t / 0.03) : 1 - seg(t, [T.throwFiles[1] - 0.03, T.throwFiles[1]]);
      fileMats.forEach((m) => (m.opacity = opacity));
      files.visible = opacity > 0.01;

      // Door, dial, light
      const open = ease(seg(t, T.doorOpen)) * (1 - ease(seg(t, T.doorClose)));
      doorPivot.rotation.y = -open * 1.9;
      dial.rotation.z = -ease(seg(t, T.dialSpin)) * Math.PI * 2;
      const locked = t >= T.dialSpin[1] && t < 0.92;
      const target = locked ? GREEN : AMBER;
      lightMat.color.lerp(target, 0.15);
      lightMat.emissive.lerp(target, 0.15);

      // Antenna blinks while celebrating
      (antennaTip.material as THREE.MeshStandardMaterial).emissiveIntensity = c > 0 && c < 1 ? (Math.sin(time * 20) > 0 ? 1.5 : 0.1) : 0.15;
    }

    // Keep the scene framed: the robot's path should span the width
    function resize() {
      const w = mount!.clientWidth;
      const h = mount!.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      // Pick the vertical field of view that keeps ~8 world units visible either side
      const halfWidth = 8;
      const vFov = 2 * Math.atan(halfWidth / (camera.position.z * camera.aspect));
      camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vFov), 14, 40);
      camera.updateProjectionMatrix();
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    // Only render while visible on screen and the tab is in front
    const clock = new THREE.Clock();
    let elapsed = 0;
    let ready = false;
    let onScreen = true;
    let frozenAt: number | null = null;
    if (process.env.NODE_ENV !== "production") {
      // Dev helper: window.__heroSeek(0.5) freezes the loop halfway; __heroSeek(null) resumes
      (window as any).__heroSeek = (t: number | null) => (frozenAt = t);
    }
    const loop = () => {
      elapsed += Math.min(clock.getDelta(), 0.1);
      pose(frozenAt ?? (elapsed % LOOP_SECONDS) / LOOP_SECONDS, elapsed);
      renderer.render(scene, camera);
      if (!ready) {
        ready = true;
        onReady();
      }
    };
    const updateLoop = () => {
      const run = onScreen && document.visibilityState === "visible";
      if (run) clock.getDelta(); // don't jump ahead after a pause
      renderer.setAnimationLoop(run ? loop : null);
    };
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      updateLoop();
    });
    io.observe(mount);
    document.addEventListener("visibilitychange", updateLoop);
    updateLoop();

    return () => {
      renderer.setAnimationLoop(null);
      io.disconnect();
      resizeObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", updateLoop);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // onReady/onError are stable callbacks from the parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}
