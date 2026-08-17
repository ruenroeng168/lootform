"use client";

import {
  useEffect,
  useMemo,
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

export default function AdminDashboardPage() {
  const router = useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    dashboard,
    setDashboard,
  ] =
    useState<
      DashboardData | null
    >(null);

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
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
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.message
        );
      }

      setDashboard(
        result
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const activeProduction =
    useMemo(() => {
      if (!dashboard) {
        return 0;
      }

      const production =
        dashboard.stats.production;

      return (
        production.CRAFTED +
        production.PRODUCTION +
        production.QC +
        production.PACKING +
        production.SHIPPED
      );
    }, [dashboard]);

  if (loading) {
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

  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-10">

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
                  {dashboard.admin.email}
                </p>
              )}

            </div>

            <button
              onClick={
                loadDashboard
              }
              className="border border-zinc-800 px-5 py-3 rounded-xl text-xs font-black hover:border-cyan-400 hover:text-cyan-400"
            >
              REFRESH
            </button>

          </div>

        </section>

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">
            {errorMessage}
          </div>
        )}

        {dashboard && (
          <>

            <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-9">

              <BigStat
                label="TOTAL LOOT"
                value={
                  dashboard.stats.totalItems
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
                  dashboard.stats.totalWallets
                }
                suffix="WALLETS"
                className="text-purple-400"
              />

              <BigStat
                label="TOKEN IN SYSTEM"
                value={
                  dashboard.stats.totalWalletBalance
                }
                suffix="LT"
                className="text-lime-400"
              />

            </section>

            <section className="grid xl:grid-cols-2 gap-6 mt-6">

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
                      dashboard.stats.grade.COMMON
                    }
                    className="text-zinc-200"
                  />

                  <SmallStat
                    label="RARE"
                    value={
                      dashboard.stats.grade.RARE
                    }
                    className="text-cyan-400"
                  />

                  <SmallStat
                    label="EPIC"
                    value={
                      dashboard.stats.grade.EPIC
                    }
                    className="text-purple-400"
                  />

                  <SmallStat
                    label="LEGENDARY"
                    value={
                      dashboard.stats.grade.LEGENDARY
                    }
                    className="text-orange-400"
                  />

                </div>

              </div>

              <div className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6">

                <p className="text-orange-400 text-[9px] tracking-[0.3em]">
                  PHYSICAL PIPELINE
                </p>

                <h2 className="text-2xl font-black mt-2">
                  PRODUCTION
                </h2>

                <div className="space-y-3 mt-6">

                  {Object.entries(
                    dashboard.stats.production
                  ).map(
                    ([key, value]) => (
                      <div
                        key={key}
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

            <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">

              <ControlCard
                title="PRODUCTION"
                button="OPEN PRODUCTION"
                onClick={() =>
                  router.push(
                    "/admin/production"
                  )
                }
              />

              <ControlCard
                title="PLAYERS"
                button="OPEN PLAYERS"
                onClick={() =>
                  router.push(
                    "/admin/players"
                  )
                }
              />

              <ControlCard
                title="WALLETS"
                button="OPEN WALLETS"
                onClick={() =>
                  router.push(
                    "/admin/wallets"
                  )
                }
              />

              <ControlCard
                title="SEASON"
                button="OPEN SEASON"
                onClick={() =>
                  router.push(
                    "/admin/season"
                  )
                }
              />

            </section>

          </>
        )}

      </div>

    </main>
  );
}

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

function ControlCard({
  title,
  button,
  onClick,
}: {
  title: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/75 rounded-2xl p-5">

      <h3 className="text-xl font-black">
        {title}
      </h3>

      <button
        onClick={onClick}
        className="w-full mt-5 bg-orange-400 text-black py-3 rounded-xl text-xs font-black hover:bg-orange-300"
      >
        {button}
      </button>

    </div>
  );
}