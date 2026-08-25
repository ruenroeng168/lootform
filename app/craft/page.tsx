"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type CraftPhase =
  | "READY"
  | "HOLDING"
  | "SUBMITTING"
  | "LOCKING"
  | "REVEAL";

type CatalogDesign = {
  id: number;
  design_code: string;
  name: string;
  craft_cost_lt: number;
  available_sizes: string[];
  thumbnail_url: string | null;
  model_url: string | null;
  craft_ready: boolean;
};

type CatalogProduct = {
  id: number;
  code: string;
  name: string;
  category?: string;
  equip_slot?: string;
  season?: string;
  description?: string | null;
  craft_ready: boolean;
  ready_design_count?: number;
  total_design_count?: number;
  designs: CatalogDesign[];
};

type CatalogSeason = {
  id?: number;
  code: string;
  name: string;
  odds: Record<Grade, number>;
};

type CatalogResponse = {
  success: boolean;
  drop_open: boolean;
  season: CatalogSeason | null;
  catalog: CatalogProduct[];
  error?: string;
  message?: string;
  code?: string;
};

type CraftedItem = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: Grade;
  level: number;

  size:
    | string
    | null;

  product_id?:
    | number
    | null;

  design_id?:
    | number
    | null;

  product_code_snapshot?:
    | string
    | null;

  product_name_snapshot?:
    | string
    | null;

  design_code_snapshot?:
    | string
    | null;

  design_name_snapshot?:
    | string
    | null;

  season_snapshot?:
    | string
    | null;

  category_snapshot?:
    | string
    | null;

  equip_slot_snapshot?:
    | string
    | null;

  craft_cost_lt_snapshot?:
    | number
    | null;

  thumbnail_url_snapshot?:
    | string
    | null;

  model_url_snapshot?:
    | string
    | null;

  catalog_snapshot_at?:
    | string
    | null;
};

type CraftResponse = {
  success?: boolean;
  ok?: boolean;
  message?: string;
  error?: string;
  code?: string;
  request_id?: string;
  idempotent_replay?: boolean;

  item?: CraftedItem;

  wallet?: {
    balance?: number;
  };

  craft?: {
    cost?: number;
    grade?: Grade;
    size?: string;
    product?: string;
    design?: string;
    season?: string;
  };
};

type CraftLock = {
  requestId: string;
  productId: number;
  designId: number;
  size: string;
  cost: number;
  productName: string;
};

const GRADES: Grade[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

const HOLD_TIME_MS =
  950;

const MIN_ROLL_TIME_MS =
  1750;

const gradeText: Record<
  Grade,
  string
> = {
  COMMON:
    "text-zinc-100",

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
    "border-zinc-500/50",

  RARE:
    "border-cyan-400/55",

  EPIC:
    "border-purple-400/55",

  LEGENDARY:
    "border-orange-400/60",
};

const gradeHex: Record<
  Grade,
  string
> = {
  COMMON:
    "#e4e4e7",

  RARE:
    "#22d3ee",

  EPIC:
    "#c084fc",

  LEGENDARY:
    "#fb923c",
};

const gradeGlow: Record<
  Grade,
  string
> = {
  COMMON:
    "rgba(228,228,231,.26)",

  RARE:
    "rgba(34,211,238,.46)",

  EPIC:
    "rgba(192,132,252,.52)",

  LEGENDARY:
    "rgba(251,146,60,.60)",
};

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function wait(
  milliseconds: number
) {
  return new Promise<void>(
    (
      resolve
    ) =>
      window.setTimeout(
        resolve,
        milliseconds
      )
  );
}

function isGrade(
  value: unknown
): value is Grade {
  return GRADES.includes(
    value as Grade
  );
}

function getDefaultDesign(
  product:
    | CatalogProduct
    | null
) {
  if (!product) {
    return null;
  }

  return (
    product.designs.find(
      (
        design
      ) =>
        design.craft_ready
    ) ??
    product.designs[0] ??
    null
  );
}

function getErrorMessage(
  value: unknown
) {
  if (
    value &&
    typeof value ===
      "object"
  ) {
    const data =
      value as Record<
        string,
        unknown
      >;

    const message =
      data.error ??
      data.message ??
      data.code;

    if (
      typeof message ===
        "string" &&
      message.trim()
    ) {
      return message;
    }
  }

  return "Craft failed";
}

async function sendCraftRequest(
  accessToken: string,
  locked: CraftLock
) {
  let lastError:
    unknown =
      null;

  for (
    let attempt = 0;
    attempt < 2;
    attempt += 1
  ) {
    try {
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
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                request_id:
                  locked.requestId,

                product_id:
                  locked.productId,

                design_id:
                  locked.designId,

                size:
                  locked.size,
              }),
          }
        );

      const craftData =
        (await response
          .json()) as CraftResponse;

      if (
        response.status >=
          500 &&
        attempt === 0
      ) {
        continue;
      }

      return {
        response,
        craftData,
      };
    } catch (
      error
    ) {
      lastError =
        error;

      if (
        attempt === 1
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof
    Error
    ? lastError
    : new Error(
        "Craft request failed"
      );
}

function AssetImage({
  src,
  alt,
  fallback,
}: {
  src:
    | string
    | null
    | undefined;

  alt: string;
  fallback: string;
}) {
  const [
    broken,
    setBroken,
  ] =
    useState(
      false
    );

  useEffect(
    () => {
      setBroken(
        false
      );
    },
    [
      src,
    ]
  );

  if (
    !src ||
    broken
  ) {
    return (
      <div className="flex h-full w-full items-center justify-center">

        <div className="text-center">

          <div className="mx-auto h-16 w-16 rounded-[22px] border border-zinc-800 bg-zinc-950" />

          <p className="mt-5 text-[9px] font-black tracking-[0.28em] text-zinc-700">
            {
              fallback
            }
          </p>

        </div>

      </div>
    );
  }

  return (
    <img
      src={
        src
      }
      alt={
        alt
      }
      draggable={
        false
      }
      onError={() =>
        setBroken(
          true
        )
      }
      className="h-full w-full select-none object-contain"
    />
  );
}

export default function CraftPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    phase,
    setPhase,
  ] =
    useState<CraftPhase>(
      "READY"
    );

  const [
    userEmail,
    setUserEmail,
  ] =
    useState(
      ""
    );

  const [
    walletBalance,
    setWalletBalance,
  ] =
    useState(
      0
    );

  const [
    season,
    setSeason,
  ] =
    useState<
      CatalogSeason | null
    >(
      null
    );

  const [
    dropOpen,
    setDropOpen,
  ] =
    useState(
      false
    );

  const [
    catalog,
    setCatalog,
  ] =
    useState<
      CatalogProduct[]
    >(
      []
    );

  const [
    selectedProductId,
    setSelectedProductId,
  ] =
    useState<
      number | null
    >(
      null
    );

  const [
    selectedDesignId,
    setSelectedDesignId,
  ] =
    useState<
      number | null
    >(
      null
    );

  const [
    selectedSize,
    setSelectedSize,
  ] =
    useState(
      ""
    );

  const [
    holdProgress,
    setHoldProgress,
  ] =
    useState(
      0
    );

  const [
    result,
    setResult,
  ] =
    useState<
      CraftedItem | null
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

  const [
    screenFlash,
    setScreenFlash,
  ] =
    useState(
      false
    );

  const holdStartRef =
    useRef<
      number | null
    >(
      null
    );

  const holdFrameRef =
    useRef<
      number | null
    >(
      null
    );

  const holdTriggeredRef =
    useRef(
      false
    );

  const craftLockRef =
    useRef<
      CraftLock | null
    >(
      null
    );

  const selectedProduct =
    catalog.find(
      (
        product
      ) =>
        product.id ===
        selectedProductId
    ) ??
    null;

  const selectedDesign =
    selectedProduct
      ?.designs
      .find(
        (
          design
        ) =>
          design.id ===
          selectedDesignId
      ) ??
    null;

  const selectedCost =
    safeNumber(
      selectedDesign
        ?.craft_cost_lt,
      0
    );

  const walletEnough =
    walletBalance >=
    selectedCost;

  const controlsLocked =
    phase ===
      "HOLDING" ||
    phase ===
      "SUBMITTING" ||
    phase ===
      "LOCKING";

  const craftReady =
    Boolean(
      dropOpen &&
        season &&
        selectedProduct &&
        selectedDesign &&
        selectedDesign
          .craft_ready &&
        selectedSize &&
        selectedDesign
          .available_sizes
          .includes(
            selectedSize
          )
    );

  const canCraft =
    craftReady &&
    walletEnough &&
    phase ===
      "READY";

  const odds =
    season?.odds ?? {
      COMMON:
        0,

      RARE:
        0,

      EPIC:
        0,

      LEGENDARY:
        0,
    };

  useEffect(
    () => {
      void loadCraftPage();

      return () => {
        stopAnimationFrame();
      };
    },
    []
  );

  async function loadCraftPage() {
    setLoading(
      true
    );

    setErrorMessage(
      ""
    );

    try {
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

      setUserEmail(
        user.email ??
          "PLAYER"
      );

      const [
        walletResult,
        catalogResponse,
      ] =
        await Promise.all([
          supabase
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
            .maybeSingle(),

          fetch(
            "/api/catalog",
            {
              cache:
                "no-store",
            }
          ),
        ]);

      if (
        walletResult.error
      ) {
        console.error(
          "CRAFT WALLET ERROR:",
          walletResult.error
        );
      }

      setWalletBalance(
        safeNumber(
          walletResult
            .data
            ?.balance,
          0
        )
      );

      const catalogResult =
        (await catalogResponse
          .json()) as CatalogResponse;

      if (
        !catalogResponse.ok ||
        !catalogResult.success
      ) {
        throw new Error(
          catalogResult.error ||
            catalogResult.message ||
            "Unable to load Craft Catalog"
        );
      }

      const nextCatalog =
        Array.isArray(
          catalogResult.catalog
        )
          ? catalogResult.catalog
          : [];

      setCatalog(
        nextCatalog
      );

      setSeason(
        catalogResult.season ??
          null
      );

      setDropOpen(
        Boolean(
          catalogResult.drop_open
        )
      );

      const defaultProduct =
        nextCatalog.find(
          (
            product
          ) =>
            product.craft_ready
        ) ??
        nextCatalog[0] ??
        null;

      const defaultDesign =
        getDefaultDesign(
          defaultProduct
        );

      setSelectedProductId(
        defaultProduct
          ?.id ??
          null
      );

      setSelectedDesignId(
        defaultDesign
          ?.id ??
          null
      );

      setSelectedSize(
        defaultDesign
          ?.available_sizes
          ?.[0] ??
          ""
      );
    } catch (
      error
    ) {
      console.error(
        "CRAFT PAGE ERROR:",
        error
      );

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

  function resetResult() {
    setResult(
      null
    );

    setErrorMessage(
      ""
    );

    setHoldProgress(
      0
    );

    setPhase(
      "READY"
    );
  }

  function selectProduct(
    productId: number
  ) {
    if (
      controlsLocked
    ) {
      return;
    }

    const product =
      catalog.find(
        (
          item
        ) =>
          item.id ===
          productId
      ) ??
      null;

    const design =
      getDefaultDesign(
        product
      );

    setSelectedProductId(
      productId
    );

    setSelectedDesignId(
      design
        ?.id ??
        null
    );

    setSelectedSize(
      design
        ?.available_sizes
        ?.[0] ??
        ""
    );

    resetResult();
  }

  function selectDesign(
    designId: number
  ) {
    if (
      controlsLocked ||
      !selectedProduct
    ) {
      return;
    }

    const design =
      selectedProduct
        .designs
        .find(
          (
            item
          ) =>
            item.id ===
            designId
        ) ??
      null;

    setSelectedDesignId(
      designId
    );

    setSelectedSize(
      design
        ?.available_sizes
        ?.[0] ??
        ""
    );

    resetResult();
  }

  function stopAnimationFrame() {
    if (
      holdFrameRef.current !==
      null
    ) {
      window
        .cancelAnimationFrame(
          holdFrameRef.current
        );

      holdFrameRef.current =
        null;
    }
  }

  function startHold(
    event:
      ReactPointerEvent<HTMLButtonElement>
  ) {
    if (
      !canCraft ||
      !selectedProduct ||
      !selectedDesign
    ) {
      return;
    }

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        );
    } catch {
      // Pointer capture is optional.
    }

    stopAnimationFrame();

    setErrorMessage(
      ""
    );

    setResult(
      null
    );

    setHoldProgress(
      0
    );

    setPhase(
      "HOLDING"
    );

    holdTriggeredRef.current =
      false;

    holdStartRef.current =
      performance.now();

    craftLockRef.current = {
      requestId:
        crypto.randomUUID(),

      productId:
        selectedProduct.id,

      designId:
        selectedDesign.id,

      size:
        selectedSize,

      cost:
        selectedCost,

      productName:
        selectedProduct.name,
    };

    function tick() {
      const startedAt =
        holdStartRef.current;

      if (
        startedAt ===
        null
      ) {
        return;
      }

      const elapsed =
        performance.now() -
        startedAt;

      const progress =
        Math.min(
          100,
          (
            elapsed /
            HOLD_TIME_MS
          ) *
            100
        );

      setHoldProgress(
        progress
      );

      if (
        progress >=
        100
      ) {
        stopAnimationFrame();

        holdStartRef.current =
          null;

        holdTriggeredRef.current =
          true;

        void submitCraft();

        return;
      }

      holdFrameRef.current =
        window
          .requestAnimationFrame(
            tick
          );
    }

    holdFrameRef.current =
      window
        .requestAnimationFrame(
          tick
        );
  }

  function cancelHold() {
    if (
      holdTriggeredRef.current
    ) {
      return;
    }

    stopAnimationFrame();

    holdStartRef.current =
      null;

    craftLockRef.current =
      null;

    setHoldProgress(
      0
    );

    setPhase(
      "READY"
    );
  }

  async function submitCraft() {
    const locked =
      craftLockRef.current;

    if (!locked) {
      setPhase(
        "READY"
      );

      return;
    }

    const rollStartedAt =
      performance.now();

    setPhase(
      "SUBMITTING"
    );

    setHoldProgress(
      100
    );

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase
          .auth
          .getSession();

      if (!session) {
        router.push(
          "/login"
        );

        return;
      }

      const {
        response,
        craftData,
      } =
        await sendCraftRequest(
          session.access_token,
          locked
        );

      if (
        !response.ok ||
        craftData.success ===
          false ||
        craftData.ok ===
          false ||
        !craftData.item
      ) {
        throw new Error(
          getErrorMessage(
            craftData
          )
        );
      }

      if (
        !isGrade(
          craftData.item
            .grade
        )
      ) {
        throw new Error(
          "Server returned an invalid Grade."
        );
      }

      const finalItem:
        CraftedItem = {
          ...craftData.item,

          product:
            craftData.item
              .product_name_snapshot ??
            craftData.item
              .product ??
            locked.productName,

          season:
            craftData.item
              .season_snapshot ??
            craftData.item
              .season ??
            season?.code ??
            "-",

          size:
            craftData.item
              .size ??
            locked.size,

          level:
            safeNumber(
              craftData.item
                .level,
              1
            ),

          thumbnail_url_snapshot:
            craftData.item
              .thumbnail_url_snapshot ??
            null,

          model_url_snapshot:
            craftData.item
              .model_url_snapshot ??
            null,
        };

      setResult(
        finalItem
      );

      if (
        typeof craftData
          .wallet
          ?.balance ===
        "number"
      ) {
        setWalletBalance(
          craftData.wallet
            .balance
        );
      } else {
        setWalletBalance(
          (
            current
          ) =>
            Math.max(
              0,
              current -
                locked.cost
            )
        );
      }

      const elapsed =
        performance.now() -
        rollStartedAt;

      if (
        elapsed <
        MIN_ROLL_TIME_MS
      ) {
        await wait(
          MIN_ROLL_TIME_MS -
            elapsed
        );
      }

      setPhase(
        "LOCKING"
      );

      if (
        typeof navigator !==
          "undefined" &&
        "vibrate" in
          navigator
      ) {
        navigator.vibrate?.([
          35,
          25,
          80,
        ]);
      }

      await wait(
        520
      );

      setScreenFlash(
        true
      );

      await wait(
        110
      );

      setScreenFlash(
        false
      );

      await wait(
        360
      );

      setPhase(
        "REVEAL"
      );
    } catch (
      error
    ) {
      console.error(
        "CRAFT SUBMIT ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Craft failed"
      );

      setResult(
        null
      );

      setPhase(
        "READY"
      );

      setHoldProgress(
        0
      );
    } finally {
      holdStartRef.current =
        null;

      holdTriggeredRef.current =
        false;

      craftLockRef.current =
        null;
    }
  }

  function craftAgain() {
    setResult(
      null
    );

    setErrorMessage(
      ""
    );

    setHoldProgress(
      0
    );

    setPhase(
      "READY"
    );
  }

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="flex min-h-[78vh] items-center justify-center">

          <div className="text-center">

            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-zinc-800 border-t-lime-400" />

            <p className="mt-5 text-[9px] font-black tracking-[0.32em] text-lime-400">
              INITIALIZING CRAFT
            </p>

          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020303] text-white">

      <Navbar />

      {screenFlash && (
        <div className="pointer-events-none fixed inset-0 z-[120] bg-white craft-screen-flash" />
      )}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        <div className="absolute left-1/2 top-[-520px] h-[850px] w-[1050px] -translate-x-1/2 rounded-full bg-lime-400/[0.065] blur-[180px]" />

        <div className="absolute bottom-[-480px] left-[-320px] h-[760px] w-[760px] rounded-full bg-cyan-400/[0.055] blur-[190px]" />

        <div className="absolute bottom-[-480px] right-[-320px] h-[760px] w-[760px] rounded-full bg-purple-500/[0.055] blur-[190px]" />

      </div>

      {/* =================================================
          MORE COMPACT PAGE TOP
      ================================================= */}

      <div className="relative z-10 mx-auto max-w-[1220px] px-5 pb-12 pt-5 sm:px-7 lg:px-8">

        {/* =================================================
            COMPACT HEADER
        ================================================= */}

        <section className="flex flex-wrap items-end justify-between gap-4">

          <div>

            <div className="flex items-center gap-2.5">

              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400 shadow-[0_0_14px_rgba(163,230,53,.75)]" />

              <p className="text-[7px] font-black tracking-[0.3em] text-lime-400">
                LOOTFORM CRAFT SYSTEM
              </p>

            </div>

            <h1 className="mt-2 text-[34px] font-black leading-none sm:text-[42px] lg:text-[46px]">

              CRAFT{" "}

              <span className="text-lime-400">
                LOOT
              </span>

            </h1>

            <p className="mt-2 text-[8px] font-bold tracking-[0.11em] text-zinc-600">
              DIGITAL LOOT. PHYSICAL FORM.
            </p>

          </div>

          <div className="flex gap-2">

            <TopStat
              label="SEASON"
              value={
                season?.code ??
                "-"
              }
              accent="text-cyan-400"
            />

            <TopStat
              label="WALLET"
              value={`${walletBalance.toLocaleString()} LT`}
              accent="text-lime-400"
              onClick={() =>
                router.push(
                  "/wallet"
                )
              }
            />

          </div>

        </section>

        {errorMessage && (
          <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-red-400/30 bg-red-400/[0.06] p-4">

            <div>

              <p className="text-[8px] font-black tracking-[0.2em] text-red-400">
                CRAFT ERROR
              </p>

              <p className="mt-2 text-sm font-bold text-red-200">
                {
                  errorMessage
                }
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                setErrorMessage(
                  ""
                )
              }
              className="text-lg font-black text-red-400"
            >
              ×
            </button>

          </div>
        )}

        {(!season ||
          catalog.length ===
            0) && (

          <section className="mt-6 rounded-[30px] border border-zinc-800 bg-zinc-950/70 p-12 text-center">

            <div className="mx-auto h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_24px_rgba(248,113,113,.8)]" />

            <p className="mt-5 text-[9px] font-black tracking-[0.3em] text-red-400">
              DROP CLOSED
            </p>

            <h2 className="mt-3 text-3xl font-black sm:text-4xl">
              NO ACTIVE LOOT
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-zinc-600">
              There is currently no active Product / Design available for Craft.
            </p>

          </section>

        )}

        {season &&
          catalog.length >
            0 && (

          <>

            {catalog.length >
              1 && (

              <section className="mt-5 flex flex-wrap items-center gap-2">

                <p className="mr-2 text-[8px] font-black tracking-[0.22em] text-zinc-700">
                  PRODUCT
                </p>

                {catalog.map(
                  (
                    product
                  ) => {

                    const active =
                      product.id ===
                      selectedProductId;

                    return (
                      <button
                        key={
                          product.id
                        }
                        type="button"
                        disabled={
                          controlsLocked
                        }
                        onClick={() =>
                          selectProduct(
                            product.id
                          )
                        }
                        className={`
                          rounded-full
                          border
                          px-4
                          py-2.5
                          text-[9px]
                          font-black
                          transition

                          ${
                            active
                              ? "border-lime-400 bg-lime-400 text-black"
                              : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:border-zinc-600 hover:text-white"
                          }

                          ${
                            controlsLocked
                              ? "cursor-not-allowed opacity-50"
                              : ""
                          }
                        `}
                      >
                        {
                          product.name
                        }
                      </button>
                    );
                  }
                )}

              </section>

            )}

            <section className="mt-5 overflow-hidden rounded-[32px] border border-zinc-800/90 bg-[#070808]/95 shadow-[0_30px_100px_rgba(0,0,0,.55)]">

              {phase ===
                "REVEAL" &&
              result ? (

                <ResultView
                  item={
                    result
                  }
                  onCraftAgain={
                    craftAgain
                  }
                  onCollection={() =>
                    router.push(
                      "/collection"
                    )
                  }
                />

              ) : (

                <div className="grid lg:grid-cols-[1.12fr_.88fr]">

                  {/* LEFT */}

                  <div className="relative min-h-[535px] overflow-hidden border-b border-zinc-800 lg:border-b-0 lg:border-r">

                    <div className="craft-grid pointer-events-none absolute inset-0 opacity-[0.035]" />

                    <div className="pointer-events-none absolute left-1/2 top-[46%] h-[410px] w-[410px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/[0.045] blur-[88px]" />

                    <div className="absolute left-6 top-5 z-20 flex items-center gap-2 rounded-full border border-lime-400/20 bg-black/60 px-3.5 py-2 backdrop-blur">

                      <span
                        className={`
                          h-1.5
                          w-1.5
                          rounded-full

                          ${
                            dropOpen &&
                            selectedDesign
                              ?.craft_ready
                              ? "animate-pulse bg-lime-400"
                              : "bg-red-400"
                          }
                        `}
                      />

                      <span
                        className={`
                          text-[8px]
                          font-black
                          tracking-[0.17em]

                          ${
                            dropOpen &&
                            selectedDesign
                              ?.craft_ready
                              ? "text-lime-400"
                              : "text-red-400"
                          }
                        `}
                      >
                        {
                          dropOpen &&
                          selectedDesign
                            ?.craft_ready
                            ? "CRAFT READY"
                            : "CRAFT LOCKED"
                        }
                      </span>

                    </div>

                    <div className="absolute inset-x-9 bottom-[90px] top-[58px] z-10">

                      <AssetImage
                        src={
                          selectedDesign
                            ?.thumbnail_url
                        }
                        alt={
                          selectedDesign
                            ?.name ??
                          "Design Preview"
                        }
                        fallback="DESIGN PREVIEW"
                      />

                    </div>

                    <div className="absolute inset-x-6 bottom-4 z-20 flex items-end justify-between gap-5">

                      <div>

                        <p className="text-[8px] font-black tracking-[0.22em] text-lime-400">
                          {
                            selectedProduct
                              ?.code ??
                            "PRODUCT"
                          }
                        </p>

                        <h2 className="mt-1 text-2xl font-black sm:text-[27px]">
                          {
                            selectedProduct
                              ?.name ??
                            "-"
                          }
                        </h2>

                        <p className="mt-1 text-[10px] font-bold text-purple-400">
                          {
                            selectedDesign
                              ? `${selectedDesign.design_code} · ${selectedDesign.name}`
                              : "-"
                          }
                        </p>

                      </div>

                      <p className="max-w-[150px] text-right text-[7px] font-bold leading-4 tracking-[0.13em] text-zinc-700">
                        GRADE ART HIDDEN UNTIL SERVER RESULT
                      </p>

                    </div>

                    {(phase ===
                      "SUBMITTING" ||
                      phase ===
                        "LOCKING") && (

                      <CraftCinematicOverlay
                        phase={
                          phase
                        }
                        result={
                          result
                        }
                      />

                    )}

                  </div>

                  {/* RIGHT */}

                  <div className="flex min-h-[535px] flex-col p-6 sm:p-7 lg:p-7">

                    {/* COST */}

                    <div className="flex items-end justify-between gap-4 border-b border-zinc-900 pb-4">

                      <div>

                        <p className="text-[8px] font-black tracking-[0.25em] text-zinc-600">
                          CRAFT LOADOUT
                        </p>

                        <p className="mt-2 text-[29px] font-black leading-none text-white">

                          {
                            selectedCost
                              .toLocaleString()
                          }{" "}

                          <span className="text-lime-400">
                            LT
                          </span>

                        </p>

                      </div>

                      <div className="text-right">

                        <p
                          className={
                            walletEnough
                              ? "text-sm font-black text-lime-400"
                              : "text-sm font-black text-red-400"
                          }
                        >
                          {
                            walletBalance
                              .toLocaleString()
                          }{" "}
                          LT
                        </p>

                        <p className="mt-1 text-[7px] font-bold tracking-[0.15em] text-zinc-700">
                          BALANCE
                        </p>

                      </div>

                    </div>

                    {/* DESIGN */}

                    <div className="mt-4">

                      <div className="flex items-center justify-between">

                        <p className="text-[8px] font-black tracking-[0.2em] text-purple-400">
                          DESIGN
                        </p>

                        <p className="text-[7px] font-black text-zinc-700">
                          {
                            selectedProduct
                              ?.designs
                              .length ??
                            0
                          }{" "}
                          AVAILABLE
                        </p>

                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">

                        {(
                          selectedProduct
                            ?.designs ??
                          []
                        ).map(
                          (
                            design
                          ) => {

                            const active =
                              design.id ===
                              selectedDesignId;

                            return (
                              <button
                                key={
                                  design.id
                                }
                                type="button"
                                disabled={
                                  controlsLocked
                                }
                                onClick={() =>
                                  selectDesign(
                                    design.id
                                  )
                                }
                                className={`
                                  flex
                                  min-h-[56px]
                                  items-center
                                  justify-between
                                  gap-3
                                  rounded-xl
                                  border
                                  px-4
                                  py-2.5
                                  text-left
                                  transition

                                  ${
                                    active
                                      ? "border-purple-400/50 bg-purple-400/[0.06]"
                                      : "border-zinc-800 bg-black/35 hover:border-zinc-700"
                                  }

                                  ${
                                    controlsLocked
                                      ? "cursor-not-allowed opacity-50"
                                      : ""
                                  }
                                `}
                              >

                                <div className="min-w-0">

                                  <p
                                    className={
                                      active
                                        ? "text-[10px] font-black text-purple-400"
                                        : "text-[10px] font-black text-zinc-300"
                                    }
                                  >
                                    {
                                      design.design_code
                                    }
                                  </p>

                                  <p className="mt-1 truncate text-[8px] font-bold text-zinc-600">
                                    {
                                      design.name
                                    }
                                  </p>

                                </div>

                                <span
                                  className={`
                                    h-2
                                    w-2
                                    shrink-0
                                    rounded-full

                                    ${
                                      design.craft_ready
                                        ? "bg-lime-400"
                                        : "bg-red-400"
                                    }
                                  `}
                                />

                              </button>
                            );
                          }
                        )}

                      </div>

                    </div>

                    {/* =================================================
                        COMPACT SIZE SELECTOR
                    ================================================= */}

                    <div className="mt-4">

                      <p className="text-[7px] font-black tracking-[0.18em] text-cyan-400">
                        SELECT SIZE
                      </p>

                      <div className="mt-2 grid grid-cols-5 gap-1.5">

                        {(
                          selectedDesign
                            ?.available_sizes ??
                          []
                        ).map(
                          (
                            size
                          ) => {

                            const active =
                              selectedSize ===
                              size;

                            return (
                              <button
                                key={
                                  size
                                }
                                type="button"
                                disabled={
                                  controlsLocked
                                }
                                onClick={() =>
                                  setSelectedSize(
                                    size
                                  )
                                }
                                className={`
                                  min-h-[36px]
                                  rounded-lg
                                  border
                                  px-1
                                  py-2
                                  text-[10px]
                                  font-black
                                  transition

                                  ${
                                    active
                                      ? "border-lime-400 bg-lime-400 text-black shadow-[0_0_12px_rgba(163,230,53,.12)]"
                                      : "border-zinc-800 bg-black text-zinc-500 hover:border-zinc-600 hover:text-white"
                                  }

                                  ${
                                    controlsLocked
                                      ? "cursor-not-allowed opacity-50"
                                      : ""
                                  }
                                `}
                              >
                                {
                                  size
                                }
                              </button>
                            );
                          }
                        )}

                      </div>

                    </div>

                    {/* DROP RATES */}

                    <div className="mt-3.5">

                      <div className="flex items-center justify-between">

                        <p className="text-[7px] font-black tracking-[0.18em] text-zinc-600">
                          DROP RATES
                        </p>

                        <p className="text-[6px] font-bold tracking-[0.12em] text-zinc-700">
                          SERVER RANDOM
                        </p>

                      </div>

                      <div className="mt-1.5 grid grid-cols-4 gap-1.5">

                        {GRADES.map(
                          (
                            grade
                          ) => (
                            <div
                              key={
                                grade
                              }
                              className={`
                                rounded-lg
                                border
                                bg-black/35
                                px-2
                                py-2

                                ${
                                  gradeBorder[
                                    grade
                                  ]
                                }
                              `}
                            >

                              <div className="flex items-end justify-between gap-1">

                                <p
                                  className={`
                                    min-w-0
                                    truncate
                                    text-[5px]
                                    font-black
                                    leading-none

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

                                <p className="shrink-0 text-[14px] font-black leading-none text-white">
                                  {
                                    safeNumber(
                                      odds[
                                        grade
                                      ]
                                    )
                                  }
                                  %
                                </p>

                              </div>

                            </div>
                          )
                        )}

                      </div>

                    </div>

                    <div className="flex-1" />

                    {/* ENERGY */}

                    <div className="mt-3.5">

                      <div className="mb-1.5 flex items-center justify-between">

                        <p className="text-[7px] font-black tracking-[0.16em] text-zinc-700">
                          CRAFT ENERGY
                        </p>

                        <p className="text-[8px] font-black text-lime-400">
                          {
                            Math.round(
                              holdProgress
                            )
                          }
                          %
                        </p>

                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900">

                        <div
                          className="h-full bg-lime-400 shadow-[0_0_12px_rgba(163,230,53,.45)] transition-[width] duration-75"
                          style={{
                            width:
                              `${holdProgress}%`,
                          }}
                        />

                      </div>

                    </div>

                    {/* HOLD */}

                    <button
                      type="button"
                      disabled={
                        !canCraft
                      }
                      onPointerDown={
                        startHold
                      }
                      onPointerUp={
                        cancelHold
                      }
                      onPointerCancel={
                        cancelHold
                      }
                      onContextMenu={(
                        event
                      ) =>
                        event.preventDefault()
                      }
                      className={`
                        relative
                        mt-3
                        min-h-[72px]
                        w-full
                        touch-none
                        select-none
                        overflow-hidden
                        rounded-[16px]
                        font-black
                        transition

                        ${
                          canCraft
                            ? "bg-lime-400 text-black shadow-[0_0_28px_rgba(163,230,53,.16)] hover:bg-lime-300"
                            : "cursor-not-allowed border border-zinc-800 bg-zinc-900 text-zinc-600"
                        }
                      `}
                    >

                      <div
                        className="absolute inset-y-0 left-0 bg-white/25"
                        style={{
                          width:
                            `${holdProgress}%`,
                        }}
                      />

                      <div className="relative z-10 px-4 py-3">

                        <p className="text-[14px] font-black">

                          {
                            phase ===
                            "HOLDING"
                              ? "KEEP HOLDING..."

                            : !dropOpen
                            ? "DROP CLOSED"

                            : !selectedDesign
                                ?.craft_ready
                            ? "CRAFT TEMPORARILY UNAVAILABLE"

                            : !walletEnough
                            ? "NOT ENOUGH LOOT TOKEN"

                            : `HOLD TO CRAFT · ${selectedCost.toLocaleString()} LT`
                          }

                        </p>

                        {canCraft && (
                          <p className="mt-1 text-[6px] font-black tracking-[0.18em] text-black/50">
                            HOLD 0.95 SEC · SERVER DECIDES RESULT
                          </p>
                        )}

                      </div>

                    </button>

                    <div className="mt-2 flex items-center justify-center gap-2">

                      <span className="h-1 w-1 rounded-full bg-cyan-400" />

                      <p className="text-[6px] font-bold tracking-[0.14em] text-zinc-700">
                        SECURE SERVER ROLL
                      </p>

                    </div>

                  </div>

                </div>

              )}

            </section>

            <section className="mt-3 flex flex-wrap items-center justify-between gap-4 px-1">

              <p className="text-[8px] font-bold tracking-[0.16em] text-zinc-700">
                CRAFT IT. WEAR IT. LEVEL IT UP.
              </p>

              <p className="text-[8px] font-bold tracking-[0.12em] text-zinc-800">
                PLAYER //{" "}
                {
                  userEmail
                }
              </p>

            </section>

          </>

        )}

      </div>

      <style jsx global>{`

        .craft-grid {
          background-image:
            linear-gradient(
              rgba(255,255,255,.14)
              1px,
              transparent
              1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,.14)
              1px,
              transparent
              1px
            );

          background-size:
            42px 42px;
        }

        .craft-screen-flash {
          animation:
            craftFlash
            220ms
            ease-out
            forwards;
        }

        @keyframes craftFlash {
          0% {
            opacity: 0;
          }

          35% {
            opacity: .95;
          }

          100% {
            opacity: 0;
          }
        }

        .craft-ring-a {
          animation:
            ringSpinA
            3.4s
            linear
            infinite;
        }

        .craft-ring-b {
          animation:
            ringSpinB
            2.2s
            linear
            infinite
            reverse;
        }

        .craft-ring-c {
          animation:
            ringPulse
            1.05s
            ease-in-out
            infinite;
        }

        .craft-scanner-line {
          animation:
            scannerMove
            1.15s
            ease-in-out
            infinite;
        }

        .craft-core {
          animation:
            corePulse
            .72s
            ease-in-out
            infinite;
        }

        @keyframes ringSpinA {
          to {
            transform:
              rotate(360deg);
          }
        }

        @keyframes ringSpinB {
          to {
            transform:
              rotate(360deg);
          }
        }

        @keyframes ringPulse {
          0%,
          100% {
            transform:
              scale(.94);

            opacity:
              .35;
          }

          50% {
            transform:
              scale(1.06);

            opacity:
              .9;
          }
        }

        @keyframes scannerMove {
          0% {
            transform:
              translateY(-250px);

            opacity:
              0;
          }

          12% {
            opacity:
              1;
          }

          88% {
            opacity:
              1;
          }

          100% {
            transform:
              translateY(250px);

            opacity:
              0;
          }
        }

        @keyframes corePulse {
          0%,
          100% {
            transform:
              scale(.92);

            opacity:
              .72;
          }

          50% {
            transform:
              scale(1.08);

            opacity:
              1;
          }
        }

        .rarity-word {
          animation:
            rarityCycle
            1.08s
            steps(1, end)
            infinite;

          opacity:
            0;
        }

        .rarity-word:nth-child(1) {
          animation-delay:
            0s;
        }

        .rarity-word:nth-child(2) {
          animation-delay:
            .27s;
        }

        .rarity-word:nth-child(3) {
          animation-delay:
            .54s;
        }

        .rarity-word:nth-child(4) {
          animation-delay:
            .81s;
        }

        @keyframes rarityCycle {
          0%,
          24% {
            opacity:
              1;

            transform:
              translateY(0)
              scale(1);
          }

          25%,
          100% {
            opacity:
              0;

            transform:
              translateY(7px)
              scale(.96);
          }
        }

        .spark {
          animation:
            sparkFloat
            1.9s
            ease-in-out
            infinite;
        }

        @keyframes sparkFloat {
          0% {
            transform:
              translateY(16px)
              scale(.5);

            opacity:
              0;
          }

          25% {
            opacity:
              .9;
          }

          100% {
            transform:
              translateY(-60px)
              scale(1.15);

            opacity:
              0;
          }
        }

        .lock-slam {
          animation:
            lockSlam
            .7s
            cubic-bezier(.16, 1, .3, 1)
            both;
        }

        @keyframes lockSlam {
          0% {
            transform:
              scale(1.45);

            opacity:
              0;

            filter:
              blur(12px);
          }

          60% {
            transform:
              scale(.96);

            opacity:
              1;

            filter:
              blur(0);
          }

          100% {
            transform:
              scale(1);

            opacity:
              1;
          }
        }

        .result-enter {
          animation:
            resultEnter
            .72s
            cubic-bezier(.16, 1, .3, 1)
            both;
        }

        @keyframes resultEnter {
          0% {
            opacity:
              0;

            transform:
              scale(.965)
              translateY(18px);
          }

          100% {
            opacity:
              1;

            transform:
              scale(1)
              translateY(0);
          }
        }

      `}</style>

    </main>
  );
}

/* =========================================================
   CRAFT CINEMATIC
========================================================= */

function CraftCinematicOverlay({
  phase,
  result,
}: {
  phase:
    | "SUBMITTING"
    | "LOCKING";

  result:
    | CraftedItem
    | null;
}) {
  const lockedGrade =
    result?.grade;

  return (
    <div className="absolute inset-0 z-50 overflow-hidden bg-black/84 backdrop-blur-sm">

      <div className="craft-grid absolute inset-0 opacity-[0.055]" />

      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/[0.06] blur-[95px]" />

      <div className="craft-scanner-line absolute left-0 right-0 top-1/2 h-[2px] bg-cyan-400 shadow-[0_0_28px_rgba(34,211,238,.95)]" />

      <div className="absolute inset-0">

        {Array.from({
          length:
            18,
        }).map(
          (
            _,
            index
          ) => (

            <span
              key={
                index
              }
              className="spark absolute h-1 w-1 rounded-full bg-lime-400"
              style={{
                left:
                  `${8 + ((index * 37) % 84)}%`,

                top:
                  `${24 + ((index * 19) % 62)}%`,

                animationDelay:
                  `${(index % 6) * 0.16}s`,

                opacity:
                  0.55,
              }}
            />

          )
        )}

      </div>

      <div className="absolute left-1/2 top-1/2 h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2">

        <div className="craft-ring-a absolute inset-0 rounded-full border border-dashed border-lime-400/25" />

        <div className="craft-ring-b absolute inset-[34px] rounded-full border border-cyan-400/25" />

        <div className="craft-ring-c absolute inset-[76px] rounded-full border border-purple-400/20" />

      </div>

      <div className="relative z-10 flex h-full items-center justify-center px-6 text-center">

        {phase ===
        "SUBMITTING" ? (

          <div>

            <div className="craft-core mx-auto h-14 w-14 rounded-full border border-lime-400/50 bg-lime-400/20 shadow-[0_0_45px_rgba(163,230,53,.38)]" />

            <p className="mt-7 text-[8px] font-black tracking-[0.38em] text-lime-400">
              SERVER ROLL ACTIVE
            </p>

            <div className="relative mx-auto mt-4 h-[60px] w-[320px] max-w-full">

              {GRADES.map(
                (
                  grade
                ) => (

                  <p
                    key={
                      grade
                    }
                    className={`
                      rarity-word
                      absolute
                      inset-0
                      flex
                      items-center
                      justify-center
                      text-4xl
                      font-black

                      ${
                        gradeText[
                          grade
                        ]
                      }
                    `}
                    style={{
                      textShadow:
                        `0 0 28px ${gradeGlow[grade]}`,
                    }}
                  >
                    {
                      grade
                    }
                  </p>

                )
              )}

            </div>

            <p className="mt-2 text-[8px] font-bold tracking-[0.2em] text-zinc-600">
              GENERATING ITEM IDENTITY
            </p>

          </div>

        ) : (

          <div className="lock-slam">

            <p className="text-[8px] font-black tracking-[0.38em] text-zinc-500">
              RESULT LOCKED
            </p>

            <p
              className={`
                mt-4
                text-5xl
                font-black
                sm:text-6xl

                ${
                  lockedGrade
                    ? gradeText[
                        lockedGrade
                      ]
                    : "text-white"
                }
              `}
              style={{
                textShadow:
                  lockedGrade
                    ? `0 0 36px ${gradeGlow[lockedGrade]}`
                    : undefined,
              }}
            >
              {
                lockedGrade ??
                "LOCKING"
              }
            </p>

            <div
              className="mx-auto mt-6 h-1 w-32 rounded-full"
              style={{
                background:
                  lockedGrade
                    ? gradeHex[
                        lockedGrade
                      ]
                    : "#a3e635",

                boxShadow:
                  lockedGrade
                    ? `0 0 24px ${gradeGlow[lockedGrade]}`
                    : undefined,
              }}
            />

            <p className="mt-5 font-mono text-[10px] font-black text-cyan-400">
              {
                result?.serial ??
                "VERIFYING ITEM ID"
              }
            </p>

          </div>

        )}

      </div>

    </div>
  );
}

/* =========================================================
   RESULT
========================================================= */

function ResultView({
  item,
  onCraftAgain,
  onCollection,
}: {
  item: CraftedItem;

  onCraftAgain:
    () => void;

  onCollection:
    () => void;
}) {
  const grade =
    item.grade;

  return (
    <div className="result-enter relative min-h-[590px] overflow-hidden">

      <div
        className="pointer-events-none absolute left-1/2 top-[44%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[125px]"
        style={{
          background:
            gradeGlow[
              grade
            ],
        }}
      />

      <div className="craft-grid pointer-events-none absolute inset-0 opacity-[0.025]" />

      <div className="relative z-10 grid min-h-[590px] lg:grid-cols-[1.08fr_.92fr]">

        <div className="relative flex min-h-[450px] items-center justify-center border-b border-zinc-800 p-8 lg:border-b-0 lg:border-r lg:p-10">

          <div
            className="pointer-events-none absolute h-[350px] w-[350px] rounded-full blur-[88px]"
            style={{
              background:
                gradeGlow[
                  grade
                ],

              opacity:
                0.25,
            }}
          />

          <div className="relative h-[390px] w-full max-w-[490px]">

            <AssetImage
              src={
                item.thumbnail_url_snapshot
              }
              alt={`${item.product} ${grade}`}
              fallback="ITEM SNAPSHOT"
            />

          </div>

        </div>

        <div className="flex flex-col justify-center p-7 sm:p-9 lg:p-10">

          <div className="flex items-center gap-2">

            <span
              className="h-2 w-2 animate-pulse rounded-full"
              style={{
                background:
                  gradeHex[
                    grade
                  ],

                boxShadow:
                  `0 0 18px ${gradeGlow[grade]}`,
              }}
            />

            <p className="text-[8px] font-black tracking-[0.3em] text-zinc-600">
              RESULT LOCKED
            </p>

          </div>

          <p
            className={`
              mt-5
              text-5xl
              font-black
              leading-none
              sm:text-6xl

              ${
                gradeText[
                  grade
                ]
              }
            `}
            style={{
              textShadow:
                `0 0 32px ${gradeGlow[grade]}`,
            }}
          >
            {
              grade
            }
          </p>

          <p className="mt-5 text-2xl font-black text-white">
            {
              item.product
            }
          </p>

          {item
            .design_name_snapshot && (

            <p className="mt-2 text-xs font-bold text-purple-400">
              {
                item.design_name_snapshot
              }
            </p>

          )}

          <div
            className={`
              mt-6
              rounded-[18px]
              border
              bg-black/50
              p-5

              ${
                gradeBorder[
                  grade
                ]
              }
            `}
          >

            <p className="text-[7px] font-black tracking-[0.2em] text-zinc-600">
              ITEM ID
            </p>

            <p className="mt-2 font-mono text-lg font-black text-cyan-400">
              {
                item.serial
              }
            </p>

          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">

            <ResultInfo
              label="SIZE"
              value={
                item.size ??
                "-"
              }
            />

            <ResultInfo
              label="LEVEL"
              value={`LV.${safeNumber(
                item.level,
                1
              )}`}
            />

            <ResultInfo
              label="SEASON"
              value={
                item.season
              }
            />

          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">

            <button
              type="button"
              onClick={
                onCraftAgain
              }
              className="rounded-2xl bg-lime-400 px-5 py-4 text-sm font-black text-black transition hover:bg-lime-300"
            >
              CRAFT AGAIN
            </button>

            <button
              type="button"
              onClick={
                onCollection
              }
              className="rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.04] px-5 py-4 text-sm font-black text-cyan-400 transition hover:bg-cyan-400/[0.08]"
            >
              VIEW COLLECTION
            </button>

          </div>

          <p className="mt-4 text-center text-[7px] font-bold tracking-[0.16em] text-zinc-700">
            ITEM SNAPSHOT SAVED // PHYSICAL PRODUCTION READY
          </p>

        </div>

      </div>

    </div>
  );
}

function TopStat({
  label,
  value,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  accent: string;

  onClick?:
    () => void;
}) {
  const content = (
    <>

      <p className="text-[6px] font-bold tracking-[0.15em] text-zinc-700">
        {
          label
        }
      </p>

      <p
        className={`
          mt-1
          text-[13px]
          font-black
          ${accent}
        `}
      >
        {
          value
        }
      </p>

    </>
  );

  if (
    onClick
  ) {
    return (
      <button
        type="button"
        onClick={
          onClick
        }
        className="min-w-[84px] rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5 text-left transition hover:border-zinc-600"
      >
        {
          content
        }
      </button>
    );
  }

  return (
    <div className="min-w-[76px] rounded-xl border border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5">
      {
        content
      }
    </div>
  );
}

function ResultInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">

      <p className="text-[7px] font-bold tracking-[0.15em] text-zinc-700">
        {
          label
        }
      </p>

      <p className="mt-1 truncate text-xs font-black text-white">
        {
          value
        }
      </p>

    </div>
  );
}