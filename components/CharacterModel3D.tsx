"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Center,
  Environment,
  Float,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";

export type LootGrade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type CharacterModel3DProps = {
  grade?: LootGrade;
  className?: string;
};

const GRADE_CONFIG: Record<
  LootGrade,
  {
    color: string;
    glow: string;
    emissive: string;
    label: string;
    ringScale: number;
  }
> = {
  COMMON: {
    color: "#e5e7eb",
    glow: "#ffffff",
    emissive: "#7dd3fc",
    label: "COMMON",
    ringScale: 1.0,
  },
  RARE: {
    color: "#22d3ee",
    glow: "#06b6d4",
    emissive: "#22d3ee",
    label: "RARE",
    ringScale: 1.06,
  },
  EPIC: {
    color: "#c084fc",
    glow: "#a855f7",
    emissive: "#c084fc",
    label: "EPIC",
    ringScale: 1.12,
  },
  LEGENDARY: {
    color: "#f59e0b",
    glow: "#f97316",
    emissive: "#f59e0b",
    label: "LEGENDARY",
    ringScale: 1.2,
  },
};

function CharacterScene({
  grade = "COMMON",
}: {
  grade?: LootGrade;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const glowRef = useRef<THREE.Mesh | null>(null);

  const { scene } = useGLTF(
    "/models/lootform-character.glb"
  );

  const config = GRADE_CONFIG[grade];

  const clonedScene = useMemo(() => {
    return scene.clone(true);
  }, [scene]);

  useEffect(() => {
    clonedScene.traverse((child) => {
      const mesh = child as THREE.Mesh;

      if (!mesh.isMesh) return;

      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const originalMaterial = Array.isArray(mesh.material)
        ? mesh.material[0]
        : mesh.material;

      if (!originalMaterial) return;

      const material =
        originalMaterial.clone() as THREE.MeshStandardMaterial;

      material.roughness = 0.82;
      material.metalness = 0.1;

      // หมายเหตุ:
      // ไฟล์นี้เป็น single mesh + single material
      // จึงไม่สามารถเปลี่ยน "เฉพาะเสื้อ" ได้ 100%
      // เราเลยใช้ emissive glow ตาม grade เพื่อให้ดูดีขึ้น
      material.emissive = new THREE.Color(config.emissive);
      material.emissiveIntensity =
        grade === "COMMON" ? 0.12 : 0.24;

      mesh.material = material;
    });
  }, [clonedScene, config.emissive, grade]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.position.y =
        Math.sin(t * 1.8) * 0.04;
      groupRef.current.rotation.y =
        Math.sin(t * 0.9) * 0.12;
      groupRef.current.rotation.x =
        Math.sin(t * 1.4) * 0.02;
    }

    if (ringRef.current) {
      const s =
        config.ringScale + Math.sin(t * 2.2) * 0.035;
      ringRef.current.scale.set(s, s, s);
      ringRef.current.rotation.z += 0.01;
    }

    if (glowRef.current) {
      const s = 1 + Math.sin(t * 1.7) * 0.03;
      glowRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group>
      <Float
        speed={1.3}
        rotationIntensity={0.08}
        floatIntensity={0.12}
      >
        <group ref={groupRef} position={[0, -1.1, 0]}>
          <Center>
            <primitive object={clonedScene} />
          </Center>
        </group>
      </Float>

      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.55, 0]}
      >
        <ringGeometry args={[0.85, 1.12, 64]} />
        <meshBasicMaterial
          color={config.glow}
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh
        ref={glowRef}
        position={[0, -0.1, -0.55]}
      >
        <circleGeometry args={[1.35, 64]} />
        <meshBasicMaterial
          color={config.glow}
          transparent
          opacity={0.09}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight
        position={[0, 1.6, 1.8]}
        intensity={20}
        color={config.glow}
      />
      <pointLight
        position={[-1.8, 0.8, 1.5]}
        intensity={10}
        color="#38bdf8"
      />
      <pointLight
        position={[1.8, 0.8, 1.5]}
        intensity={10}
        color="#a855f7"
      />
      <spotLight
        position={[0, 4, 2]}
        angle={0.35}
        penumbra={1}
        intensity={25}
        color="#ffffff"
        castShadow
      />
    </group>
  );
}

export default function CharacterModel3D({
  grade = "COMMON",
  className = "",
}: CharacterModel3DProps) {
  const config = GRADE_CONFIG[grade];

  return (
    <div
      className={`relative h-[520px] w-full overflow-hidden rounded-[28px] border border-cyan-400/25 bg-[radial-gradient(circle_at_top,_rgba(0,170,255,0.10),_transparent_38%),linear-gradient(180deg,rgba(4,9,20,0.98)_0%,rgba(7,10,20,0.96)_100%)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:26px_26px] opacity-30" />

      <div className="absolute inset-0">
        <Canvas
          shadows
          camera={{ position: [0, 0.55, 4.7], fov: 28 }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={1.3} />
            <Environment preset="city" />
            <CharacterScene grade={grade} />
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 2.25}
              maxPolarAngle={Math.PI / 1.85}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-1/2 z-20 w-[70%] -translate-x-1/2">
        <div
          className="rounded-[22px] border px-6 py-4 text-center shadow-[0_0_28px_rgba(255,255,255,0.14)]"
          style={{
            borderColor: `${config.glow}AA`,
            boxShadow: `0 0 30px ${config.glow}33`,
            background:
              "linear-gradient(180deg, rgba(2,6,23,0.92) 0%, rgba(8,10,18,0.96) 100%)",
          }}
        >
          <p className="mb-1 text-[10px] font-semibold tracking-[0.35em] text-zinc-500">
            EQUIPPED GRADE
          </p>

          <p
            className="break-words text-center text-[clamp(24px,3.1vw,40px)] font-black leading-none tracking-wide"
            style={{ color: config.color }}
          >
            {config.label}
          </p>
        </div>
      </div>
    </div>
  );
}

useGLTF.preload("/models/lootform-character.glb");