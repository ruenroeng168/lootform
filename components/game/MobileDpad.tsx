"use client";

// =========================================================
// MOBILE D-PAD (STEP 4A.1 -- extracted from app/game/play/page.tsx;
// reshaped into a classic handheld cross D-pad on request)
//
// PRESENTATION ONLY. onMove is passed in by the caller as the exact
// same moveHero(dx, dy) used by keyboard input -- this component
// never decides whether a move is valid and never touches
// authoritative position itself.
//
// Generic four-direction cross D-pad silhouette -- the shape every
// handheld game controller uses, not a Nintendo/Pokemon asset.
// =========================================================

export default function MobileDpad({
  onMove,
  disabled,
}: {
  onMove: (
    dx: number,
    dy: number
  ) => void;

  disabled: boolean;
}) {
  const armClass =
    "dpad-arm flex items-center justify-center border-cyan-400/30 bg-zinc-900 text-cyan-300 active:bg-cyan-400/25 disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div
      className="dpad-cross relative grid grid-cols-3 grid-rows-3"
      style={{
        touchAction:
          "none",
      }}
    >

      <div />

      <button
        type="button"
        aria-label="Move up"
        className={`${armClass} dpad-arm-up border-2 border-b-0`}
        disabled={
          disabled
        }
        onClick={() =>
          onMove(
            0,
            -1
          )
        }
      >
        ▲
      </button>

      <div />

      <button
        type="button"
        aria-label="Move left"
        className={`${armClass} dpad-arm-left border-2 border-r-0`}
        disabled={
          disabled
        }
        onClick={() =>
          onMove(
            -1,
            0
          )
        }
      >
        ◀
      </button>

      <div className="dpad-hub flex items-center justify-center border-2 border-cyan-400/30 bg-black" />

      <button
        type="button"
        aria-label="Move right"
        className={`${armClass} dpad-arm-right border-2 border-l-0`}
        disabled={
          disabled
        }
        onClick={() =>
          onMove(
            1,
            0
          )
        }
      >
        ▶
      </button>

      <div />

      <button
        type="button"
        aria-label="Move down"
        className={`${armClass} dpad-arm-down border-2 border-t-0`}
        disabled={
          disabled
        }
        onClick={() =>
          onMove(
            0,
            1
          )
        }
      >
        ▼
      </button>

      <div />

      <style jsx>{`

        .dpad-cross {
          width: 156px;
          height: 156px;
        }

        .dpad-arm {
          width: 52px;
          height: 52px;
        }

        .dpad-arm-up {
          border-radius: 6px 6px 0 0;
        }

        .dpad-arm-down {
          border-radius: 0 0 6px 6px;
        }

        .dpad-arm-left {
          border-radius: 6px 0 0 6px;
        }

        .dpad-arm-right {
          border-radius: 0 6px 6px 0;
        }

        .dpad-hub {
          width: 52px;
          height: 52px;
        }

        @media (max-width: 480px) {
          .dpad-cross {
            width: 138px;
            height: 138px;
          }

          .dpad-arm,
          .dpad-hub {
            width: 46px;
            height: 46px;
          }
        }

      `}</style>

    </div>
  );
}
