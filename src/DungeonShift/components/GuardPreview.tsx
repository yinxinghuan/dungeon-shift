// @ts-nocheck
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MONSTERS } from '../engine/monsters.js';
import type { GuardType } from '../types';

export default function GuardPreview({ type }: { type: GuardType }) {
  const mountRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(42, 42, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.8, 0.8, 0.8, -0.8, 0.1, 10);
    camera.position.set(2.5, 1.75, 3.4);
    camera.lookAt(0, 0.68, 0);
    scene.add(new THREE.HemisphereLight(0xb9c8ff, 0x291420, 2.2));
    const key = new THREE.DirectionalLight(0xffdfbf, 3.4);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xeb526b, 2.6);
    rim.position.set(-3, 2, -2);
    scene.add(rim);

    const model = MONSTERS[type]();
    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    model.scale.setScalar(1.3 / Math.max(size.y, 0.01));
    const normalized = new THREE.Box3().setFromObject(model);
    model.position.y -= normalized.min.y;
    model.rotation.y = -0.48;
    scene.add(model);

    const platformGeometry = new THREE.CylinderGeometry(0.48, 0.56, 0.08, 6);
    const platformMaterial = new THREE.MeshStandardMaterial({ color: 0x32131a, roughness: 0.7, metalness: 0.35 });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = -0.06;
    scene.add(platform);

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const render = (now = 0) => {
      if (!reduceMotion) model.rotation.y = -0.48 + Math.sin(now * 0.0015) * 0.16;
      renderer.render(scene, camera);
      if (!reduceMotion) raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry?.dispose?.();
      });
      // Monster materials come from the shared prims.js cache and may also be
      // used by the live dungeon scene, so only preview-owned resources are disposed.
      platformGeometry.dispose();
      platformMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [type]);

  return <span className="ds-guard-select__preview" ref={mountRef} aria-hidden="true" />;
}
