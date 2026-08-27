"use client";

import {
  Press_Start_2P,
} from "next/font/google";

// =========================================================
// STAGE INTRO OVERLAY (STEP 4A.1 -- extracted from
// app/game/play/page.tsx)
//
// PRESENTATION ONLY. zoneId/zoneName/stageLabel/stageName are the
// client-side Stage identity labels (see STAGE_1_1 in page.tsx) --
// never a source of authoritative map/collision truth. Auto-dismiss
// timing lives in the caller; this component only renders and lets
// the viewer tap to skip early.
//
// Generic 8-bit display typeface for the handheld-era HUD chrome --
// not a Pokemon/Nintendo asset.
// =========================================================

const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
});

export default function StageIntroOverlay({
  zoneId,
  zoneName,
  stageLabel,
  stageName,
  onDismiss,
}: {
  zoneId: string;
  zoneName: string;
  stageLabel: string;
  stageName: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="stage-intro absolute inset-0 z-[80] flex flex-col items-center justify-center bg-black text-center"
      onClick={
        onDismiss
      }
    >
      <div className="stage-intro-scanlines pointer-events-none absolute inset-0" />

      <p
        className={`${pixelFont.className} relative z-10 text-[9px] leading-[1.8] text-purple-400`}
      >
        {zoneId}
      </p>

      <h2
        className={`${pixelFont.className} relative z-10 mt-3 text-lg leading-[1.6] text-white sm:text-xl`}
      >
        {zoneName}
      </h2>

      <div className="relative z-10 mt-6 h-1 w-24 bg-cyan-400/40" />

      <p
        className={`${pixelFont.className} relative z-10 mt-6 text-[9px] leading-[1.8] text-cyan-400`}
      >
        {stageLabel}
      </p>

      <h3
        className={`${pixelFont.className} relative z-10 mt-3 text-base leading-[1.6] text-cyan-300 sm:text-lg`}
      >
        {stageName}
      </h3>

      <style jsx>{`

        .stage-intro {
          animation:
            stageIntroFade
            2200ms
            ease-in-out
            1;
        }

        .stage-intro-scanlines {
          background:
            repeating-linear-gradient(
              0deg,
              rgba(34, 211, 238, 0.05) 0px,
              rgba(34, 211, 238, 0.05) 1px,
              transparent 2px,
              transparent 3px
            );
        }

        @keyframes stageIntroFade {
          0% {
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          82% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

      `}</style>
    </div>
  );
}
