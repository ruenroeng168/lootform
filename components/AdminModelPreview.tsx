"use client";

import {
  Suspense,
  useMemo,
} from "react";

import {
  Bounds,
  Center,
  Html,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";

import {
  Canvas,
} from "@react-three/fiber";

import {
  Group,
  Object3D,
} from "three";

/* =========================================================
   TYPES
========================================================= */

type AdminModelPreviewProps = {
  modelUrl: string;
  modelName: string;
  onClose: () => void;
};

/* =========================================================
   MODEL
========================================================= */

function Model({
  url,
}: {
  url: string;
}) {
  const gltf =
    useGLTF(url);

  /*
    Clone เพื่อไม่แก้ scene ต้นฉบับของ useGLTF cache
  */

  const model =
    useMemo(() => {
      return gltf.scene.clone(
        true
      );
    }, [
      gltf.scene,
    ]);

  return (
    <Bounds
      fit
      clip
      observe
      margin={1.25}
    >
      <Center>
        <primitive
          object={
            model as Object3D
          }
        />
      </Center>
    </Bounds>
  );
}

/* =========================================================
   LOADING
========================================================= */

function LoadingModel() {
  return (
    <Html center>
      <div
        className="
          whitespace-nowrap
          rounded-xl
          border
          border-purple-400/30
          bg-black/90
          px-5
          py-3
          text-xs
          font-black
          text-purple-400
        "
      >
        LOADING 3D MODEL...
      </div>
    </Html>
  );
}

/* =========================================================
   SCENE
========================================================= */

function Scene({
  modelUrl,
}: {
  modelUrl: string;
}) {
  return (
    <>
      {/* Ambient light */}

      <ambientLight
        intensity={1.4}
      />

      {/* Main light */}

      <directionalLight
        position={[
          4,
          6,
          5,
        ]}
        intensity={3}
      />

      {/* Back light */}

      <directionalLight
        position={[
          -4,
          3,
          -5,
        ]}
        intensity={1.5}
      />

      {/* Top light */}

      <pointLight
        position={[
          0,
          6,
          0,
        ]}
        intensity={2}
      />

      <Suspense
        fallback={
          <LoadingModel />
        }
      >
        <Model
          url={
            modelUrl
          }
        />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={1}
        maxDistance={20}
      />
    </>
  );
}

/* =========================================================
   ERROR BOUNDARY

   React class component แบบเล็กเพื่อกัน GLB เสีย
   ไม่ให้หน้า Admin ทั้งหน้าพัง
========================================================= */

import React from "react";

type ErrorBoundaryProps = {
  children:
    React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ModelErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(
    props:
      ErrorBoundaryProps
  ) {
    super(props);

    this.state = {
      hasError:
        false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError:
        true,
    };
  }

  componentDidCatch(
    error: unknown
  ) {
    console.error(
      "ADMIN 3D MODEL PREVIEW ERROR:",
      error
    );
  }

  render() {
    if (
      this.state.hasError
    ) {
      return (
        <div
          className="
            flex
            h-full
            min-h-[420px]
            items-center
            justify-center
            p-8
            text-center
          "
        >
          <div>
            <p
              className="
                text-lg
                font-black
                text-red-400
              "
            >
              CANNOT LOAD 3D MODEL
            </p>

            <p
              className="
                mt-3
                max-w-md
                text-sm
                leading-6
                text-zinc-500
              "
            >
              Check that the GLB file is valid and that the Model URL is accessible.
            </p>
          </div>
        </div>
      );
    }

    return (
      this.props.children
    );
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AdminModelPreview({
  modelUrl,
  modelName,
  onClose,
}: AdminModelPreviewProps) {
  if (!modelUrl) {
    return null;
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        bg-black/90
        p-4
        backdrop-blur-md
      "
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className="
          flex
          h-[85vh]
          w-full
          max-w-5xl
          flex-col
          overflow-hidden
          rounded-3xl
          border
          border-purple-400/30
          bg-zinc-950
          shadow-2xl
        "
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="
            flex
            items-center
            justify-between
            gap-4
            border-b
            border-white/10
            px-6
            py-5
          "
        >
          <div
            className="
              min-w-0
            "
          >
            <p
              className="
                text-[10px]
                font-black
                tracking-[0.25em]
                text-purple-400
              "
            >
              LOOTFORM 3D PREVIEW
            </p>

            <h2
              className="
                mt-1
                truncate
                text-xl
                font-black
                text-white
              "
            >
              {modelName}
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="
              rounded-xl
              border
              border-white/10
              bg-white/5
              px-4
              py-3
              text-xs
              font-black
              text-zinc-400
              transition
              hover:border-red-400/30
              hover:text-red-400
            "
          >
            CLOSE
          </button>
        </div>

        {/* =================================================
            VIEWPORT
        ================================================= */}

        <div
          className="
            relative
            min-h-0
            flex-1
            bg-black
          "
        >
          <ModelErrorBoundary>
            <Canvas
              camera={{
                position: [
                  3,
                  2,
                  5,
                ],

                fov: 40,

                near: 0.01,

                far: 1000,
              }}
              gl={{
                antialias:
                  true,

                alpha:
                  true,
              }}
            >
              <Scene
                modelUrl={
                  modelUrl
                }
              />
            </Canvas>
          </ModelErrorBoundary>

          {/* VIEWPORT LABEL */}

          <div
            className="
              pointer-events-none
              absolute
              left-4
              top-4
              rounded-lg
              border
              border-purple-400/20
              bg-black/70
              px-3
              py-2
              text-[9px]
              font-black
              text-purple-400
              backdrop-blur
            "
          >
            LIVE GLB PREVIEW
          </div>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div
          className="
            flex
            flex-col
            gap-2
            border-t
            border-white/10
            bg-black
            px-6
            py-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                text-[10px]
                font-black
                text-zinc-500
              "
            >
              CONTROLS
            </p>

            <p
              className="
                mt-1
                text-xs
                text-zinc-600
              "
            >
              Drag = Rotate · Mouse Wheel = Zoom · Right Drag = Pan
            </p>
          </div>

          <div
            className="
              max-w-md
              truncate
              text-[9px]
              text-zinc-700
            "
            title={
              modelUrl
            }
          >
            {modelUrl}
          </div>
        </div>
      </div>
    </div>
  );
}