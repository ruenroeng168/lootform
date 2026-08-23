"use client";

import {
  useState,
} from "react";

import Navbar from "@/components/Navbar";

import {
  startGameSession,
} from "@/lib/game-session";

import {
  GameEventError,
  sendGameStartEvent,
} from "@/lib/game-event";

// =========================================================
// CONFIG
// =========================================================

const GAME_CODE =
  "LF-GRID-EXPEDITION";

// =========================================================
// TYPES
// =========================================================

type TestResult = {
  sessionId: string;

  sessionStatus: string;

  eventId: number;

  eventType: string;

  eventName:
    | string
    | null;

  createdAt: string;

  lastEventAt:
    | string
    | null;
};

// =========================================================
// PAGE
// =========================================================

export default function GameEventHelperTestPage() {
  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );

  const [
    result,
    setResult,
  ] =
    useState<
      TestResult | null
    >(
      null
    );

  // =====================================================
  // RUN TEST
  // =====================================================

  async function runTest() {
    if (
      loading
    ) {
      return;
    }

    setLoading(
      true
    );

    setErrorMessage(
      ""
    );

    setResult(
      null
    );

    try {
      // =================================================
      // 1. CREATE REAL SESSION
      // =================================================

      const createdSession =
        await startGameSession(
          GAME_CODE
        );

      // =================================================
      // 2. SEND EVENT THROUGH lib/game-event.ts
      // =================================================

      const eventResult =
        await sendGameStartEvent(
          createdSession
            .session
            .id,
          {
            source:
              "GAME_EVENT_HELPER_TEST",

            game_code:
              createdSession
                .game
                .code,

            game_version:
              createdSession
                .game
                .version,

            engine:
              createdSession
                .game
                .engine,
          }
        );

      // =================================================
      // 3. RESULT
      // =================================================

      setResult({
        sessionId:
          createdSession
            .session
            .id,

        sessionStatus:
          createdSession
            .session
            .status,

        eventId:
          eventResult
            .event
            .id,

        eventType:
          eventResult
            .event
            .event_type,

        eventName:
          eventResult
            .event
            .event_name,

        createdAt:
          eventResult
            .event
            .created_at,

        lastEventAt:
          eventResult
            .session
            ?.last_event_at ??
          null,
      });
    } catch (
      error
    ) {
      console.error(
        "GAME EVENT HELPER TEST ERROR:",
        error
      );

      if (
        error instanceof
        GameEventError
      ) {
        setErrorMessage(
          `${error.code}: ${error.message}`
        );
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unexpected test error."
        );
      }
    } finally {
      setLoading(
        false
      );
    }
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      <div className="mx-auto max-w-[1000px] px-5 pb-16 pt-10 sm:px-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <section>

          <p className="text-[8px] font-black tracking-[0.3em] text-purple-400">
            LOOTFORM GAME PLATFORM // STEP 15B
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">

            EVENT{" "}

            <span className="text-cyan-400">
              HELPER TEST
            </span>

          </h1>

          <p className="mt-3 max-w-2xl text-[10px] leading-5 text-zinc-600">
            Test the reusable LOOTFORM Game Event client helper before connecting it to GRID EXPEDITION.
          </p>

        </section>

        {/* =================================================
            FLOW
        ================================================= */}

        <section className="mt-8 rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">

          <p className="text-[7px] font-black tracking-[0.2em] text-cyan-400">
            TEST FLOW
          </p>

          <div className="mt-5 grid gap-2 md:grid-cols-7">

            <FlowBox
              number="01"
              title="SESSION"
              value="Create"
            />

            <FlowArrow />

            <FlowBox
              number="02"
              title="HELPER"
              value="game-event.ts"
            />

            <FlowArrow />

            <FlowBox
              number="03"
              title="EVENT"
              value="GAME_START"
            />

            <FlowArrow />

            <FlowBox
              number="04"
              title="SERVER"
              value="game_events"
            />

          </div>

          <button
            type="button"
            onClick={() => {
              void runTest();
            }}
            disabled={
              loading
            }
            className="mt-7 w-full rounded-xl bg-cyan-400 px-6 py-4 text-[11px] font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "CREATING SESSION + SENDING EVENT..."
              : "▶ TEST GAME EVENT HELPER"}
          </button>

          <p className="mt-3 text-center text-[7px] text-zinc-700">
            CLICK ONCE ONLY — THIS CREATES A REAL GAME SESSION.
          </p>

        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (
          <section className="mt-5 rounded-2xl border border-red-400/30 bg-red-400/[0.04] p-5">

            <p className="text-[8px] font-black tracking-[0.2em] text-red-400">
              TEST FAILED
            </p>

            <p className="mt-3 break-words font-mono text-[9px] text-zinc-300">
              {errorMessage}
            </p>

          </section>
        )}

        {/* =================================================
            RESULT
        ================================================= */}

        <section className="mt-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-[7px] font-black tracking-[0.2em] text-purple-400">
                HELPER RESPONSE
              </p>

              <h2 className="mt-2 text-xl font-black">
                TEST RESULT
              </h2>

            </div>

            {result && (
              <span className="rounded-full border border-lime-400/30 bg-lime-400/[0.05] px-4 py-2 text-[8px] font-black text-lime-400">
                ✓ PASS
              </span>
            )}

          </div>

          {!result ? (
            <div className="mt-5 flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-black/30">

              <p className="text-[8px] font-black tracking-[0.2em] text-zinc-700">
                WAITING FOR TEST
              </p>

            </div>
          ) : (
            <div className="mt-5">

              <div className="rounded-2xl border border-lime-400/20 bg-lime-400/[0.03] p-5">

                <p className="text-[8px] font-black tracking-[0.22em] text-lime-400">
                  ✓ GAME EVENT HELPER WORKING
                </p>

                <p className="mt-2 text-[9px] text-zinc-600">
                  The reusable client helper successfully created a real server Game Event.
                </p>

              </div>

              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-black p-5">

                <p className="text-[7px] font-black tracking-[0.18em] text-cyan-400">
                  SESSION UUID
                </p>

                <p className="mt-3 break-all font-mono text-sm font-bold text-white">
                  {result.sessionId}
                </p>

              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">

                <DataBox
                  label="SESSION STATUS"
                  value={
                    result.sessionStatus
                  }
                />

                <DataBox
                  label="EVENT ID"
                  value={
                    `#${result.eventId}`
                  }
                />

                <DataBox
                  label="EVENT TYPE"
                  value={
                    result.eventType
                  }
                />

                <DataBox
                  label="EVENT NAME"
                  value={
                    result.eventName ??
                    "NULL"
                  }
                />

              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">

                <DataBox
                  label="EVENT CREATED"
                  value={
                    result.createdAt
                  }
                />

                <DataBox
                  label="LAST EVENT AT"
                  value={
                    result.lastEventAt ??
                    "NULL"
                  }
                />

              </div>

            </div>
          )}

        </section>

        {/* =================================================
            NEXT
        ================================================= */}

        <section className="mt-5 rounded-xl border border-orange-400/15 bg-orange-400/[0.03] p-4">

          <p className="text-[7px] font-black tracking-[0.2em] text-orange-400">
            NEXT STEP
          </p>

          <p className="mt-2 text-[8px] leading-5 text-zinc-600">
            After this helper passes, GRID EXPEDITION can send GAME_START, TREASURE_FOUND, MONSTER_DEFEATED, SCORE, COMPLETE and FAIL events through the same server-controlled pipeline.
          </p>

        </section>

      </div>

    </main>
  );
}

// =========================================================
// FLOW BOX
// =========================================================

function FlowBox({
  number,
  title,
  value,
}: {
  number: string;

  title: string;

  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">

      <p className="font-mono text-[6px] text-zinc-700">
        {number}
      </p>

      <p className="mt-2 text-[8px] font-black text-cyan-400">
        {title}
      </p>

      <p className="mt-1 text-[7px] text-zinc-600">
        {value}
      </p>

    </div>
  );
}

// =========================================================
// ARROW
// =========================================================

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center text-cyan-400/40 md:flex">
      →
    </div>
  );
}

// =========================================================
// DATA BOX
// =========================================================

function DataBox({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/50 p-4">

      <p className="text-[6px] font-black tracking-[0.16em] text-zinc-600">
        {label}
      </p>

      <p className="mt-2 break-all font-mono text-[9px] font-bold text-white">
        {value}
      </p>

    </div>
  );
}