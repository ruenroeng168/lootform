"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  Canvas,
  useFrame,
} from "@react-three/fiber";

import {
  OrbitControls,
  useGLTF,
} from "@react-three/drei";

import * as THREE from "three";

/* =========================================================
   TYPES
========================================================= */

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type CharacterAvatarProps = {
  grade?: Grade;

  modelUrl?:
    | string
    | null;
};

type GradeTheme = {
  color: string;

  color2: string;

  glow: string;

  soft: string;

  panel: string;
};

/* =========================================================
   GRADE THEME
========================================================= */

const gradeTheme: Record<
  Grade,
  GradeTheme
> = {
  COMMON: {
    color:
      "#f4f4f5",

    color2:
      "#94a3b8",

    glow:
      "rgba(244,244,245,0.34)",

    soft:
      "rgba(244,244,245,0.08)",

    panel:
      "rgba(244,244,245,0.06)",
  },

  RARE: {
    color:
      "#22d3ee",

    color2:
      "#0284c7",

    glow:
      "rgba(34,211,238,0.55)",

    soft:
      "rgba(34,211,238,0.12)",

    panel:
      "rgba(34,211,238,0.07)",
  },

  EPIC: {
    color:
      "#c084fc",

    color2:
      "#7c3aed",

    glow:
      "rgba(192,132,252,0.62)",

    soft:
      "rgba(192,132,252,0.15)",

    panel:
      "rgba(192,132,252,0.08)",
  },

  LEGENDARY: {
    color:
      "#fb923c",

    color2:
      "#facc15",

    glow:
      "rgba(251,146,60,0.72)",

    soft:
      "rgba(251,146,60,0.18)",

    panel:
      "rgba(251,146,60,0.10)",
  },
};

/* =========================================================
   GRADE MODEL TINT

   Whole-model color tint applied to every material on the
   loaded GLB, multiplied against its existing base color
   texture. COMMON is left untouched (0 strength) so the
   model's real colors show as-is; higher grades get a
   progressively stronger wash of the grade color plus a
   faint emissive glow on LEGENDARY.

   This is a deliberate fallback: most GLBs here (including
   AI-generated ones) are a single merged mesh/material, so
   there is no separate "shirt" part to recolor in isolation
   — tinting the whole model is the only fully-automatic
   option without manual re-authoring in a 3D tool.
========================================================= */

const gradeTintStrength: Record<
  Grade,
  number
> = {
  COMMON: 0,
  RARE: 0.22,
  EPIC: 0.3,
  LEGENDARY: 0.38,
};

const gradeEmissiveIntensity: Record<
  Grade,
  number
> = {
  COMMON: 0,
  RARE: 0,
  EPIC: 0,
  LEGENDARY: 0.16,
};

/* =========================================================
   NORMALIZE GRADE
========================================================= */

function normalizeGrade(
  value?: Grade
): Grade {
  if (
    value ===
      "RARE" ||
    value ===
      "EPIC" ||
    value ===
      "LEGENDARY"
  ) {
    return value;
  }

  return "COMMON";
}

/* =========================================================
   LOADING
========================================================= */

function Loading3D() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070a]">

      <div className="text-center">

        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-zinc-800 border-t-cyan-400" />

        <p className="mt-4 text-[8px] font-black tracking-[0.3em] text-cyan-400">
          INITIALIZING PLAYER
        </p>

      </div>

    </div>
  );
}


/* =========================================================
   MODEL ERROR BOUNDARY
========================================================= */

class ModelErrorBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
  },
  {
    hasError: boolean;
  }
> {
  state = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: unknown) {
    console.error(
      "LOOTFORM CHARACTER MODEL LOAD ERROR:",
      error
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function ModelUnavailable({
  color,
  glow,
  message,
}: {
  color: string;
  glow: string;
  message: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#05070a]">
      <div className="max-w-[300px] px-6 text-center">
        <div
          className="mx-auto h-12 w-12 rounded-full border"
          style={{
            borderColor: color,
            boxShadow: `0 0 30px ${glow}`,
          }}
        />
        <p
          className="mt-5 text-[10px] font-black tracking-[0.22em]"
          style={{ color }}
        >
          CHARACTER MODEL UNAVAILABLE
        </p>
        <p className="mt-2 text-[9px] leading-5 text-zinc-600">
          {message}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   3D MODEL
========================================================= */

function PlayerModel({
  modelUrl,
  grade,
}: {
  modelUrl: string;
  grade: Grade;
}) {
  const rootRef =
    useRef<THREE.Group>(
      null
    );

  const modelRef =
    useRef<THREE.Group>(
      null
    );

  /* =======================================================
     LOAD GLB
  ======================================================= */

  const {
    scene,
  } =
    useGLTF(
      modelUrl
    );

  /* =======================================================
     PREPARE MODEL
  ======================================================= */

  const preparedModel =
    useMemo(
      () => {
        const cloned =
          scene.clone(
            true
          );

        cloned.updateMatrixWorld(
          true
        );

        /*
          Home Character does NOT use realtime shadows.

          This is intentional.

          GLB already contains textures/materials.
          Disabling shadow maps reduces GPU memory and
          prevents WebGL Context Lost on weaker devices.
        */

        cloned.traverse(
          (
            object
          ) => {
            if (
              object instanceof
              THREE.Mesh
            ) {
              object.castShadow =
                false;

              object.receiveShadow =
                false;

              const materials =
                Array.isArray(
                  object.material
                )
                  ? object.material
                  : [
                      object.material,
                    ];

              materials.forEach(
                (
                  material
                ) => {
                  if (
                    material instanceof
                    THREE.MeshStandardMaterial
                  ) {
                    material.envMapIntensity =
                      0.55;

                    const tintStrength =
                      gradeTintStrength[
                        grade
                      ];

                    if (
                      tintStrength >
                      0
                    ) {
                      material.color =
                        material.color
                          .clone()
                          .lerp(
                            new THREE.Color(
                              gradeTheme[
                                grade
                              ].color
                            ),
                            tintStrength
                          );
                    }

                    const emissiveIntensity =
                      gradeEmissiveIntensity[
                        grade
                      ];

                    if (
                      emissiveIntensity >
                      0
                    ) {
                      material.emissive =
                        new THREE.Color(
                          gradeTheme[
                            grade
                          ].color
                        );

                      material.emissiveIntensity =
                        emissiveIntensity;
                    }

                    material.needsUpdate =
                      true;
                  }
                }
              );
            }
          }
        );

        /* ===============================================
           AUTO FIT
        =============================================== */

        const box =
          new THREE.Box3()
            .setFromObject(
              cloned
            );

        const size =
          new THREE.Vector3();

        const center =
          new THREE.Vector3();

        box.getSize(
          size
        );

        box.getCenter(
          center
        );

        const height =
          Math.max(
            size.y,
            0.0001
          );

        const targetHeight =
          2.05;

        const scale =
          targetHeight /
          height;

        /*
          Apply position to an OUTER group instead of
          mutating model position and scale independently.

          This keeps different Character GLBs predictable.
        */

        return {
          model:
            cloned,

          scale,

          centerX:
            center.x,

          centerZ:
            center.z,

          minY:
            box.min.y,
        };
      },
      [
        scene,
        grade,
      ]
    );

  /* =======================================================
     IDLE
  ======================================================= */

  useFrame(
    (
      state,
      delta
    ) => {
      if (
        !rootRef.current ||
        !modelRef.current
      ) {
        return;
      }

      const time =
        state.clock
          .getElapsedTime();

      /*
        Very light idle animation.
      */

      rootRef.current.position.y =
        -1.02 +
        Math.sin(
          time *
            1.4
        ) *
          0.012;

      const turn =
        Math.sin(
          time *
            0.38
        ) *
        0.035;

      modelRef.current.rotation.y =
        THREE.MathUtils.lerp(
          modelRef.current
            .rotation.y,

          turn,

          Math.min(
            1,
            delta *
              2
          )
        );
    }
  );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <group
      ref={
        rootRef
      }
      position={[
        0,
        -1.02,
        0,
      ]}
    >

      <group
        scale={[
          preparedModel.scale,
          preparedModel.scale,
          preparedModel.scale,
        ]}
      >

        <group
          ref={
            modelRef
          }
          position={[
            -preparedModel
              .centerX,

            -preparedModel
              .minY,

            -preparedModel
              .centerZ,
          ]}
        >

          <primitive
            object={
              preparedModel.model
            }
          />

        </group>

      </group>

    </group>
  );
}

/* =========================================================
   LIGHTING — SAFE MODE
========================================================= */

function SafeLighting({
  grade,
}: {
  grade: Grade;
}) {
  const theme =
    gradeTheme[
      grade
    ];

  return (
    <>

      <ambientLight
        intensity={
          1.15
        }
      />

      <hemisphereLight
        args={[
          "#ffffff",
          "#121218",
          1.4,
        ]}
      />

      <directionalLight
        position={[
          4,
          5,
          5,
        ]}
        intensity={
          2.2
        }
        color="#ffffff"
      />

      <directionalLight
        position={[
          -4,
          2,
          2,
        ]}
        intensity={
          1.0
        }
        color="#8bdcff"
      />

      <directionalLight
        position={[
          1,
          3,
          -4,
        ]}
        intensity={
          grade ===
            "LEGENDARY"
            ? 2.0
            : 1.2
        }
        color={
          theme.color
        }
      />

    </>
  );
}

/* =========================================================
   SCENE
========================================================= */

function CharacterScene({
  grade,
  modelUrl,
}: {
  grade: Grade;

  modelUrl: string;
}) {
  return (
    <>

      {/*
        IMPORTANT:
        Explicit background prevents the Canvas from ever
        appearing as a white rectangle.
      */}

      <color
        attach="background"
        args={[
          "#05070a",
        ]}
      />

      <SafeLighting
        grade={
          grade
        }
      />

      <PlayerModel
        modelUrl={
          modelUrl
        }
        grade={
          grade
        }
      />

      <OrbitControls
        makeDefault

        enablePan={
          false
        }

        enableZoom={
          false
        }

        enableDamping={
          false
        }

        target={[
          0,
          -0.02,
          0,
        ]}

        minPolarAngle={
          Math.PI /
          2.2
        }

        maxPolarAngle={
          Math.PI /
          1.9
        }

        minAzimuthAngle={
          -0.9
        }

        maxAzimuthAngle={
          0.9
        }
      />

    </>
  );
}

/* =========================================================
   WEBGL CANVAS
========================================================= */

function CharacterCanvas({
  grade,
  modelUrl,
  onContextLost,
  onContextRestored,
}: {
  grade: Grade;

  modelUrl: string;

  onContextLost:
    () => void;

  onContextRestored:
    () => void;
}) {
  return (
    <Canvas
      camera={{
        position: [
          0,
          0.02,
          5.3,
        ],

        fov:
          30,

        near:
          0.1,

        far:
          100,
      }}

      /*
        Force DPR = 1.

        This is significantly lighter than rendering a
        high-DPI WebGL buffer.
      */

      dpr={
        1
      }

      gl={{
        antialias:
          false,

        alpha:
          false,

        powerPreference:
          "high-performance",

        preserveDrawingBuffer:
          false,

        depth:
          true,

        stencil:
          false,
      }}

      onCreated={(
        state
      ) => {
        const canvas =
          state.gl
            .domElement;

        state.gl.setClearColor(
          "#05070a",
          1
        );

        const handleLost =
          (
            event: Event
          ) => {
            event.preventDefault();

            console.warn(
              "LOOTFORM CHARACTER WEBGL CONTEXT LOST"
            );

            onContextLost();
          };

        const handleRestored =
          () => {
            console.info(
              "LOOTFORM CHARACTER WEBGL CONTEXT RESTORED"
            );

            onContextRestored();
          };

        canvas.addEventListener(
          "webglcontextlost",
          handleLost,
          false
        );

        canvas.addEventListener(
          "webglcontextrestored",
          handleRestored,
          false
        );
      }}
    >

      <CharacterScene
        grade={
          grade
        }
        modelUrl={
          modelUrl
        }
      />

    </Canvas>
  );
}

/* =========================================================
   MAIN
========================================================= */

export default function CharacterAvatar({
  grade = "COMMON",
  modelUrl,
}: CharacterAvatarProps) {
  const activeGrade =
    normalizeGrade(
      grade
    );

  const theme =
    gradeTheme[
      activeGrade
    ];

  const legendary =
    activeGrade ===
    "LEGENDARY";

  const activeModelUrl =
    modelUrl
      ?.trim() ??
    "";

  const hasModel =
    activeModelUrl.length >
    0;

  const [
    contextLost,
    setContextLost,
  ] =
    useState(
      false
    );

  /*
    If a Context Lost event happens,
    changing rendererKey forces a clean WebGL Canvas
    after the old context is released.
  */

  const [
    rendererKey,
    setRendererKey,
  ] =
    useState(
      0
    );

  useEffect(
    () => {
      /*
        Character changed:
        start a clean renderer.
      */

      setContextLost(
        false
      );

      setRendererKey(
        (
          current
        ) =>
          current +
          1
      );
    },
    [
      activeModelUrl,
    ]
  );

  function restoreRenderer() {
    setContextLost(
      false
    );

    setRendererKey(
      (
        current
      ) =>
        current +
        1
    );
  }

  return (
    <div
      className="
        relative
        h-full
        min-h-[500px]
        w-full
        overflow-hidden
        bg-[#05070a]
      "
    >

      {/* ===================================================
          BACKLIGHT
      =================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          left-1/2
          top-[43%]
          z-[1]
          h-[470px]
          w-[470px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          animate-pulse
        "
        style={{
          background:
            `radial-gradient(
              circle,
              ${theme.glow} 0%,
              ${theme.soft} 35%,
              transparent 72%
            )`,
        }}
      />

      {/* ===================================================
          HUD OUTER
      =================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          left-1/2
          top-[43%]
          z-[2]
          h-[430px]
          w-[430px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border
          border-dashed
          border-white/10
        "
      />

      {/* ===================================================
          HUD INNER
      =================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          left-1/2
          top-[43%]
          z-[2]
          h-[345px]
          w-[345px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border
        "
        style={{
          borderColor:
            theme.soft,

          boxShadow:
            `0 0 45px ${theme.soft}`,
        }}
      />

      {/* ===================================================
          LEGENDARY CSS FX

          IMPORTANT:
          Legendary effects stay in CSS.
          We deliberately do NOT create extra 3D geometry.
      =================================================== */}

      {legendary && (
        <>

          <div
            className="
              pointer-events-none
              absolute
              inset-x-[14%]
              bottom-[95px]
              z-[3]
              h-[110px]
              rounded-full
              blur-[55px]
              animate-pulse
            "
            style={{
              background:
                "rgba(251,146,60,0.26)",
            }}
          />

          <div
            className="
              pointer-events-none
              absolute
              left-[12%]
              top-[22%]
              z-[3]
              h-[2px]
              w-[35%]
              rotate-[-24deg]
              blur-[2px]
            "
            style={{
              background:
                "linear-gradient(90deg, transparent, #fb923c, transparent)",
            }}
          />

          <div
            className="
              pointer-events-none
              absolute
              right-[12%]
              top-[31%]
              z-[3]
              h-[2px]
              w-[30%]
              rotate-[28deg]
              blur-[2px]
            "
            style={{
              background:
                "linear-gradient(90deg, transparent, #facc15, transparent)",
            }}
          />

        </>
      )}

      {/* ===================================================
          CANVAS
      =================================================== */}

      <div
        className="
          absolute
          left-0
          right-0
          top-0
          bottom-[96px]
          z-10
          overflow-hidden
          bg-[#05070a]
        "
      >

        {!hasModel ? (
          <ModelUnavailable
            color={theme.color}
            glow={theme.glow}
            message="No active Character GLB is assigned to this player."
          />
        ) : !contextLost ? (
          <ModelErrorBoundary
            key={`${activeModelUrl}-boundary-${rendererKey}`}
            fallback={
              <ModelUnavailable
                color={theme.color}
                glow={theme.glow}
                message="The assigned Character GLB could not be loaded. Check the model URL or Storage object."
              />
            }
          >
            <Suspense
              fallback={
                <Loading3D />
              }
            >

              <CharacterCanvas
                key={
                  `${activeModelUrl}-${rendererKey}`
                }
                grade={
                  activeGrade
                }
                modelUrl={
                  activeModelUrl
                }
                onContextLost={() =>
                  setContextLost(
                    true
                  )
                }
                onContextRestored={
                  restoreRenderer
                }
              />

            </Suspense>
          </ModelErrorBoundary>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#05070a]">

            <div className="max-w-[280px] text-center">

              <div
                className="mx-auto h-12 w-12 rounded-full border"
                style={{
                  borderColor:
                    theme.color,

                  boxShadow:
                    `0 0 30px ${theme.glow}`,
                }}
              />

              <p
                className="mt-5 text-[10px] font-black tracking-[0.22em]"
                style={{
                  color:
                    theme.color,
                }}
              >
                3D RENDERER RESET
              </p>

              <p className="mt-2 text-[9px] leading-5 text-zinc-600">
                WebGL context was interrupted.
              </p>

              <button
                type="button"
                onClick={
                  restoreRenderer
                }
                className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/[0.05] px-5 py-3 text-[9px] font-black text-cyan-400"
              >
                RELOAD 3D
              </button>

            </div>

          </div>
        )}

      </div>

      {/* ===================================================
          LIVE STATUS
      =================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          right-4
          top-4
          z-20
          flex
          items-center
          gap-2
          rounded-full
          border
          bg-black/70
          px-3
          py-2
          backdrop-blur
        "
        style={{
          borderColor:
            theme.soft,
        }}
      >

        <span
          className={`
            h-1.5
            w-1.5
            rounded-full
            ${
              contextLost
                ? "bg-yellow-400"
                : "animate-pulse bg-lime-400"
            }
          `}
        />

        <span
          className="
            text-[8px]
            font-black
            tracking-[0.18em]
          "
          style={{
            color:
              theme.color,
          }}
        >
          {contextLost
            ? "3D RESET"
            : "LIVE 3D"}
        </span>

      </div>

      {/* ===================================================
          ROTATE LABEL
      =================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          right-4
          top-14
          z-20
          rounded-full
          border
          border-white/10
          bg-black/60
          px-3
          py-2
          text-[7px]
          font-black
          tracking-[0.16em]
          text-zinc-500
        "
      >
        DRAG TO ROTATE
      </div>

      {/* ===================================================
          ENERGY STATUS
      =================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          bottom-[91px]
          left-1/2
          z-20
          -translate-x-1/2
          text-center
        "
      >

        <p
          className="
            whitespace-nowrap
            text-[7px]
            font-black
            tracking-[0.28em]
          "
          style={{
            color:
              theme.color,
          }}
        >
          {legendary
            ? "LEGENDARY ENERGY ACTIVE"
            : `${activeGrade} ENERGY`}
        </p>

      </div>

      {/* ===================================================
          GRADE PANEL
      =================================================== */}

      <div
        className="
          pointer-events-none
          absolute
          bottom-2
          left-1/2
          z-30
          w-[88%]
          max-w-[490px]
          -translate-x-1/2
          overflow-hidden
          rounded-[24px]
          border
          px-6
          py-3
          text-center
          backdrop-blur-xl
        "
        style={{
          borderColor:
            theme.color,

          background:
            `linear-gradient(
              180deg,
              rgba(2,6,14,0.97) 0%,
              ${theme.panel} 100%
            )`,

          boxShadow:
            legendary
              ? `0 0 28px ${theme.glow},
                 0 0 70px rgba(251,146,60,0.18)`
              : `0 0 30px ${theme.glow}`,
        }}
      >

        <div
          className="
            absolute
            left-1/2
            top-0
            h-[2px]
            w-[55%]
            -translate-x-1/2
          "
          style={{
            background:
              `linear-gradient(
                90deg,
                transparent,
                ${theme.color},
                transparent
              )`,

            boxShadow:
              `0 0 15px ${theme.color}`,
          }}
        />

        <div className="relative z-10">

          <p className="text-[7px] font-black tracking-[0.32em] text-zinc-600">
            EQUIPPED GRADE
          </p>

          <p
            className="
              mt-2
              whitespace-nowrap
              text-[28px]
              font-black
              leading-none
              tracking-[0.03em]
              sm:text-[35px]
            "
            style={{
              color:
                theme.color,

              textShadow:
                legendary
                  ? "0 0 12px rgba(251,146,60,1), 0 0 28px rgba(251,146,60,0.65)"
                  : `0 0 22px ${theme.glow}`,
            }}
          >
            {activeGrade}
          </p>

        </div>

      </div>

    </div>
  );
}