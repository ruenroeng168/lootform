"use client";

import Image from "next/image";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase";

import Navbar from "@/components/Navbar";

// =====================================
// TYPES
// =====================================

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type CraftPhase =
  | "IDLE"
  | "INITIALIZING"
  | "ROLLING"
  | "LOCKING"
  | "REVEAL";

type SeasonSettings = {
  id: number;

  season_code: string;
  season_name: string;

  product_name: string;

  craft_cost: number;

  common_rate: number;
  rare_rate: number;
  epic_rate: number;
  legendary_rate: number;

  is_active: boolean;

  updated_at: string;
};

type CraftedItem = {
  id: number;

  serial: string;

  product: string;
  season: string;

  grade: Grade;

  level: number;

  size: string | null;

  production_status: string;

  created_at: string;
};

// =====================================
// CONFIG
// =====================================

const sizes = [
  "S",
  "M",
  "L",
  "XL",
  "XXL",
];

const grades: Grade[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

const productImages: Record<
  Grade,
  string
> = {
  COMMON:
    "/products/common.png",

  RARE:
    "/products/rare.png",

  EPIC:
    "/products/epic.png",

  LEGENDARY:
    "/products/legendary.png",
};

// =====================================
// GRADE STYLE
// =====================================

const gradeText: Record<
  Grade,
  string
> = {
  COMMON:
    "text-zinc-200",

  RARE:
    "text-cyan-400",

  EPIC:
    "text-purple-400",

  LEGENDARY:
    "text-orange-400",
};

const gradeBorder: Record<
  Grade,
  string
> = {
  COMMON:
    "border-zinc-700",

  RARE:
    "border-cyan-400/50",

  EPIC:
    "border-purple-400/50",

  LEGENDARY:
    "border-orange-400/50",
};

const gradeGlow: Record<
  Grade,
  string
> = {
  COMMON:
    "shadow-[0_0_70px_rgba(161,161,170,0.12)]",

  RARE:
    "shadow-[0_0_90px_rgba(34,211,238,0.22)]",

  EPIC:
    "shadow-[0_0_100px_rgba(192,132,252,0.26)]",

  LEGENDARY:
    "shadow-[0_0_120px_rgba(251,146,60,0.32)]",
};

const gradeBg: Record<
  Grade,
  string
> = {
  COMMON:
    "from-zinc-500/10",

  RARE:
    "from-cyan-400/10",

  EPIC:
    "from-purple-400/10",

  LEGENDARY:
    "from-orange-400/15",
};

// =====================================
// PAGE
// =====================================

export default function CraftPage() {
  const router =
    useRouter();

  // =====================================
  // BASE STATE
  // =====================================

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    crafting,
    setCrafting,
  ] = useState(false);

  const [
    walletBalance,
    setWalletBalance,
  ] = useState(0);

  const [
    season,
    setSeason,
  ] =
    useState<
      SeasonSettings | null
    >(null);

  const [
    selectedSize,
    setSelectedSize,
  ] =
    useState("S");

  const [
    previewGrade,
    setPreviewGrade,
  ] =
    useState<Grade>(
      "COMMON"
    );

  const [
    rouletteGrade,
    setRouletteGrade,
  ] =
    useState<Grade>(
      "COMMON"
    );

  const [
    craftResult,
    setCraftResult,
  ] =
    useState<
      CraftedItem | null
    >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  // =====================================
  // ANIMATION STATE
  // =====================================

  const [
    phase,
    setPhase,
  ] =
    useState<CraftPhase>(
      "IDLE"
    );

  const [
    holdProgress,
    setHoldProgress,
  ] =
    useState(0);

  const [
    energyProgress,
    setEnergyProgress,
  ] =
    useState(0);

  const [
    revealPulse,
    setRevealPulse,
  ] =
    useState(false);

  const [
    screenFlash,
    setScreenFlash,
  ] =
    useState(false);

  // =====================================
  // HOLD REFERENCES
  // =====================================

  const holdIntervalRef =
    useRef<
      ReturnType<
        typeof setInterval
      > | null
    >(null);

  const holdStartedAtRef =
    useRef<
      number | null
    >(null);

  const holdTriggeredRef =
    useRef(false);

  const resultRef =
    useRef<HTMLElement | null>(
      null
    );

  // =====================================
  // LOAD PAGE
  // =====================================

  async function loadPage() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        router.push(
          "/login"
        );

        return;
      }

      // =====================================
      // WALLET
      // =====================================

      const {
        data:
          wallet,
        error:
          walletError,
      } =
        await supabase
          .from(
            "wallets"
          )
          .select(
            "balance"
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (
        walletError
      ) {
        console.error(
          "CRAFT WALLET LOAD ERROR:",
          walletError
        );
      }

      setWalletBalance(
        Number(
          wallet?.balance ??
            0
        )
      );

      // =====================================
      // PUBLIC SEASON
      // =====================================

      const response =
        await fetch(
          "/api/season",
          {
            cache:
              "no-store",
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.message ||
            "Unable to load Season"
        );
      }

      setSeason(
        result.season
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "Unable to load Craft"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  // =====================================
  // ODDS
  // =====================================

  const odds =
    useMemo(() => {
      return {
        COMMON:
          season?.common_rate ??
          0,

        RARE:
          season?.rare_rate ??
          0,

        EPIC:
          season?.epic_rate ??
          0,

        LEGENDARY:
          season?.legendary_rate ??
          0,
      };
    }, [season]);

  // =====================================
  // ACTIVE DISPLAY GRADE
  // =====================================

  const displayGrade =
    phase ===
      "ROLLING" ||
    phase ===
      "LOCKING"
      ? rouletteGrade
      : craftResult
      ? craftResult.grade
      : previewGrade;

  // =====================================
  // CAN CRAFT
  // =====================================

  const canCraft =
    !!season &&
    season.is_active &&
    !crafting &&
    walletBalance >=
      season.craft_cost;

  // =====================================
  // WAIT
  // =====================================

  function wait(
    milliseconds: number
  ) {
    return new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          milliseconds
        )
    );
  }

  // =====================================
  // ROULETTE ANIMATION
  //
  // IMPORTANT:
  // UI animation does NOT decide result.
  // Final Grade comes from backend.
  // =====================================

  async function runRoulette(
    finalGrade: Grade
  ) {
    setPhase(
      "ROLLING"
    );

    setEnergyProgress(
      10
    );

    let index = 0;

    // FAST SPIN
    for (
      let i = 0;
      i < 16;
      i += 1
    ) {
      index =
        (index + 1) %
        grades.length;

      setRouletteGrade(
        grades[index]
      );

      setEnergyProgress(
        Math.min(
          62,
          10 + i * 3
        )
      );

      await wait(
        80
      );
    }

    // MEDIUM SPIN
    for (
      let i = 0;
      i < 8;
      i += 1
    ) {
      index =
        (index + 1) %
        grades.length;

      setRouletteGrade(
        grades[index]
      );

      setEnergyProgress(
        Math.min(
          82,
          62 + i * 2
        )
      );

      await wait(
        130 +
          i * 12
      );
    }

    setPhase(
      "LOCKING"
    );

    // SLOW DOWN
    for (
      let i = 0;
      i < 6;
      i += 1
    ) {
      index =
        (index + 1) %
        grades.length;

      setRouletteGrade(
        grades[index]
      );

      setEnergyProgress(
        Math.min(
          96,
          82 + i * 2
        )
      );

      await wait(
        220 +
          i * 80
      );
    }

    // =====================================
    // LOCK FINAL BACKEND RESULT
    // =====================================

    setRouletteGrade(
      finalGrade
    );

    setEnergyProgress(
      100
    );

    await wait(
      500
    );

    // =====================================
    // FLASH
    // =====================================

    setScreenFlash(
      true
    );

    await wait(
      120
    );

    setScreenFlash(
      false
    );

    setRevealPulse(
      true
    );

    setPhase(
      "REVEAL"
    );

    await wait(
      1800
    );

    setRevealPulse(
      false
    );
  }

  // =====================================
  // CRAFT
  // =====================================

  async function craftItem() {
    if (
      !season ||
      crafting
    ) {
      return;
    }

    setCrafting(
      true
    );

    setCraftResult(
      null
    );

    setErrorMessage(
      ""
    );

    setEnergyProgress(
      0
    );

    setPhase(
      "INITIALIZING"
    );

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push(
          "/login"
        );

        return;
      }

      // =====================================
      // INITIALIZING EFFECT
      // =====================================

      await wait(
        500
      );

      // =====================================
      // CALL REAL BACKEND
      // =====================================

      const response =
        await fetch(
          "/api/craft",
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
                size:
                  selectedSize,
              }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          result.message ||
            "Craft failed"
        );
      }

      const finalItem =
        result.item as CraftedItem;

      // =====================================
      // PREPARE REAL RESULT
      //
      // Backend still decides the result.
      // We store it before the REVEAL phase
      // so the cinematic overlay can show it.
      // =====================================

      setCraftResult(
        finalItem
      );

      // =====================================
      // VISUAL ROULETTE
      // =====================================

      await runRoulette(
        finalItem.grade
      );

      // =====================================
      // FINAL UI
      // =====================================

      setPreviewGrade(
        finalItem.grade
      );

      setWalletBalance(
        Number(
          result.wallet
            ?.balance ??
            walletBalance -
              season.craft_cost
        )
      );

      window.setTimeout(
        () => {
          resultRef.current?.scrollIntoView({
            behavior:
              "smooth",
            block:
              "start",
          });
        },
        80
      );
    } catch (
      error
    ) {
      console.error(
        "CRAFT ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "Craft failed"
      );

      setPhase(
        "IDLE"
      );

      setEnergyProgress(
        0
      );
    } finally {
      setCrafting(
        false
      );

      setHoldProgress(
        0
      );
    }
  }

  // =====================================
  // HOLD TO CRAFT
  // =====================================

  function startHold() {
    if (!canCraft) {
      return;
    }

    holdTriggeredRef.current =
      false;

    holdStartedAtRef.current =
      Date.now();

    setHoldProgress(
      0
    );

    holdIntervalRef.current =
      setInterval(
        () => {
          if (
            holdStartedAtRef.current ===
            null
          ) {
            return;
          }

          const elapsed =
            Date.now() -
            holdStartedAtRef.current;

          const progress =
            Math.min(
              100,
              (elapsed /
                1200) *
                100
            );

          setHoldProgress(
            progress
          );

          if (
            progress >=
              100 &&
            !holdTriggeredRef.current
          ) {
            holdTriggeredRef.current =
              true;

            stopHold(
              false
            );

            craftItem();
          }
        },
        20
      );
  }

  function stopHold(
    reset = true
  ) {
    if (
      holdIntervalRef.current
    ) {
      clearInterval(
        holdIntervalRef.current
      );

      holdIntervalRef.current =
        null;
    }

    holdStartedAtRef.current =
      null;

    if (
      reset &&
      !holdTriggeredRef.current
    ) {
      setHoldProgress(
        0
      );
    }
  }

  // =====================================
  // RESET RESULT
  // =====================================

  function craftAgain() {
    setCraftResult(
      null
    );

    setPhase(
      "IDLE"
    );

    setEnergyProgress(
      0
    );

    setPreviewGrade(
      "COMMON"
    );
  }

  // =====================================
  // LOADING
  // =====================================

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex flex-col items-center justify-center">

          <div className="w-16 h-16 border-2 border-zinc-800 border-t-cyan-400 rounded-full animate-spin" />

          <p className="text-cyan-400 tracking-[0.35em] mt-6 animate-pulse">
            LOADING CRAFT SYSTEM...
          </p>

        </div>

      </main>
    );
  }

  // =====================================
  // PAGE
  // =====================================

  return (
    <main
      className={`
        min-h-screen
        bg-black
        text-white
        relative
        overflow-hidden

        ${
          phase ===
            "REVEAL" &&
          craftResult?.grade ===
            "LEGENDARY"
            ? "legendary-screen-shake"
            : ""
        }
      `}
    >

      <Navbar />

      {/* =====================================
          BACKGROUND FX
      ===================================== */}

      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        <div className="absolute top-[-300px] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full bg-cyan-400/[0.06] blur-[180px]" />

        <div className="absolute bottom-[-350px] left-[-250px] w-[700px] h-[700px] rounded-full bg-purple-500/[0.07] blur-[180px]" />

        <div className="absolute bottom-[-350px] right-[-250px] w-[700px] h-[700px] rounded-full bg-orange-400/[0.05] blur-[180px]" />

      </div>

      {/* =====================================
          FLASH
      ===================================== */}

      {screenFlash && (
        <div className="fixed inset-0 z-[100] bg-white pointer-events-none animate-craft-flash" />
      )}

      {/* =====================================
          CINEMATIC CRAFT REVEAL
      ===================================== */}

      {revealPulse &&
        craftResult && (
        <div className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center overflow-hidden bg-black/88 backdrop-blur-sm craft-cinematic-overlay">

          <div
            className={`
              absolute
              w-[720px]
              h-[720px]
              rounded-full
              blur-[130px]
              craft-cinematic-glow

              ${
                craftResult.grade ===
                "COMMON"
                  ? "bg-zinc-400/20"
                  : craftResult.grade ===
                    "RARE"
                  ? "bg-cyan-400/25"
                  : craftResult.grade ===
                    "EPIC"
                  ? "bg-purple-400/30"
                  : "bg-orange-400/35"
              }
            `}
          />

          <div className="absolute inset-0 craft-cinematic-rays opacity-60" />
          <div className="absolute inset-0 craft-cinematic-grid opacity-[0.08]" />

          <div className="absolute inset-0">
            {Array.from({
              length: 22,
            }).map(
              (_, index) => (
                <span
                  key={
                    index
                  }
                  className="craft-particle"
                  style={{
                    left:
                      `${8 + ((index * 37) % 84)}%`,
                    top:
                      `${12 + ((index * 53) % 74)}%`,
                    animationDelay:
                      `${(index % 7) * 0.08}s`,
                  }}
                />
              )
            )}
          </div>

          <div className="relative z-10 w-full max-w-[960px] px-6 text-center craft-cinematic-content">

            <p
              className={`
                text-[10px]
                sm:text-xs
                font-black
                tracking-[0.55em]

                ${
                  gradeText[
                    craftResult.grade
                  ]
                }
              `}
            >
              CRAFT COMPLETE
            </p>

            <h2
              className={`
                text-6xl
                sm:text-8xl
                lg:text-9xl
                leading-none
                font-black
                mt-3
                craft-grade-slam

                ${
                  gradeText[
                    craftResult.grade
                  ]
                }
              `}
            >
              {craftResult.grade}
            </h2>

            <div className="relative h-[360px] sm:h-[440px] mt-2 flex items-center justify-center">

              <div className="absolute w-[330px] sm:w-[410px] h-[330px] sm:h-[410px] rounded-full border border-white/10 craft-ring-one" />
              <div className="absolute w-[260px] sm:w-[330px] h-[260px] sm:h-[330px] rounded-full border border-dashed border-white/20 craft-ring-two" />

              <Image
                src={
                  productImages[
                    craftResult.grade
                  ]
                }
                alt={
                  craftResult.grade
                }
                width={760}
                height={820}
                priority
                className="relative z-10 w-full h-full object-contain craft-cinematic-item"
              />

            </div>

            <p className="text-white text-xl sm:text-3xl font-black">
              {craftResult.product}
            </p>

            <p className="text-cyan-400 font-mono text-sm sm:text-lg font-black mt-2 tracking-[0.12em]">
              {craftResult.serial}
            </p>

          </div>

        </div>
      )}

      {/* =====================================
          LEGENDARY OVERLAY
      ===================================== */}

      {phase ===
        "REVEAL" &&
        craftResult?.grade ===
          "LEGENDARY" && (
        <div className="fixed inset-0 z-40 pointer-events-none">

          <div className="absolute inset-0 bg-orange-400/[0.04]" />

          <div className="absolute inset-0 legendary-rays opacity-50" />

        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

        {/* =====================================
            TOP INFO
        ===================================== */}

        {errorMessage && (
          <div className="border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5 mb-6">
            {errorMessage}
          </div>
        )}

        {season && (
          <>

            <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">

              <Stat
                label="ACTIVE SEASON"
                value={
                  season.season_code
                }
                className="text-cyan-400"
              />

              <Stat
                label="PRODUCT"
                value={
                  season.product_name
                }
                className="text-white"
              />

              <Stat
                label="CRAFT COST"
                value={`${season.craft_cost} LT`}
                className="text-lime-400"
              />

              <Stat
                label="WALLET"
                value={`${walletBalance.toLocaleString()} LT`}
                className="text-lime-400"
              />

            </section>

            {/* =====================================
                MAIN CRAFT AREA
            ===================================== */}

            <section className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6 mt-6">

              {/* =====================================
                  CRAFT CHAMBER
              ===================================== */}

              <div
                className={`
                  relative
                  overflow-hidden
                  border
                  rounded-[30px]
                  bg-zinc-950/80
                  min-h-[690px]
                  p-6
                  sm:p-8

                  ${gradeBorder[displayGrade]}
                  ${gradeGlow[displayGrade]}
                `}
              >

                {/* GRADE BACKGROUND */}

                <div
                  className={`
                    absolute
                    inset-0
                    bg-gradient-to-b
                    ${gradeBg[displayGrade]}
                    via-transparent
                    to-black
                    pointer-events-none
                  `}
                />

                {/* GRID */}

                <div className="absolute inset-0 craft-grid opacity-[0.06] pointer-events-none" />

                {/* SCANNER */}

                {(phase ===
                  "ROLLING" ||
                  phase ===
                    "LOCKING") && (
                  <div className="absolute inset-x-0 top-0 h-[3px] bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.9)] craft-scanner pointer-events-none" />
                )}

                <div className="relative z-10">

                  {/* HEADER */}

                  <div className="flex items-start justify-between gap-5">

                    <div>

                      <p className="text-cyan-400 text-[9px] tracking-[0.3em]">
                        CRAFT CHAMBER
                      </p>

                      <h1 className="text-3xl sm:text-4xl font-black mt-2">
                        {
                          season.product_name
                        }
                      </h1>

                      <p className="text-zinc-600 text-[9px] tracking-[0.25em] mt-2">
                        {
                          season.season_name
                        }
                      </p>

                    </div>

                    <div className="text-right">

                      <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                        TARGET
                      </p>

                      <p
                        className={`
                          text-sm
                          font-black
                          mt-2
                          ${gradeText[displayGrade]}
                        `}
                      >
                        {
                          displayGrade
                        }
                      </p>

                    </div>

                  </div>

                  {/* =====================================
                      PRODUCT CHAMBER
                  ===================================== */}

                  <div className="relative h-[480px] flex items-center justify-center mt-3">

                    {/* OUTER RING */}

                    <div
                      className={`
                        absolute
                        w-[390px]
                        h-[390px]
                        rounded-full
                        border
                        border-dashed
                        border-zinc-700/40

                        ${
                          crafting
                            ? "animate-[spin_8s_linear_infinite]"
                            : ""
                        }
                      `}
                    />

                    {/* MIDDLE RING */}

                    <div
                      className={`
                        absolute
                        w-[330px]
                        h-[330px]
                        rounded-full
                        border
                        border-cyan-400/15

                        ${
                          crafting
                            ? "animate-[spin_4s_linear_infinite_reverse]"
                            : ""
                        }
                      `}
                    />

                    {/* INNER GLOW */}

                    <div
                      className={`
                        absolute
                        w-[250px]
                        h-[250px]
                        rounded-full
                        blur-[60px]

                        ${
                          displayGrade ===
                          "COMMON"
                            ? "bg-zinc-400/10"
                            : displayGrade ===
                              "RARE"
                            ? "bg-cyan-400/15"
                            : displayGrade ===
                              "EPIC"
                            ? "bg-purple-400/20"
                            : "bg-orange-400/25"
                        }
                      `}
                    />

                    {/* PRODUCT */}

                    <div
                      className={`
                        relative
                        z-10
                        w-full
                        h-full
                        flex
                        items-center
                        justify-center

                        ${
                          phase ===
                            "ROLLING"
                            ? "craft-item-pulse"
                            : ""
                        }

                        ${
                          revealPulse
                            ? "craft-reveal"
                            : ""
                        }
                      `}
                    >

                      <Image
                        src={
                          productImages[
                            displayGrade
                          ]
                        }
                        alt={
                          displayGrade
                        }
                        width={900}
                        height={1000}
                        priority
                        className="w-full h-full object-contain drop-shadow-[0_25px_45px_rgba(0,0,0,0.85)]"
                      />

                    </div>

                    {/* =====================================
                        PHASE TEXT
                    ===================================== */}

                    {crafting && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">

                        <div className="border border-zinc-700 bg-black/80 backdrop-blur-xl rounded-full px-5 py-2">

                          <p className="text-[9px] tracking-[0.3em] font-black animate-pulse">

                            {phase ===
                              "INITIALIZING" && (
                              <span className="text-cyan-400">
                                INITIALIZING CRAFT CORE
                              </span>
                            )}

                            {phase ===
                              "ROLLING" && (
                              <span
                                className={
                                  gradeText[
                                    rouletteGrade
                                  ]
                                }
                              >
                                ROLLING RARITY //{" "}
                                {
                                  rouletteGrade
                                }
                              </span>
                            )}

                            {phase ===
                              "LOCKING" && (
                              <span className="text-orange-400">
                                LOCKING GRADE //{" "}
                                {
                                  rouletteGrade
                                }
                              </span>
                            )}

                          </p>

                        </div>

                      </div>
                    )}

                  </div>

                  {/* =====================================
                      ENERGY
                  ===================================== */}

                  <div className="mt-3">

                    <div className="flex items-center justify-between">

                      <p className="text-zinc-600 text-[8px] tracking-[0.25em]">
                        CRAFT ENERGY
                      </p>

                      <p className="text-cyan-400 text-xs font-black">
                        {Math.round(
                          energyProgress
                        )}
                        %
                      </p>

                    </div>

                    <div className="relative h-2 bg-zinc-900 rounded-full overflow-hidden mt-3">

                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-purple-400 to-orange-400 transition-all duration-200"
                        style={{
                          width:
                            `${energyProgress}%`,
                        }}
                      />

                    </div>

                  </div>

                </div>

              </div>

              {/* =====================================
                  CONTROL PANEL
              ===================================== */}

              <div className="space-y-5">

                {/* =====================================
                    SIDE RESULT
                ===================================== */}

                {craftResult &&
                  phase ===
                    "REVEAL" && (
                    <section
                      ref={
                        resultRef
                      }
                      className={`
                        relative
                        overflow-hidden
                        border
                        rounded-[28px]
                        bg-zinc-950/95
                        p-5
                        sm:p-6
                        craft-result-enter
                        scroll-mt-24

                        ${
                          gradeBorder[
                            craftResult
                              .grade
                          ]
                        }

                        ${
                          gradeGlow[
                            craftResult
                              .grade
                          ]
                        }
                      `}
                    >

                      <div
                        className={`
                          absolute
                          inset-0
                          bg-gradient-to-br
                          ${
                            gradeBg[
                              craftResult
                                .grade
                            ]
                          }
                          via-transparent
                          to-black
                          pointer-events-none
                        `}
                      />

                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute -top-24 -right-20 w-64 h-64 rounded-full bg-white/[0.035] blur-[70px] craft-result-aura" />
                        <div className="absolute inset-0 craft-result-grid opacity-[0.05]" />
                      </div>

                      <div className="relative z-10">

                        <div className="flex items-start justify-between gap-4">

                          <div>

                            <p
                              className={`
                                text-[9px]
                                font-black
                                tracking-[0.3em]
                                ${
                                  gradeText[
                                    craftResult
                                      .grade
                                  ]
                                }
                              `}
                            >
                              CRAFT COMPLETE
                            </p>

                            <h2
                              className={`
                                text-5xl
                                sm:text-6xl
                                leading-none
                                font-black
                                mt-2
                                ${
                                  gradeText[
                                    craftResult
                                      .grade
                                  ]
                                }
                              `}
                            >
                              {craftResult.grade}
                            </h2>

                          </div>

                          <div className="text-right">

                            <p className="text-zinc-600 text-[8px] tracking-[0.18em]">
                              ITEM ID
                            </p>

                            <p className="text-cyan-400 font-mono text-xs font-black mt-2">
                              {craftResult.serial}
                            </p>

                          </div>

                        </div>

                        <div className="relative h-[260px] mt-3 flex items-center justify-center">

                          <div className="absolute w-[210px] h-[210px] rounded-full border border-dashed border-zinc-700/40" />

                          <div className="absolute w-[160px] h-[160px] rounded-full border border-cyan-400/10" />

                          <div
                            className={`
                              absolute
                              w-[145px]
                              h-[145px]
                              rounded-full
                              blur-[45px]

                              ${
                                craftResult.grade ===
                                "COMMON"
                                  ? "bg-zinc-400/10"
                                  : craftResult.grade ===
                                    "RARE"
                                  ? "bg-cyan-400/15"
                                  : craftResult.grade ===
                                    "EPIC"
                                  ? "bg-purple-400/20"
                                  : "bg-orange-400/25"
                              }
                            `}
                          />

                          <Image
                            src={
                              productImages[
                                craftResult
                                  .grade
                              ]
                            }
                            alt={
                              craftResult
                                .grade
                            }
                            width={500}
                            height={580}
                            className="relative z-10 w-full h-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)]"
                          />

                        </div>

                        <div>

                          <p className="text-white text-xl font-black">
                            {craftResult.product}
                          </p>

                          <div className="grid grid-cols-3 gap-2 mt-4">

                            <ResultInfo
                              label="SIZE"
                              value={
                                craftResult.size ??
                                "-"
                              }
                            />

                            <ResultInfo
                              label="LEVEL"
                              value={`LVL ${String(
                                craftResult.level
                              ).padStart(
                                2,
                                "0"
                              )}`}
                            />

                            <ResultInfo
                              label="SEASON"
                              value={
                                craftResult.season
                              }
                            />

                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-4">

                            <button
                              onClick={
                                craftAgain
                              }
                              className="bg-lime-400 text-black py-3.5 px-4 rounded-xl text-xs font-black hover:bg-lime-300 transition"
                            >
                              CRAFT AGAIN
                            </button>

                            <button
                              onClick={() =>
                                router.push(
                                  "/collection"
                                )
                              }
                              className="border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 py-3.5 px-4 rounded-xl text-xs font-black hover:bg-cyan-400/10 transition"
                            >
                              VIEW COLLECTION
                            </button>

                          </div>

                        </div>

                      </div>

                    </section>
                  )}


                {/* ODDS */}

                <section className="border border-zinc-800 bg-zinc-950/80 rounded-[28px] p-6">

                  <div className="flex items-end justify-between gap-4">

                    <div>

                      <p className="text-purple-400 text-[9px] tracking-[0.3em]">
                        RANDOM ENGINE
                      </p>

                      <h2 className="text-2xl font-black mt-2">
                        RARITY MATRIX
                      </h2>

                    </div>

                    <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                      100%
                    </p>

                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5">

                    {grades.map(
                      (
                        grade
                      ) => (
                        <button
                          key={
                            grade
                          }
                          disabled={
                            crafting
                          }
                          onClick={() =>
                            setPreviewGrade(
                              grade
                            )
                          }
                          className={`
                            relative
                            overflow-hidden
                            border
                            rounded-2xl
                            p-4
                            text-left
                            transition

                            ${
                              gradeBorder[
                                grade
                              ]
                            }

                            ${
                              displayGrade ===
                              grade
                                ? "bg-white/[0.04]"
                                : "bg-black/30"
                            }

                            ${
                              crafting
                                ? "cursor-default"
                                : "hover:bg-white/[0.04]"
                            }
                          `}
                        >

                          {displayGrade ===
                            grade && (
                            <div className="absolute inset-x-0 bottom-0 h-[2px] bg-current opacity-70" />
                          )}

                          <p
                            className={`
                              text-[9px]
                              font-black
                              tracking-[0.18em]
                              ${
                                gradeText[
                                  grade
                                ]
                              }
                            `}
                          >
                            {
                              grade
                            }
                          </p>

                          <p
                            className={`
                              text-3xl
                              font-black
                              mt-2
                              ${
                                gradeText[
                                  grade
                                ]
                              }
                            `}
                          >
                            {
                              odds[
                                grade
                              ]
                            }
                            %
                          </p>

                        </button>
                      )
                    )}

                  </div>

                </section>

                {/* SIZE */}

                <section className="border border-zinc-800 bg-zinc-950/80 rounded-[28px] p-6">

                  <p className="text-cyan-400 text-[9px] tracking-[0.3em]">
                    PHYSICAL CONFIG
                  </p>

                  <h2 className="text-2xl font-black mt-2">
                    SELECT SIZE
                  </h2>

                  <div className="grid grid-cols-5 gap-2 mt-5">

                    {sizes.map(
                      (
                        size
                      ) => (
                        <button
                          key={
                            size
                          }
                          disabled={
                            crafting
                          }
                          onClick={() =>
                            setSelectedSize(
                              size
                            )
                          }
                          className={`
                            border
                            rounded-xl
                            py-4
                            text-sm
                            font-black
                            transition

                            ${
                              selectedSize ===
                              size
                                ? "border-cyan-400 bg-cyan-400/10 text-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.08)]"
                                : "border-zinc-800 bg-black/30 text-zinc-500 hover:border-zinc-600"
                            }
                          `}
                        >
                          {
                            size
                          }
                        </button>
                      )
                    )}

                  </div>

                </section>

                {/* TERMINAL */}

                <section className="border border-lime-400/15 bg-zinc-950/80 rounded-[28px] p-6">

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <p className="text-lime-400 text-[9px] tracking-[0.3em]">
                        CRAFT TERMINAL
                      </p>

                      <h2 className="text-2xl font-black mt-2">
                        FORGE LOOT
                      </h2>

                    </div>

                    <div className="text-right">

                      <p className="text-zinc-600 text-[8px]">
                        COST
                      </p>

                      <p className="text-lime-400 text-xl font-black mt-1">
                        {
                          season.craft_cost
                        }{" "}
                        LT
                      </p>

                    </div>

                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5">

                    <MiniInfo
                      label="SIZE"
                      value={
                        selectedSize
                      }
                    />

                    <MiniInfo
                      label="BALANCE"
                      value={`${walletBalance.toLocaleString()} LT`}
                    />

                  </div>

                  {/* =====================================
                      HOLD BUTTON
                  ===================================== */}

                  <button
                    disabled={
                      !canCraft
                    }
                    onMouseDown={
                      startHold
                    }
                    onMouseUp={() =>
                      stopHold()
                    }
                    onMouseLeave={() =>
                      stopHold()
                    }
                    onTouchStart={
                      startHold
                    }
                    onTouchEnd={() =>
                      stopHold()
                    }
                    className={`
                      relative
                      overflow-hidden
                      w-full
                      min-h-[86px]
                      mt-5
                      rounded-xl
                      font-black
                      tracking-[0.05em]
                      select-none
                      transition

                      ${
                        canCraft
                          ? "bg-lime-400 text-black hover:bg-lime-300 shadow-[0_0_35px_rgba(163,230,53,0.12)]"
                          : "bg-zinc-900 text-zinc-600"
                      }
                    `}
                  >

                    {canCraft &&
                      !crafting && (
                      <div
                        className="absolute inset-y-0 left-0 bg-white/35"
                        style={{
                          width:
                            `${holdProgress}%`,
                        }}
                      />
                    )}

                    {canCraft &&
                      !crafting && (
                      <div
                        className="absolute inset-y-0 w-[80px] bg-white/20 blur-xl craft-button-scan"
                      />
                    )}

                    <span className="relative z-10">

                      {crafting
                        ? phase ===
                          "INITIALIZING"
                          ? "INITIALIZING..."
                          : phase ===
                            "ROLLING"
                          ? "ROLLING RARITY..."
                          : phase ===
                            "LOCKING"
                          ? "LOCKING GRADE..."
                          : "REVEALING..."
                        : !season.is_active
                        ? "DROP CLOSED"
                        : walletBalance <
                          season.craft_cost
                        ? "NOT ENOUGH LT"
                        : `HOLD TO CRAFT • ${season.craft_cost} LT`}

                    </span>

                  </button>

                  {!crafting &&
                    canCraft && (
                    <p className="text-center text-zinc-700 text-[8px] tracking-[0.22em] mt-3">
                      HOLD 1.2 SEC TO INITIATE
                    </p>
                  )}

                </section>


              </div>

            </section>

          </>
        )}

      </div>

      {/* =====================================
          CUSTOM ANIMATIONS
      ===================================== */}

      <style jsx global>{`

        @keyframes craftScanner {
          0% {
            transform: translateY(0);
            opacity: 0;
          }

          10% {
            opacity: 1;
          }

          90% {
            opacity: 1;
          }

          100% {
            transform: translateY(690px);
            opacity: 0;
          }
        }

        .craft-scanner {
          animation:
            craftScanner
            1.25s
            linear
            infinite;
        }

        @keyframes craftItemPulse {
          0% {
            transform:
              scale(0.96);
            filter:
              brightness(0.8);
          }

          50% {
            transform:
              scale(1.035);
            filter:
              brightness(1.35);
          }

          100% {
            transform:
              scale(0.96);
            filter:
              brightness(0.8);
          }
        }

        .craft-item-pulse {
          animation:
            craftItemPulse
            0.32s
            ease-in-out
            infinite;
        }

        @keyframes craftReveal {
          0% {
            transform:
              scale(0.65);
            opacity: 0;
            filter:
              brightness(4)
              blur(14px);
          }

          45% {
            transform:
              scale(1.12);
            opacity: 1;
            filter:
              brightness(2)
              blur(2px);
          }

          100% {
            transform:
              scale(1);
            opacity: 1;
            filter:
              brightness(1)
              blur(0);
          }
        }

        .craft-reveal {
          animation:
            craftReveal
            0.75s
            cubic-bezier(
              0.16,
              1,
              0.3,
              1
            );
        }

        @keyframes craftResultEnter {
          0% {
            opacity: 0;
            transform:
              translateY(35px)
              scale(0.88);
          }

          100% {
            opacity: 1;
            transform:
              translateY(0)
              scale(1);
          }
        }

        .craft-result-enter {
          animation:
            craftResultEnter
            0.7s
            cubic-bezier(
              0.16,
              1,
              0.3,
              1
            );
        }

        @keyframes craftFlash {
          0% {
            opacity: 0;
          }

          20% {
            opacity: 0.95;
          }

          100% {
            opacity: 0;
          }
        }

        .animate-craft-flash {
          animation:
            craftFlash
            0.22s
            ease-out
            forwards;
        }

        @keyframes buttonScan {
          0% {
            left: -100px;
          }

          100% {
            left: calc(
              100% + 100px
            );
          }
        }

        .craft-button-scan {
          animation:
            buttonScan
            2s
            linear
            infinite;
        }

        @keyframes legendaryShake {
          0% {
            transform:
              translate(0);
          }

          20% {
            transform:
              translate(-4px, 2px);
          }

          40% {
            transform:
              translate(4px, -2px);
          }

          60% {
            transform:
              translate(-3px, 1px);
          }

          80% {
            transform:
              translate(3px, -1px);
          }

          100% {
            transform:
              translate(0);
          }
        }

        .legendary-screen-shake {
          animation:
            legendaryShake
            0.32s
            linear
            2;
        }

        .legendary-rays {
          background:
            repeating-conic-gradient(
              from 0deg,
              rgba(
                251,
                146,
                60,
                0.10
              )
              0deg,
              transparent
              8deg,
              transparent
              18deg
            );

          animation:
            legendaryRotate
            9s
            linear
            infinite;
        }

        @keyframes legendaryRotate {
          from {
            transform:
              rotate(0deg)
              scale(1.4);
          }

          to {
            transform:
              rotate(360deg)
              scale(1.4);
          }
        }


        @keyframes cinematicOverlayIn {
          0% {
            opacity: 0;
          }

          100% {
            opacity: 1;
          }
        }

        .craft-cinematic-overlay {
          animation:
            cinematicOverlayIn
            0.18s
            ease-out
            forwards;
        }

        @keyframes cinematicGlow {
          0% {
            transform:
              scale(0.45);
            opacity: 0;
          }

          45% {
            transform:
              scale(1.1);
            opacity: 1;
          }

          100% {
            transform:
              scale(1);
            opacity: 0.72;
          }
        }

        .craft-cinematic-glow {
          animation:
            cinematicGlow
            1.6s
            cubic-bezier(
              0.16,
              1,
              0.3,
              1
            )
            forwards;
        }

        @keyframes cinematicContent {
          0% {
            opacity: 0;
            transform:
              scale(0.7)
              translateY(34px);
            filter:
              brightness(3)
              blur(10px);
          }

          45% {
            opacity: 1;
            transform:
              scale(1.04)
              translateY(0);
            filter:
              brightness(1.7)
              blur(0);
          }

          100% {
            opacity: 1;
            transform:
              scale(1);
            filter:
              brightness(1)
              blur(0);
          }
        }

        .craft-cinematic-content {
          animation:
            cinematicContent
            1s
            cubic-bezier(
              0.16,
              1,
              0.3,
              1
            )
            forwards;
        }

        @keyframes gradeSlam {
          0% {
            transform:
              scale(2.2);
            opacity: 0;
            letter-spacing:
              0.2em;
          }

          55% {
            transform:
              scale(0.94);
            opacity: 1;
          }

          100% {
            transform:
              scale(1);
            opacity: 1;
          }
        }

        .craft-grade-slam {
          animation:
            gradeSlam
            0.72s
            cubic-bezier(
              0.16,
              1,
              0.3,
              1
            );
        }

        @keyframes cinematicItem {
          0% {
            opacity: 0;
            transform:
              translateY(55px)
              scale(0.62)
              rotate(-2deg);
            filter:
              brightness(4)
              blur(13px);
          }

          55% {
            opacity: 1;
            transform:
              translateY(-8px)
              scale(1.07)
              rotate(1deg);
            filter:
              brightness(1.65)
              blur(0);
          }

          100% {
            opacity: 1;
            transform:
              translateY(0)
              scale(1)
              rotate(0);
            filter:
              brightness(1);
          }
        }

        .craft-cinematic-item {
          animation:
            cinematicItem
            1.15s
            cubic-bezier(
              0.16,
              1,
              0.3,
              1
            )
            forwards;

          filter:
            drop-shadow(
              0 35px 55px
              rgba(
                0,
                0,
                0,
                0.9
              )
            );
        }

        @keyframes ringOne {
          from {
            transform:
              rotate(0deg)
              scale(0.88);
            opacity: 0.25;
          }

          to {
            transform:
              rotate(360deg)
              scale(1.04);
            opacity: 0.75;
          }
        }

        .craft-ring-one {
          animation:
            ringOne
            7s
            linear
            infinite;
        }

        @keyframes ringTwo {
          from {
            transform:
              rotate(360deg)
              scale(1.02);
          }

          to {
            transform:
              rotate(0deg)
              scale(0.92);
          }
        }

        .craft-ring-two {
          animation:
            ringTwo
            4s
            linear
            infinite;
        }

        .craft-cinematic-rays {
          background:
            repeating-conic-gradient(
              from 0deg,
              rgba(
                255,
                255,
                255,
                0.12
              )
              0deg,
              transparent
              4deg,
              transparent
              15deg
            );

          animation:
            legendaryRotate
            12s
            linear
            infinite;
        }

        .craft-cinematic-grid,
        .craft-result-grid {
          background-image:
            linear-gradient(
              rgba(
                255,
                255,
                255,
                0.25
              )
              1px,
              transparent
              1px
            ),
            linear-gradient(
              90deg,
              rgba(
                255,
                255,
                255,
                0.25
              )
              1px,
              transparent
              1px
            );

          background-size:
            42px 42px;
        }

        @keyframes particleBurst {
          0% {
            transform:
              translateY(20px)
              scale(0);
            opacity: 0;
          }

          35% {
            opacity: 1;
          }

          100% {
            transform:
              translateY(-70px)
              scale(1.4);
            opacity: 0;
          }
        }

        .craft-particle {
          position:
            absolute;
          width:
            4px;
          height:
            4px;
          border-radius:
            999px;
          background:
            white;
          box-shadow:
            0 0 16px
            rgba(
              255,
              255,
              255,
              0.95
            );

          animation:
            particleBurst
            1.25s
            ease-out
            infinite;
        }

        @keyframes resultItemFloat {
          0%,
          100% {
            transform:
              translateY(0)
              scale(1);
          }

          50% {
            transform:
              translateY(-8px)
              scale(1.015);
          }
        }

        .craft-result-item-float {
          animation:
            resultItemFloat
            3.4s
            ease-in-out
            infinite;
        }

        @keyframes resultAura {
          0%,
          100% {
            transform:
              scale(0.9);
            opacity: 0.35;
          }

          50% {
            transform:
              scale(1.12);
            opacity: 0.72;
          }
        }

        .craft-result-aura {
          animation:
            resultAura
            3s
            ease-in-out
            infinite;
        }

        .craft-grid {
          background-image:
            linear-gradient(
              rgba(
                255,
                255,
                255,
                0.25
              )
              1px,
              transparent
              1px
            ),
            linear-gradient(
              90deg,
              rgba(
                255,
                255,
                255,
                0.25
              )
              1px,
              transparent
              1px
            );

          background-size:
            36px 36px;
        }

      `}</style>

    </main>
  );
}

// =====================================
// STAT
// =====================================

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/80 rounded-xl p-5">

      <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
        {label}
      </p>

      <p
        className={`
          text-lg
          font-black
          mt-2
          ${className}
        `}
      >
        {value}
      </p>

    </div>
  );
}

// =====================================
// MINI INFO
// =====================================

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-3">

      <p className="text-zinc-600 text-[7px] tracking-[0.16em]">
        {label}
      </p>

      <p className="text-white text-sm font-black mt-1">
        {value}
      </p>

    </div>
  );
}

// =====================================
// RESULT INFO
// =====================================

function ResultInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/50 rounded-xl p-4">

      <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
        {label}
      </p>

      <p className="text-white font-black mt-2">
        {value}
      </p>

    </div>
  );
}