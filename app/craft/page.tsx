"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

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

const gradeText: Record<
  Grade,
  string
> = {
  COMMON: "text-zinc-200",
  RARE: "text-cyan-400",
  EPIC: "text-purple-400",
  LEGENDARY:
    "text-orange-400",
};

const gradeBorder: Record<
  Grade,
  string
> = {
  COMMON: "border-zinc-700",
  RARE:
    "border-cyan-400/50",
  EPIC:
    "border-purple-400/50",
  LEGENDARY:
    "border-orange-400/50",
};

export default function CraftPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [crafting, setCrafting] =
    useState(false);

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
  ] = useState("S");

  const [
    previewGrade,
    setPreviewGrade,
  ] =
    useState<Grade>("COMMON");

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
  ] = useState("");

  const [
    holdProgress,
    setHoldProgress,
  ] = useState(0);

  const [
    craftStage,
    setCraftStage,
  ] = useState("");

  const holdIntervalRef =
    useRef<
      ReturnType<
        typeof setInterval
      > | null
    >(null);

  const holdStartedAtRef =
    useRef<number | null>(
      null
    );

  const holdTriggeredRef =
    useRef(false);

  async function loadPage() {
    setLoading(true);

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const {
        data: wallet,
      } = await supabase
        .from("wallets")
        .select("balance")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

      setWalletBalance(
        wallet?.balance ?? 0
      );

      const response =
        await fetch(
          "/api/season",
          {
            cache: "no-store",
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message
        );
      }

      setSeason(
        result.season
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Craft"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  const odds = useMemo(() => {
    return {
      COMMON:
        season?.common_rate ?? 0,

      RARE:
        season?.rare_rate ?? 0,

      EPIC:
        season?.epic_rate ?? 0,

      LEGENDARY:
        season?.legendary_rate ??
        0,
    };
  }, [season]);

  const canCraft =
    !!season &&
    season.is_active &&
    !crafting &&
    walletBalance >=
      season.craft_cost;

  async function craftItem() {
    if (
      !season ||
      crafting
    ) {
      return;
    }

    setCrafting(true);
    setCraftResult(null);
    setErrorMessage("");
    setCraftStage(
      "INITIALIZING..."
    );

    const startedAt =
      Date.now();

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setTimeout(() => {
        setCraftStage(
          "ROLLING RARITY..."
        );
      }, 700);

      setTimeout(() => {
        setCraftStage(
          "FORGING LOOT..."
        );
      }, 1700);

      const response =
        await fetch(
          "/api/craft",
          {
            method: "POST",

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

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Craft failed"
        );
      }

      const elapsed =
        Date.now() -
        startedAt;

      if (elapsed < 3500) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              3500 -
                elapsed
            )
        );
      }

      setCraftResult(
        result.item
      );

      setPreviewGrade(
        result.item.grade
      );

      setWalletBalance(
        result.wallet.balance
      );

      setCraftStage(
        "CRAFT COMPLETE"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Craft failed"
      );
    } finally {
      setCrafting(false);
      setHoldProgress(0);
    }
  }

  function startHold() {
    if (!canCraft) {
      return;
    }

    holdTriggeredRef.current =
      false;

    holdStartedAtRef.current =
      Date.now();

    holdIntervalRef.current =
      setInterval(() => {
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
            (elapsed / 1200) *
              100
          );

        setHoldProgress(
          progress
        );

        if (
          progress >= 100 &&
          !holdTriggeredRef.current
        ) {
          holdTriggeredRef.current =
            true;

          stopHold(false);

          craftItem();
        }
      }, 20);
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
      setHoldProgress(0);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">

          <p className="text-lime-400 tracking-[0.35em] animate-pulse">
            LOADING CRAFT SYSTEM...
          </p>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">

      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">

        {errorMessage && (
          <div className="border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5 mb-6">
            {errorMessage}
          </div>
        )}

        {season && (
          <>

            <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">

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
                label="DROP STATUS"
                value={
                  season.is_active
                    ? "ACTIVE"
                    : "INACTIVE"
                }
                className={
                  season.is_active
                    ? "text-lime-400"
                    : "text-red-400"
                }
              />

            </section>

            <section className="grid xl:grid-cols-2 gap-6 mt-6">

              <div
                className={`
                  border
                  rounded-[28px]
                  bg-zinc-950/75
                  p-6
                  ${gradeBorder[previewGrade]}
                `}
              >

                <div className="flex justify-between">

                  <div>

                    <p className="text-zinc-600 text-[9px] tracking-[0.25em]">
                      ACTIVE DROP
                    </p>

                    <h1 className="text-3xl font-black mt-2">
                      {
                        season.product_name
                      }
                    </h1>

                  </div>

                  <p
                    className={`
                      text-xs
                      font-black
                      ${gradeText[previewGrade]}
                    `}
                  >
                    {previewGrade}
                  </p>

                </div>

                <div className="h-[470px] flex items-center justify-center mt-5">

                  <Image
                    src={
                      productImages[
                        previewGrade
                      ]
                    }
                    alt={
                      previewGrade
                    }
                    width={800}
                    height={900}
                    className="w-full h-full object-contain"
                  />

                </div>

              </div>

              <div className="space-y-5">

                <section className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6">

                  <p className="text-purple-400 text-[9px] tracking-[0.25em]">
                    RANDOM ENGINE
                  </p>

                  <h2 className="text-2xl font-black mt-2">
                    RARITY ODDS
                  </h2>

                  <div className="grid grid-cols-2 gap-3 mt-5">

                    {grades.map(
                      (grade) => (
                        <button
                          key={grade}
                          onClick={() =>
                            setPreviewGrade(
                              grade
                            )
                          }
                          className={`
                            border
                            rounded-xl
                            p-4
                            text-left
                            ${gradeBorder[grade]}
                          `}
                        >

                          <p
                            className={`
                              text-xs
                              font-black
                              ${gradeText[grade]}
                            `}
                          >
                            {grade}
                          </p>

                          <p
                            className={`
                              text-3xl
                              font-black
                              mt-2
                              ${gradeText[grade]}
                            `}
                          >
                            {odds[grade]}%
                          </p>

                        </button>
                      )
                    )}

                  </div>

                </section>

                <section className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6">

                  <p className="text-cyan-400 text-[9px] tracking-[0.25em]">
                    SELECT SIZE
                  </p>

                  <div className="grid grid-cols-5 gap-2 mt-4">

                    {sizes.map(
                      (size) => (
                        <button
                          key={size}
                          onClick={() =>
                            setSelectedSize(
                              size
                            )
                          }
                          className={`
                            border
                            rounded-xl
                            py-4
                            font-black

                            ${
                              selectedSize ===
                              size
                                ? "border-cyan-400 bg-cyan-400/10 text-cyan-400"
                                : "border-zinc-800 text-zinc-500"
                            }
                          `}
                        >
                          {size}
                        </button>
                      )
                    )}

                  </div>

                </section>

                <section className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6">

                  <div className="flex justify-between">

                    <div>

                      <p className="text-lime-400 text-[9px] tracking-[0.25em]">
                        CRAFT TERMINAL
                      </p>

                      <h2 className="text-2xl font-black mt-2">
                        FORGE ITEM
                      </h2>

                    </div>

                    <p className="text-lime-400 text-xl font-black">
                      {
                        season.craft_cost
                      }{" "}
                      LT
                    </p>

                  </div>

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
                      min-h-[80px]
                      mt-5
                      rounded-xl
                      font-black
                      text-lg

                      ${
                        canCraft
                          ? "bg-lime-400 text-black"
                          : "bg-zinc-900 text-zinc-600"
                      }
                    `}
                  >

                    {canCraft && (
                      <div
                        className="absolute inset-y-0 left-0 bg-white/30"
                        style={{
                          width:
                            `${holdProgress}%`,
                        }}
                      />
                    )}

                    <span className="relative z-10">

                      {crafting
                        ? craftStage
                        : season.is_active
                        ? `HOLD TO CRAFT • ${season.craft_cost} LT`
                        : "DROP CLOSED"}

                    </span>

                  </button>

                </section>

              </div>

            </section>

            {craftResult && (
              <section className="mt-7 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6">

                <p className="text-lime-400 text-[9px] tracking-[0.3em]">
                  CRAFT COMPLETE
                </p>

                <h2
                  className={`
                    text-5xl
                    font-black
                    mt-3
                    ${gradeText[craftResult.grade]}
                  `}
                >
                  {
                    craftResult.grade
                  }
                </h2>

                <p className="text-white text-xl font-black mt-3">
                  {
                    craftResult.serial
                  }
                </p>

              </section>
            )}

          </>
        )}

      </div>

    </main>
  );
}

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
    <div className="border border-zinc-800 bg-zinc-950/75 rounded-xl p-5">

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