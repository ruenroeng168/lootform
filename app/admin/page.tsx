"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/lib/supabase";

import Navbar from "@/components/Navbar";

/* =========================================================
   TYPES
========================================================= */

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type ProductionStatus =
  | "CRAFTED"
  | "PRODUCTION"
  | "QC"
  | "PACKING"
  | "SHIPPED"
  | "DELIVERED";

type DashboardData = {
  admin: {
    email: string;
  };

  stats: {
    totalItems: number;

    totalWallets: number;

    totalWalletBalance: number;

    grade: {
      COMMON: number;

      RARE: number;

      EPIC: number;

      LEGENDARY: number;
    };

    production: {
      CRAFTED: number;

      PRODUCTION: number;

      QC: number;

      PACKING: number;

      SHIPPED: number;

      DELIVERED: number;
    };

    transactions: {
      recentTopup: number;

      recentSpent: number;

      recentCrafts: number;
    };
  };

  latestItems: {
    id: number;

    serial: string;

    grade: Grade;

    production_status:
      ProductionStatus;

    created_at: string;
  }[];

  recentTransactions: {
    id: number;

    type: string;

    amount: number;

    created_at: string;
  }[];
};

/* =========================================================
   PAGE
========================================================= */

export default function AdminDashboardPage() {
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
    dashboard,
    setDashboard,
  ] =
    useState<
      DashboardData | null
    >(null);

  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  async function loadDashboard() {
    setLoading(
      true
    );

    setErrorMessage(
      ""
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

      const response =
        await fetch(
          "/api/admin/dashboard",
          {
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },

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
            "Unable to load dashboard"
        );
      }

      setDashboard(
        result
      );
    } catch (
      error
    ) {
      console.error(
        "ADMIN DASHBOARD ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to load dashboard"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  /* =======================================================
     FIRST LOAD
  ======================================================= */

  useEffect(() => {
    void loadDashboard();
  }, []);

  /* =======================================================
     ACTIVE PRODUCTION
  ======================================================= */

  const activeProduction =
    useMemo(() => {
      if (
        !dashboard
      ) {
        return 0;
      }

      const production =
        dashboard
          .stats
          .production;

      return (
        production.CRAFTED +
        production.PRODUCTION +
        production.QC +
        production.PACKING +
        production.SHIPPED
      );
    }, [
      dashboard,
    ]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">

          <p className="text-orange-400 tracking-[0.35em] animate-pulse">
            LOADING ADMIN...
          </p>

        </div>

      </main>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      {/* ===================================================
          BACKGROUND
      =================================================== */}

      <div className="fixed inset-0 pointer-events-none overflow-hidden">

        <div className="absolute left-1/2 top-[-420px] h-[900px] w-[1200px] -translate-x-1/2 rounded-full bg-orange-500/[0.05] blur-[190px]" />

        <div className="absolute bottom-[-420px] left-[-300px] h-[800px] w-[800px] rounded-full bg-cyan-500/[0.05] blur-[190px]" />

        <div className="absolute bottom-[-420px] right-[-300px] h-[800px] w-[800px] rounded-full bg-purple-500/[0.05] blur-[190px]" />

      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">

        {/* =================================================
            HEADER
        ================================================= */}

        <section>

          <p className="text-orange-400 text-[9px] tracking-[0.3em]">
            LOOTFORM CONTROL SYSTEM
          </p>

          <div className="flex items-end justify-between gap-5 flex-wrap mt-2">

            <div>

              <h1 className="text-4xl sm:text-6xl font-black">
                ADMIN{" "}

                <span className="text-orange-400">
                  DASHBOARD
                </span>
              </h1>

              {dashboard && (
                <p className="text-zinc-500 text-sm mt-3">
                  {
                    dashboard
                      .admin
                      .email
                  }
                </p>
              )}

            </div>

            <button
              type="button"
              onClick={() =>
                void loadDashboard()
              }
              className="border border-zinc-800 px-5 py-3 rounded-xl text-xs font-black hover:border-cyan-400 hover:text-cyan-400 transition"
            >
              REFRESH
            </button>

          </div>

        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">

            {errorMessage}

          </div>
        )}

        {/* =================================================
            DASHBOARD
        ================================================= */}

        {dashboard && (
          <>

            {/* ===============================================
                BIG STATS
            =============================================== */}

            <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-9">

              <BigStat
                label="TOTAL LOOT"
                value={
                  dashboard
                    .stats
                    .totalItems
                }
                suffix="ITEMS"
                className="text-cyan-400"
              />

              <BigStat
                label="ACTIVE PRODUCTION"
                value={
                  activeProduction
                }
                suffix="ITEMS"
                className="text-orange-400"
              />

              <BigStat
                label="PLAYER WALLETS"
                value={
                  dashboard
                    .stats
                    .totalWallets
                }
                suffix="WALLETS"
                className="text-purple-400"
              />

              <BigStat
                label="TOKEN IN SYSTEM"
                value={
                  dashboard
                    .stats
                    .totalWalletBalance
                }
                suffix="LT"
                className="text-lime-400"
              />

            </section>

            {/* ===============================================
                STATUS
            =============================================== */}

            <section className="grid xl:grid-cols-2 gap-6 mt-6">

              {/* =============================================
                  RARITY
              ============================================= */}

              <div className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6">

                <p className="text-cyan-400 text-[9px] tracking-[0.3em]">
                  LOOT DISTRIBUTION
                </p>

                <h2 className="text-2xl font-black mt-2">
                  RARITY STATUS
                </h2>

                <div className="grid grid-cols-2 gap-3 mt-6">

                  <SmallStat
                    label="COMMON"
                    value={
                      dashboard
                        .stats
                        .grade
                        .COMMON
                    }
                    className="text-zinc-200"
                  />

                  <SmallStat
                    label="RARE"
                    value={
                      dashboard
                        .stats
                        .grade
                        .RARE
                    }
                    className="text-cyan-400"
                  />

                  <SmallStat
                    label="EPIC"
                    value={
                      dashboard
                        .stats
                        .grade
                        .EPIC
                    }
                    className="text-purple-400"
                  />

                  <SmallStat
                    label="LEGENDARY"
                    value={
                      dashboard
                        .stats
                        .grade
                        .LEGENDARY
                    }
                    className="text-orange-400"
                  />

                </div>

              </div>

              {/* =============================================
                  PRODUCTION
              ============================================= */}

              <div className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6">

                <p className="text-orange-400 text-[9px] tracking-[0.3em]">
                  PHYSICAL PIPELINE
                </p>

                <h2 className="text-2xl font-black mt-2">
                  PRODUCTION
                </h2>

                <div className="space-y-3 mt-6">

                  {Object.entries(
                    dashboard
                      .stats
                      .production
                  ).map(
                    ([
                      key,
                      value,
                    ]) => (
                      <div
                        key={
                          key
                        }
                        className="border border-zinc-800 bg-black/40 rounded-xl px-4 py-3 flex justify-between"
                      >

                        <p className="text-zinc-500 text-xs font-black">
                          {key}
                        </p>

                        <p className="text-white font-black">
                          {value}
                        </p>

                      </div>
                    )
                  )}

                </div>

              </div>

            </section>

            {/* ===============================================
                ADMIN CONTROL CENTER
            =============================================== */}

            <section className="mt-8">

              <div className="flex items-end justify-between gap-5 flex-wrap">

                <div>

                  <p className="text-purple-400 text-[9px] tracking-[0.3em]">
                    BACKEND SYSTEMS
                  </p>

                  <h2 className="text-2xl sm:text-3xl font-black mt-2">
                    ADMIN CONTROL CENTER
                  </h2>

                  <p className="text-zinc-600 text-xs mt-2">
                    All LOOTFORM backend systems are accessible from here.
                  </p>

                </div>

              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">

                {/* ===========================================
                    PRODUCTION
                =========================================== */}

                <ControlCard
                  title="PRODUCTION"
                  description="Physical item workflow, QC, packing, shipping and tracking."
                  button="OPEN PRODUCTION"
                  accent="orange"
                  onClick={() =>
                    router.push(
                      "/admin/production"
                    )
                  }
                />

                {/* ===========================================
                    PLAYERS
                =========================================== */}

                <ControlCard
                  title="PLAYERS"
                  description="Player accounts, collections and player activity."
                  button="OPEN PLAYERS"
                  accent="cyan"
                  onClick={() =>
                    router.push(
                      "/admin/players"
                    )
                  }
                />

                {/* ===========================================
                    WALLETS
                =========================================== */}

                <ControlCard
                  title="WALLETS"
                  description="LOOT TOKEN balances, transactions and wallet activity."
                  button="OPEN WALLETS"
                  accent="lime"
                  onClick={() =>
                    router.push(
                      "/admin/wallets"
                    )
                  }
                />

                {/* ===========================================
                    TOP-UP
                =========================================== */}

                <ControlCard
                  title="TOP-UP"
                  description="Bank/QR settings, packages, and pending slip review."
                  button="OPEN TOP-UP"
                  accent="lime"
                  onClick={() =>
                    router.push(
                      "/admin/topup"
                    )
                  }
                />

                {/* ===========================================
                    SHOP (plain, non-random)
                =========================================== */}

                <ControlCard
                  title="SHOP"
                  description="Plain-priced catalog with no grade roll, plus order slip review."
                  button="OPEN SHOP"
                  accent="cyan"
                  onClick={() =>
                    router.push(
                      "/admin/shop"
                    )
                  }
                />

                {/* ===========================================
                    SEASON
                =========================================== */}

                <ControlCard
                  title="SEASON"
                  description="Drop status, rarity probabilities and active Season rules."
                  button="OPEN SEASON"
                  accent="purple"
                  onClick={() =>
                    router.push(
                      "/admin/season"
                    )
                  }
                />

                {/* ===========================================
                    PRODUCT CATALOG
                =========================================== */}

                <ControlCard
                  title="PRODUCT CATALOG"
                  description="Products, Designs, Grade Assets, craft cost, sizes and collectible identity."
                  button="OPEN PRODUCT CATALOG"
                  accent="cyan"
                  onClick={() =>
                    router.push(
                      "/admin/products"
                    )
                  }
                />

                {/* ===========================================
                    CHARACTER LIBRARY
                =========================================== */}

                <ControlCard
                  title="CHARACTER LIBRARY"
                  description="Base Characters, preview artwork, GLB models, publishing and Default Character."
                  button="OPEN CHARACTER LIBRARY"
                  accent="purple"
                  onClick={() =>
                    router.push(
                      "/admin/characters"
                    )
                  }
                />

                {/* ===========================================
                    BETA CONTROL
                =========================================== */}

                <ControlCard
                  title="BETA CONTROL"
                  description="TEST environment inspection and controlled Beta data reset."
                  button="OPEN BETA CONTROL"
                  accent="yellow"
                  onClick={() =>
                    router.push(
                      "/admin/beta"
                    )
                  }
                />

              </div>

            </section>

          </>
        )}

      </div>

    </main>
  );
}

/* =========================================================
   BIG STAT
========================================================= */

function BigStat({
  label,
  value,
  suffix,
  className,
}: {
  label: string;

  value: number;

  suffix: string;

  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/75 rounded-2xl p-5">

      <p className="text-zinc-600 text-[8px]">
        {label}
      </p>

      <p
        className={`text-4xl font-black mt-2 ${className}`}
      >
        {value}
      </p>

      <p className="text-zinc-700 text-[8px] mt-1">
        {suffix}
      </p>

    </div>
  );
}

/* =========================================================
   SMALL STAT
========================================================= */

function SmallStat({
  label,
  value,
  className,
}: {
  label: string;

  value: number;

  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-5">

      <p
        className={`text-[9px] font-black ${className}`}
      >
        {label}
      </p>

      <p className="text-white text-3xl font-black mt-2">
        {value}
      </p>

    </div>
  );
}

/* =========================================================
   CONTROL CARD
========================================================= */

function ControlCard({
  title,
  description,
  button,
  accent,
  onClick,
}: {
  title: string;

  description: string;

  button: string;

  accent:
    | "orange"
    | "cyan"
    | "lime"
    | "purple"
    | "yellow";

  onClick:
    () => void;
}) {
  const style =
    accent ===
    "cyan"
      ? {
          border:
            "border-cyan-400/20 hover:border-cyan-400/45",

          text:
            "text-cyan-400",

          button:
            "border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-400 hover:bg-cyan-400/10",
        }
      : accent ===
        "lime"
      ? {
          border:
            "border-lime-400/20 hover:border-lime-400/45",

          text:
            "text-lime-400",

          button:
            "border-lime-400/25 bg-lime-400/[0.06] text-lime-400 hover:bg-lime-400/10",
        }
      : accent ===
        "purple"
      ? {
          border:
            "border-purple-400/20 hover:border-purple-400/45",

          text:
            "text-purple-400",

          button:
            "border-purple-400/25 bg-purple-400/[0.06] text-purple-400 hover:bg-purple-400/10",
        }
      : accent ===
        "yellow"
      ? {
          border:
            "border-yellow-400/20 hover:border-yellow-400/45",

          text:
            "text-yellow-400",

          button:
            "border-yellow-400/25 bg-yellow-400/[0.06] text-yellow-400 hover:bg-yellow-400/10",
        }
      : {
          border:
            "border-orange-400/20 hover:border-orange-400/45",

          text:
            "text-orange-400",

          button:
            "border-orange-400/25 bg-orange-400/[0.06] text-orange-400 hover:bg-orange-400/10",
        };

  return (
    <div
      className={`
        flex
        min-h-[220px]
        flex-col
        rounded-2xl
        border
        bg-zinc-950/75
        p-5
        transition
        ${style.border}
      `}
    >

      <p
        className={`
          text-[8px]
          font-black
          tracking-[0.2em]
          ${style.text}
        `}
      >
        LOOTFORM SYSTEM
      </p>

      <h3 className="text-xl font-black mt-3">
        {title}
      </h3>

      <p className="mt-3 flex-1 text-xs leading-6 text-zinc-600">
        {description}
      </p>

      <button
        type="button"
        onClick={
          onClick
        }
        className={`
          w-full
          mt-5
          rounded-xl
          border
          py-3
          text-xs
          font-black
          transition
          ${style.button}
        `}
      >
        {button}
      </button>

    </div>
  );
}