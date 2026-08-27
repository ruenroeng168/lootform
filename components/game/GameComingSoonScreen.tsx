"use client";

import Navbar from "@/components/Navbar";

// =========================================================
// GAME COMING SOON SCREEN
//
// Temporary Phase 2 rollout placeholder for /game and /game/play.
// Presentation only -- see lib/game-access.ts / app/api/game/access
// for the actual gate logic.
// =========================================================

export default function GameComingSoonScreen() {
  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      <div className="mx-auto flex min-h-[75vh] max-w-[720px] flex-col items-center justify-center px-6 text-center">

        <p className="text-[8px] font-black tracking-[0.4em] text-purple-400">
          ZONE 01 // NEON OUTSKIRTS
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-[0.1em] sm:text-4xl">
          GAME{" "}
          <span className="text-cyan-400">
            COMING SOON
          </span>
        </h1>

        <div className="mt-6 h-px w-24 bg-cyan-400/40" />

        <p className="mt-6 max-w-md text-sm leading-relaxed text-zinc-400">
          LOOTFORM Expedition Mode is in active development for its
          next phase. Crafted shirts already carry real Game Stats —
          the Expedition itself opens to players soon.
        </p>

        <p className="mt-8 text-[8px] font-black tracking-[0.3em] text-zinc-600">
          FOLLOW LOOTFORM FOR THE OPEN PLAYTEST DATE
        </p>

      </div>

    </main>
  );
}
