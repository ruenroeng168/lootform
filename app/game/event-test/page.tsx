"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Navbar from "@/components/Navbar";

import {
  startGameSession,
} from "@/lib/game-session";

import {
  supabase,
} from "@/lib/supabase";

// =========================================================
// TYPES
// =========================================================

type EventApiResponse = {
  ok: boolean;

  event?: {
    id: number;

    session_id: string;

    event_type: string;

    event_name:
      | string
      | null;

    numeric_value:
      | number
      | null;

    payload:
      Record<
        string,
        unknown
      >;

    created_at: string;
  };

  session?: {
    id: string;

    status: string;

    last_event_at: string;
  };

  game?: {
    id: number;

    code:
      | string
      | null;

    version:
      | string
      | null;

    engine:
      | string
      | null;
  };

  code?: string;

  error?: string;
};

type TestResult = {
  sessionId: string;

  sessionStatus: string;

  sessionStartedAt: string;

  eventHttpStatus: number;

  event:
    EventApiResponse;
};

// =========================================================
// CONFIG
// =========================================================

const GAME_CODE =
  "LF-GRID-EXPEDITION";

// =========================================================
// PAGE
// =========================================================

export default function GameEventTestPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
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

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );

  // =====================================================
  // TEST EVENT
  // =====================================================

  async function runEventTest() {
    if (
      loading
    ) {
      return;
    }

    setLoading(
      true
    );

    setResult(
      null
    );

    setErrorMessage(
      ""
    );

    try {
      // =================================================
      // 1. CREATE REAL GAME SESSION
      // =================================================

      const created =
        await startGameSession(
          GAME_CODE
        );

      // =================================================
      // 2. GET AUTH TOKEN
      // =================================================

      const {
        data: {
          session:
            authSession,
        },

        error:
          authError,
      } =
        await supabase
          .auth
          .getSession();

      if (
        authError
      ) {
        throw authError;
      }

      if (
        !authSession
      ) {
        router.push(
          "/login"
        );

        return;
      }

      // =================================================
      // 3. SEND GAME_START EVENT
      // =================================================

      const response =
        await fetch(
          "/api/game/event",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${authSession.access_token}`,
            },

            body:
              JSON.stringify({
                session_id:
                  created.session.id,

                event_type:
                  "GAME_START",

                event_name:
                  "GRID_EXPEDITION_TEST_START",

                payload: {
                  source:
                    "EVENT_TEST_PAGE",

                  game_code:
                    GAME_CODE,

                  game_version:
                    created.game.version,

                  engine:
                    created.game.engine,
                },
              }),

            cache:
              "no-store",
          }
        );

      const eventResult =
        (await response.json()) as EventApiResponse;

      setResult({
        sessionId:
          created.session.id,

        sessionStatus:
          created.session.status,

        sessionStartedAt:
          created.session.started_at,

        eventHttpStatus:
          response.status,

        event:
          eventResult,
      });

      if (
        !response.ok ||
        !eventResult.ok
      ) {
        setErrorMessage(
          `${eventResult.code ?? "EVENT_FAILED"}: ${eventResult.error ?? "Unable to create Game Event."}`
        );
      }
    } catch (
      error
    ) {
      console.error(
        "GAME EVENT TEST ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unexpected test error."
      );
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

        {/* HEADER */}

        <section>

          <p className="text-[8px] font-black tracking-[0.3em] text-purple-400">
            LOOTFORM GAME PLATFORM // EVENT TEST
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">

            GAME{" "}

            <span className="text-cyan-400">
              EVENT TEST
            </span>

          </h1>

          <p className="mt-3 max-w-2xl text-[10px] leading-5 text-zinc-600">
            This page creates one authenticated Game Session and sends one real GAME_START event to the LOOTFORM server.
          </p>

        </section>

        {/* TEST CARD */}

        <section className="mt-8 rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">

          <div className="flex flex-wrap items-start justify-between gap-4">

            <div>

              <p className="text-[7px] font-black tracking-[0.2em] text-cyan-400">
                TEST TARGET
              </p>

              <h2 className="mt-2 text-2xl font-black">
                GRID EXPEDITION
              </h2>

              <p className="mt-2 font-mono text-[9px] text-zinc-600">
                LF-GRID-EXPEDITION
              </p>

            </div>

            <div className="rounded-full border border-orange-400/20 bg-orange-400/[0.04] px-4 py-2">

              <p className="text-[7px] font-black tracking-[0.16em] text-orange-400">
                GAME_START
              </p>

            </div>

          </div>

          {/* FLOW */}

          <div className="mt-6 grid gap-2 sm:grid-cols-7">

            <FlowBox
              number="01"
              title="AUTH"
              value="Player"
            />

            <FlowArrow />

            <FlowBox
              number="02"
              title="SESSION"
              value="Create"
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
              title="DATABASE"
              value="game_events"
            />

          </div>

          <button
            type="button"
            onClick={() => {
              void runEventTest();
            }}
            disabled={
              loading
            }
            className="mt-7 w-full rounded-xl bg-cyan-400 px-6 py-4 text-[11px] font-black text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "CREATING SESSION + EVENT..."
              : "▶ CREATE ONE TEST GAME EVENT"}
          </button>

          <p className="mt-3 text-center text-[7px] text-zinc-700">
            Click once only. Each test creates a real Game Session.
          </p>

        </section>

        {/* ERROR */}

        {errorMessage && (
          <section className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/[0.04] p-5">

            <p className="text-[8px] font-black tracking-[0.2em] text-red-400">
              TEST ERROR
            </p>

            <p className="mt-3 break-words font-mono text-[9px] text-zinc-300">
              {errorMessage}
            </p>

          </section>
        )}

        {/* RESULT */}

        <section className="mt-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-[7px] font-black tracking-[0.2em] text-purple-400">
                SERVER RESPONSE
              </p>

              <h2 className="mt-2 text-xl font-black">
                EVENT RESULT
              </h2>

            </div>

            {result && (
              <div
                className={
                  result.event.ok
                    ? "rounded-full border border-lime-400/30 bg-lime-400/[0.05] px-4 py-2 text-[8px] font-black text-lime-400"
                    : "rounded-full border border-red-400/30 bg-red-400/[0.05] px-4 py-2 text-[8px] font-black text-red-400"
                }
              >
                HTTP{" "}
                {result.eventHttpStatus}
              </div>
            )}

          </div>

          {!result ? (
            <div className="mt-5 flex min-h-[250px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-black/30">

              <p className="text-[8px] font-black tracking-[0.2em] text-zinc-700">
                NO EVENT CREATED YET
              </p>

            </div>
          ) : result.event.ok &&
            result.event.event ? (
            <div className="mt-5">

              {/* SUCCESS */}

              <div className="rounded-2xl border border-lime-400/20 bg-lime-400/[0.03] p-5">

                <p className="text-[8px] font-black tracking-[0.22em] text-lime-400">
                  ✓ GAME EVENT CREATED
                </p>

                <p className="mt-2 text-[9px] text-zinc-600">
                  The event was recorded by the LOOTFORM server.
                </p>

              </div>

              {/* SESSION */}

              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-black p-5">

                <p className="text-[7px] font-black tracking-[0.18em] text-cyan-400">
                  SESSION UUID
                </p>

                <p className="mt-3 break-all font-mono text-sm font-bold text-white">
                  {result.sessionId}
                </p>

              </div>

              {/* EVENT ID */}

              <div className="mt-4 rounded-2xl border border-purple-400/20 bg-black p-5">

                <p className="text-[7px] font-black tracking-[0.18em] text-purple-400">
                  GAME EVENT ID
                </p>

                <p className="mt-3 font-mono text-xl font-black text-white">
                  #{result.event.event.id}
                </p>

              </div>

              {/* EVENT DATA */}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">

                <DataBox
                  label="SESSION STATUS"
                  value={
                    result.sessionStatus
                  }
                />

                <DataBox
                  label="EVENT TYPE"
                  value={
                    result.event.event.event_type
                  }
                />

                <DataBox
                  label="EVENT NAME"
                  value={
                    result.event.event.event_name ??
                    "NULL"
                  }
                />

                <DataBox
                  label="NUMERIC VALUE"
                  value={
                    result.event.event.numeric_value ===
                    null
                      ? "NULL"
                      : String(
                          result.event.event.numeric_value
                        )
                  }
                />

              </div>

              {/* LAST EVENT */}

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/50 p-4">

                <p className="text-[7px] font-black text-zinc-600">
                  LAST EVENT AT
                </p>

                <p className="mt-2 font-mono text-[9px] text-lime-400">
                  {result.event.session?.last_event_at ??
                    "NOT RETURNED"}
                </p>

              </div>

            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/[0.04] p-5">

              <p className="text-[8px] font-black tracking-[0.2em] text-red-400">
                EVENT CREATE FAILED
              </p>

              <p className="mt-4 font-mono text-[9px] text-orange-400">
                {result.event.code ??
                  "UNKNOWN_ERROR"}
              </p>

              <p className="mt-2 text-sm text-zinc-300">
                {result.event.error ??
                  "Unknown error."}
              </p>

            </div>
          )}

        </section>

        {/* SECURITY */}

        <section className="mt-5 rounded-xl border border-orange-400/15 bg-orange-400/[0.03] p-4">

          <p className="text-[7px] font-black tracking-[0.2em] text-orange-400">
            SERVER AUTHORITY
          </p>

          <p className="mt-2 text-[8px] leading-5 text-zinc-600">
            This test records gameplay telemetry only. It cannot grant EXP, LT, Items, Wallet Balance, Collection Score or Global Rank.
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
// FLOW ARROW
// =========================================================

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center text-cyan-400/40 sm:flex">
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

      <p className="mt-2 break-words font-mono text-[10px] font-bold text-white">
        {value}
      </p>

    </div>
  );
}