"use client";

import { Component, Suspense, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/* =========================================================
   Lightweight, decorative 3D viewer for the guest landing
   page hero "mystery box". Deliberately simpler than
   CharacterAvatar: no OrbitControls, no HUD chrome, no
   context-lost recovery UI — this is marketing decoration,
   not a player-facing gameplay surface, so a load failure
   should just fall back silently to the emoji box.
========================================================= */

class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("LOOTFORM HERO BOX MODEL LOAD ERROR:", error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function SpinningModel({ modelUrl }: { modelUrl: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(modelUrl);

  const prepared = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const largestDimension = Math.max(size.x, size.y, size.z, 0.0001);
    const scale = 1.6 / largestDimension;

    return { model: cloned, scale, center };
  }, [scene]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      <group scale={[prepared.scale, prepared.scale, prepared.scale]}>
        <primitive
          object={prepared.model}
          position={[-prepared.center.x, -prepared.center.y, -prepared.center.z]}
        />
      </group>
    </group>
  );
}

function Scene({ modelUrl }: { modelUrl: string }) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[3, 4, 4]} intensity={2} color="#ffffff" />
      <directionalLight position={[-3, 1, 2]} intensity={0.8} color="#38c6f4" />
      <SpinningModel modelUrl={modelUrl} />
    </>
  );
}

export default function HeroBoxModel3D({
  modelUrl,
  fallback,
}: {
  modelUrl: string;
  fallback: ReactNode;
}) {
  return (
    <ModelErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Canvas
          camera={{ position: [0, 0.3, 3.2], fov: 32 }}
          dpr={1}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene modelUrl={modelUrl} />
        </Canvas>
      </Suspense>
    </ModelErrorBoundary>
  );
}
