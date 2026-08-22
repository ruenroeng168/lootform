"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type PlayerProfile = {
  user_id: string;
  display_name: string | null;
  level: number;
  exp: number;
  title: string;
};

type PlayerRank = {
  collection_score: number;
  global_rank: number;
  total_players: number;
  total_items: number;
  common_items: number;
  rare_items: number;
  epic_items: number;
  legendary_items: number;
};

type RankApiResponse = {
  ok: boolean;
  rank?: PlayerRank;
  code?: string;
  error?: string;
};

type SeasonSettings = {
  season_code?: string;
  season_name?: string;
  product_name?: string;
  craft_cost?: number;
  common_rate?: number;
  rare_rate?: number;
  epic_rate?: number;
  legendary_rate?: number;
  is_active?: boolean;
};

export default function GamePage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    profile,
    setProfile,
  ] =
    useState<PlayerProfile | null>(
      null
    );

  const [
    rank,
    setRank,
  ] =
    useState<PlayerRank | null>(
      null
    );

  const [
    season,
    setSeason,
  ] =
    useState<SeasonSettings | null>(
      null
    );

  useEffect(() => {
    async function loadGameHub() {
      setLoading(
        true
      );

      setErrorMessage(
        ""
      );

      try {
        // =================================================
        // USER
        // =================================================

        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase
            .auth
            .getUser();

        if (
          userError ||
          !user
        ) {
          router.push(
            "/login"
          );

          return;
        }

        // =================================================
        // SESSION
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

        if (!session) {
          router.push(
            "/login"
          );

          return;
        }

        // =================================================
        // PLAYER PROFILE
        // =================================================

        const {
          data:
            profileData,
          error:
            profileError,
        } =
          await supabase
            .from(
              "player_profiles"
            )
            .select(`
              user_id,
              display_name,
              level,
              exp,
              title
            `)
            .eq(
              "user_id",
              user.id
            )
            .maybeSingle();

        if (
          profileError
        ) {
          throw profileError;
        }

        setProfile(
          profileData as
            | PlayerProfile
            | null
        );

        // =================================================
        // COLLECTION RANK
        // =================================================

        const rankResponse =
          await fetch(
            "/api/profile/rank",
            {
              method:
                "GET",

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            }
          );

        const rankResult =
          (await rankResponse.json()) as RankApiResponse;

        if (
          rankResponse.ok &&
          rankResult.ok &&
          rankResult.rank
        ) {
          setRank(
            rankResult.rank
          );
        } else {
          console.error(
            "GAME HUB RANK ERROR:",
            rankResult
          );

          setRank(
            null
          );
        }

        // =================================================
        // SEASON
        // =================================================

        const seasonResponse =
          await fetch(
            "/api/season",
            {
              cache:
                "no-store",
            }
          );

        if (
          seasonResponse.ok
        ) {
          const seasonResult =
            await seasonResponse
              .json();

          setSeason(
            seasonResult
              ?.season ??
              null
          );
        } else {
          setSeason(
            null
          );
        }
      } catch (
        error
      ) {
        console.error(
          "GAME HUB ERROR:",
          error
        );

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load Game Hub."
        );
      } finally {
        setLoading(
          false
        );
      }
    }

    void loadGameHub();
  }, [
    router,
  ]);

  // =====================================================
  // DISPLAY VALUES
  // =====================================================

  const level =
    profile?.level ??
    1;

  const exp =
    profile?.exp ??
    0;

  const title =
    profile?.title ??
    "ROOKIE";

  const playerName =
    profile?.display_name ??
    "PLAYER";

  const collectionScore =
    rank?.collection_score ??
    0;

  const globalRank =
    rank &&
    rank.global_rank >
      0
      ? `#${rank.global_rank}`
      : "#-";

  const totalPlayers =
    rank?.total_players ??
    0;

  // =====================================================
  // LOADING
  // =====================================================

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="flex min-h-[80vh] items-center justify-center">

          <p className="animate-pulse text-sm font-black tracking-[0.3em] text-cyan-400">
            LOADING GAME HUB...
          </p>

        </div>

      </main>
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">

      <Navbar />

      {/* =================================================
          BACKGROUND
      ================================================= */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        <div className="absolute left-1/2 top-[-340px] h-[850px] w-[1100px] -translate-x-1/2 rounded-full bg-cyan-500/[0.08] blur-[190px]" />

        <div className="absolute bottom-[-380px] left-[-260px] h-[750px] w-[750px] rounded-full bg-purple-500/[0.09] blur-[190px]" />

        <div className="absolute bottom-[-380px] right-[-260px] h-[750px] w-[750px] rounded-full bg-orange-400/[0.06] blur-[190px]" />

      </div>

      <div className="relative z-10 mx-auto max-w-[1360px] px-5 pb-14 pt-8 sm:px-6 lg:px-7">

        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-4 text-sm text-red-400">
            {errorMessage}
          </div>
        )}

        {/* =================================================
            HEADER
        ================================================= */}

        <section className="flex flex-wrap items-end justify-between gap-5">

          <div>

            <p className="text-[8px] font-black tracking-[0.32em] text-purple-400">
              LOOTFORM PLAYER SYSTEM
            </p>

            <h1 className="mt-2 text-[40px] font-black leading-none sm:text-[52px]">

              GAME{" "}

              <span className="text-cyan-400">
                HUB
              </span>

            </h1>

            <p className="mt-3 text-[10px] font-bold tracking-[0.08em] text-zinc-600">
              PLAY // PROGRESS // COMPETE // COLLECT
            </p>

          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-right">

            <p className="text-[7px] tracking-[0.18em] text-zinc-600">
              ACTIVE SEASON
            </p>

            <p className="mt-1 text-sm font-black text-orange-400">
              {season
                ?.season_code ??
                "SEASON"}
            </p>

            <p className="mt-1 text-[7px] font-black text-zinc-500">
              {season
                ?.season_name ??
                season
                  ?.product_name ??
                "ACTIVE DROP"}
            </p>

          </div>

        </section>

        {/* =================================================
            PLAYER OVERVIEW
        ================================================= */}

        <section className="mt-7 rounded-[28px] border border-zinc-800 bg-zinc-950/80 p-5 sm:p-6">

          <div className="flex flex-wrap items-start justify-between gap-5">

            <div>

              <p className="text-[8px] font-black tracking-[0.25em] text-cyan-400">
                PLAYER PROGRESS
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {playerName}
              </h2>

              <p className="mt-1 text-[9px] font-black text-lime-400">
                {title}
              </p>

            </div>

            <div className="rounded-full border border-lime-400/20 bg-lime-400/[0.05] px-4 py-2">

              <p className="text-[8px] font-black tracking-[0.18em] text-lime-400">
                PLAYER SYSTEM ONLINE
              </p>

            </div>

          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">

            <ProgressStat
              label="LEVEL"
              value={`LV.${String(
                level
              ).padStart(
                2,
                "0"
              )}`}
              note="PLAYER PROGRESSION"
              className="text-cyan-400"
            />

            <ProgressStat
              label="CURRENT EXP"
              value={
                exp.toLocaleString()
              }
              note="EXP"
              className="text-purple-400"
            />

            <ProgressStat
              label="GLOBAL RANK"
              value={
                globalRank
              }
              note={`OF ${totalPlayers.toLocaleString()} PLAYERS`}
              className="text-orange-400"
            />

            <ProgressStat
              label="COLLECTION SCORE"
              value={
                collectionScore.toLocaleString()
              }
              note="PTS"
              className="text-lime-400"
            />

          </div>

          <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 px-4 py-3">

            <div className="flex flex-wrap items-center justify-between gap-3">

              <div>

                <p className="text-[7px] font-black tracking-[0.18em] text-zinc-600">
                  EXP PROGRESSION
                </p>

                <p className="mt-1 text-[9px] font-black text-white">
                  LEVEL RULE SYSTEM
                </p>

              </div>

              <span className="rounded-full border border-yellow-400/20 bg-yellow-400/[0.05] px-3 py-1.5 text-[7px] font-black text-yellow-400">
                FOUNDATION READY
              </span>

            </div>

            <p className="mt-2 text-[8px] leading-5 text-zinc-600">
              EXP CURVE AND LEVEL-UP RULES WILL BE CONNECTED TO THE CENTRAL GAME RULE SYSTEM.
            </p>

          </div>

        </section>

        {/* =================================================
            GAME SYSTEM
        ================================================= */}

        <section className="mt-5 grid gap-4 lg:grid-cols-2">

          {/* PLAY */}

          <FutureCard
            eyebrow="PLAY SYSTEM"
            title="GAMES"
            description="Mini games, season events and interactive LOOTFORM experiences will appear here."
            status="NO GAMES AVAILABLE"
            accent="cyan"
            icon="▶"
          />

          {/* MISSIONS */}

          <FutureCard
            eyebrow="PROGRESSION SYSTEM"
            title="MISSIONS"
            description="Daily, weekly, season and special missions will live here when the mission system launches."
            status="NO ACTIVE MISSIONS"
            accent="purple"
            icon="◎"
          />

          {/* REWARDS */}

          <FutureCard
            eyebrow="REWARD SYSTEM"
            title="REWARDS"
            description="Future game rewards can include EXP, LT and eligible LOOTFORM rewards controlled by the server."
            status="REWARD SYSTEM STANDBY"
            accent="lime"
            icon="◇"
          />

          {/* COMPETITION */}

          <div className="relative overflow-hidden rounded-[24px] border border-orange-400/20 bg-zinc-950/80 p-5">

            <div className="absolute right-[-80px] top-[-80px] h-[180px] w-[180px] rounded-full bg-orange-400/[0.08] blur-[60px]" />

            <div className="relative z-10">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <p className="text-[8px] font-black tracking-[0.24em] text-orange-400">
                    COMPETITION SYSTEM
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    LEADERBOARD
                  </h2>

                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-400/[0.05] text-lg font-black text-orange-400">
                  #
                </div>

              </div>

              <div className="mt-5 grid grid-cols-2 gap-2.5">

                <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">

                  <p className="text-[7px] tracking-[0.16em] text-zinc-600">
                    YOUR RANK
                  </p>

                  <p className="mt-2 text-3xl font-black text-orange-400">
                    {globalRank}
                  </p>

                </div>

                <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">

                  <p className="text-[7px] tracking-[0.16em] text-zinc-600">
                    SCORE
                  </p>

                  <p className="mt-2 text-2xl font-black text-lime-400">
                    {collectionScore.toLocaleString()}
                  </p>

                  <p className="mt-1 text-[7px] font-black text-zinc-600">
                    PTS
                  </p>

                </div>

              </div>

              <div className="mt-3 rounded-xl border border-zinc-800 bg-black/30 px-4 py-3">

                <p className="text-[8px] leading-5 text-zinc-500">
                  GLOBAL RANK IS ALREADY CALCULATED FROM CURRENT ITEM OWNERSHIP AND GRADE SCORE.
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            SYSTEM ROADMAP
        ================================================= */}

        <section className="mt-5 rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">

          <div>

            <p className="text-[8px] font-black tracking-[0.25em] text-zinc-600">
              GAME SYSTEM FOUNDATION
            </p>

            <h2 className="mt-2 text-xl font-black">
              READY FOR FUTURE GROWTH
            </h2>

          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">

            <SystemNode
              number="01"
              title="PLAY"
              status="STANDBY"
            />

            <SystemNode
              number="02"
              title="MISSIONS"
              status="STANDBY"
            />

            <SystemNode
              number="03"
              title="EXP"
              status="PROFILE READY"
            />

            <SystemNode
              number="04"
              title="REWARDS"
              status="STANDBY"
            />

            <SystemNode
              number="05"
              title="RANK"
              status="LIVE"
            />

          </div>

        </section>

        <p className="mt-8 text-center text-[8px] font-black tracking-[0.4em] text-zinc-800">
          LOOTFORM // DIGITAL LOOT. PHYSICAL FORM.
        </p>

      </div>

    </main>
  );
}

// =========================================================
// PROGRESS STAT
// =========================================================

function ProgressStat({
  label,
  value,
  note,
  className,
}: {
  label: string;
  value: string;
  note: string;
  className: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">

      <p className="text-[7px] font-black tracking-[0.18em] text-zinc-600">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-black ${className}`}
      >
        {value}
      </p>

      <p className="mt-1 text-[7px] font-black text-zinc-700">
        {note}
      </p>

    </div>
  );
}

// =========================================================
// FUTURE CARD
// =========================================================

function FutureCard({
  eyebrow,
  title,
  description,
  status,
  accent,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  accent:
    | "cyan"
    | "purple"
    | "lime";
  icon: string;
}) {
  const styles = {
    cyan: {
      border:
        "border-cyan-400/20",

      bg:
        "bg-cyan-400/[0.03]",

      text:
        "text-cyan-400",
    },

    purple: {
      border:
        "border-purple-400/20",

      bg:
        "bg-purple-400/[0.03]",

      text:
        "text-purple-400",
    },

    lime: {
      border:
        "border-lime-400/20",

      bg:
        "bg-lime-400/[0.03]",

      text:
        "text-lime-400",
    },
  };

  const theme =
    styles[
      accent
    ];

  return (
    <div
      className={`
        relative
        min-h-[245px]
        overflow-hidden
        rounded-[24px]
        border
        bg-zinc-950/80
        p-5
        ${theme.border}
      `}
    >

      <div
        className={`
          absolute
          right-[-70px]
          top-[-70px]
          h-[170px]
          w-[170px]
          rounded-full
          blur-[65px]
          ${theme.bg}
        `}
      />

      <div className="relative z-10 flex h-full flex-col">

        <div className="flex items-start justify-between gap-4">

          <div>

            <p
              className={`text-[8px] font-black tracking-[0.24em] ${theme.text}`}
            >
              {eyebrow}
            </p>

            <h2 className="mt-2 text-2xl font-black">
              {title}
            </h2>

          </div>

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg font-black ${theme.border} ${theme.bg} ${theme.text}`}
          >
            {icon}
          </div>

        </div>

        <p className="mt-4 max-w-lg text-[9px] leading-5 text-zinc-600">
          {description}
        </p>

        <div className="mt-auto pt-5">

          <div className="rounded-xl border border-zinc-800 bg-black/40 px-4 py-3">

            <div className="flex items-center gap-2">

              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />

              <p className="text-[7px] font-black tracking-[0.16em] text-zinc-500">
                {status}
              </p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

// =========================================================
// SYSTEM NODE
// =========================================================

function SystemNode({
  number,
  title,
  status,
}: {
  number: string;
  title: string;
  status: string;
}) {
  const live =
    status ===
    "LIVE";

  return (
    <div className="rounded-xl border border-zinc-800 bg-black/35 p-3">

      <div className="flex items-center justify-between gap-2">

        <p className="font-mono text-[7px] font-black text-zinc-700">
          {number}
        </p>

        <span
          className={
            live
              ? "h-1.5 w-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]"
              : "h-1.5 w-1.5 rounded-full bg-zinc-700"
          }
        />

      </div>

      <p className="mt-3 text-[10px] font-black text-white">
        {title}
      </p>

      <p
        className={
          live
            ? "mt-1 text-[6px] font-black text-lime-400"
            : "mt-1 text-[6px] font-black text-zinc-600"
        }
      >
        {status}
      </p>

    </div>
  );
}