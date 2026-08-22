"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Navbar from "@/components/Navbar";

import {
  supabase,
} from "@/lib/supabase";

// =========================================================
// TYPES
// =========================================================

type StartSessionResponse = {
  ok: boolean;

  session?: {
    id: string;

    status: string;

    started_at: string;
  };

  game?: {
    id: number;

    code: string;

    name: string;

    engine: string;

    version: string;

    launch_url:
      | string
      | null;
  };

  bridge?: {
    version: string;

    allowed_origin:
      | string
      | null;

    supports: {
      score: boolean;

      progress: boolean;

      events: boolean;
    };
  };

  code?: string;

  error?: string;
};

// =========================================================
// PAGE
// =========================================================

export default function GameSessionTestPage() {
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
      StartSessionResponse | null
    >(
      null
    );

  const [
    httpStatus,
    setHttpStatus,
  ] =
    useState<
      number | null
    >(
      null
    );

  // =====================================================
  // START SESSION
  // =====================================================

  async function startSession() {
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

    setHttpStatus(
      null
    );

    try {
      // =================================================
      // 1. GET AUTH SESSION
      // =================================================

      const {
        data: {
          session,
        },

        error:
          sessionError,
      } =
        await supabase
          .auth
          .getSession();

      if (
        sessionError
      ) {
        throw sessionError;
      }

      if (
        !session
      ) {
        router.push(
          "/login"
        );

        return;
      }

      // =================================================
      // 2. CALL START GAME SESSION API
      // =================================================

      const response =
        await fetch(
          "/api/game/session/start",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                game_code:
                  "LF-GRID-EXPEDITION",
              }),

            cache:
              "no-store",
          }
        );

      // =================================================
      // 3. READ RESULT
      // =================================================

      const data =
        (await response.json()) as StartSessionResponse;

      setHttpStatus(
        response.status
      );

      setResult(
        data
      );
    } catch (
      error
    ) {
      console.error(
        "SESSION TEST ERROR:",
        error
      );

      setResult({
        ok: false,

        code:
          "CLIENT_ERROR",

        error:
          error instanceof Error
            ? error.message
            : "Unexpected client error.",
      });
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
            LOOTFORM GAME PLATFORM // TEST
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">

            GAME{" "}

            <span className="text-cyan-400">
              SESSION TEST
            </span>

          </h1>

          <p className="mt-3 max-w-2xl text-[10px] leading-5 text-zinc-600">
            This test creates a real authenticated Game Session
            for GRID EXPEDITION without starting the actual game.
          </p>

        </section>

        {/* =================================================
            GAME
        ================================================= */}

        <section className="mt-8 rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">

          <div className="flex flex-wrap items-start justify-between gap-5">

            <div>

              <p className="text-[7px] font-black tracking-[0.2em] text-cyan-400">
                GAME CATALOG
              </p>

              <h2 className="mt-2 text-2xl font-black">
                GRID EXPEDITION
              </h2>

              <p className="mt-2 font-mono text-[9px] text-zinc-600">
                LF-GRID-EXPEDITION
              </p>

            </div>

            <div className="rounded-full border border-lime-400/20 bg-lime-400/[0.04] px-4 py-2">

              <p className="text-[7px] font-black tracking-[0.18em] text-lime-400">
                INTERNAL GAME
              </p>

            </div>

          </div>

          {/* =================================================
              FLOW
          ================================================= */}

          <div className="mt-6 grid gap-2 sm:grid-cols-5">

            <FlowBox
              number="01"
              title="PLAYER"
              value="Authenticated"
            />

            <FlowArrow />

            <FlowBox
              number="02"
              title="API"
              value="Start Session"
            />

            <FlowArrow />

            <FlowBox
              number="03"
              title="DATABASE"
              value="game_sessions"
            />

          </div>

          {/* =================================================
              START BUTTON
          ================================================= */}

          <button
            type="button"
            onClick={
              startSession
            }
            disabled={
              loading
            }
            className="
              mt-7
              w-full
              rounded-xl
              bg-cyan-400
              px-6
              py-4
              text-[11px]
              font-black
              text-black
              transition
              hover:bg-cyan-300
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >

            {loading
              ? "CREATING SESSION..."
              : "▶ CREATE TEST GAME SESSION"}

          </button>

        </section>

        {/* =================================================
            RESULT
        ================================================= */}

        <section className="mt-5 rounded-[28px] border border-zinc-800 bg-zinc-950 p-6">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-[7px] font-black tracking-[0.2em] text-purple-400">
                SERVER RESPONSE
              </p>

              <h2 className="mt-2 text-xl font-black">
                SESSION RESULT
              </h2>

            </div>

            {httpStatus !==
              null && (
              <div
                className={`
                  rounded-full
                  border
                  px-4
                  py-2
                  text-[8px]
                  font-black

                  ${
                    result?.ok
                      ? "border-lime-400/30 bg-lime-400/[0.05] text-lime-400"
                      : "border-red-400/30 bg-red-400/[0.05] text-red-400"
                  }
                `}
              >
                HTTP{" "}
                {httpStatus}
              </div>
            )}

          </div>

          {!result ? (
            <div className="mt-5 flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-black/30">

              <p className="text-[8px] font-black tracking-[0.2em] text-zinc-700">
                NO SESSION CREATED YET
              </p>

            </div>
          ) : result.ok &&
            result.session &&
            result.game ? (
            <div className="mt-5">

              {/* SUCCESS */}

              <div className="rounded-2xl border border-lime-400/20 bg-lime-400/[0.03] p-5">

                <p className="text-[8px] font-black tracking-[0.22em] text-lime-400">
                  ✓ GAME SESSION CREATED
                </p>

                <p className="mt-2 text-[9px] text-zinc-600">
                  The server created a real authenticated session.
                </p>

              </div>

              {/* SESSION ID */}

              <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-black p-5">

                <p className="text-[7px] font-black tracking-[0.18em] text-cyan-400">
                  SESSION UUID
                </p>

                <p className="mt-3 break-all font-mono text-sm font-bold text-white">
                  {result.session.id}
                </p>

              </div>

              {/* DATA */}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">

                <DataBox
                  label="STATUS"
                  value={
                    result.session.status
                  }
                />

                <DataBox
                  label="GAME CODE"
                  value={
                    result.game.code
                  }
                />

                <DataBox
                  label="ENGINE"
                  value={
                    result.game.engine
                  }
                />

                <DataBox
                  label="VERSION"
                  value={
                    result.game.version
                  }
                />

              </div>

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/50 p-4">

                <p className="text-[7px] font-black text-zinc-600">
                  STARTED AT
                </p>

                <p className="mt-2 font-mono text-[9px] text-zinc-400">
                  {result.session.started_at}
                </p>

              </div>

            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/[0.04] p-5">

              <p className="text-[8px] font-black tracking-[0.2em] text-red-400">
                SESSION CREATE FAILED
              </p>

              <p className="mt-4 font-mono text-[9px] text-orange-400">
                {result.code ??
                  "UNKNOWN_ERROR"}
              </p>

              <p className="mt-2 text-sm text-zinc-300">
                {result.error ??
                  "Unknown error."}
              </p>

            </div>
          )}

        </section>

        {/* =================================================
            SECURITY
        ================================================= */}

        <section className="mt-5 rounded-xl border border-orange-400/15 bg-orange-400/[0.03] p-4">

          <p className="text-[7px] font-black tracking-[0.2em] text-orange-400">
            TEST SCOPE
          </p>

          <p className="mt-2 text-[8px] leading-5 text-zinc-600">
            This test only creates a Game Session.
            It does not award EXP, LT, Items, Wallet Balance
            or Global Rank.
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

      <p className="mt-2 font-mono text-[10px] font-bold text-white">
        {value}
      </p>

    </div>
  );
}