"use client";

import Image from "next/image";
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

type Item = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: Grade;
  level: number;
  size: string | null;
  created_at: string;
};

const productImages: Record<
  Grade,
  string
> = {
  COMMON: "/products/common.png",
  RARE: "/products/rare.png",
  EPIC: "/products/epic.png",
  LEGENDARY: "/products/legendary.png",
};

const gradeText: Record<
  Grade,
  string
> = {
  COMMON: "text-zinc-200",
  RARE: "text-cyan-400",
  EPIC: "text-purple-400",
  LEGENDARY: "text-orange-400",
};

export default function HomePage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [userEmail, setUserEmail] =
    useState("");

  const [
    walletBalance,
    setWalletBalance,
  ] = useState(0);

  const [items, setItems] =
    useState<Item[]>([]);

  useEffect(() => {
    async function loadHome() {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        router.push("/login");
        return;
      }

      setUserEmail(
        user.email ?? "PLAYER"
      );

      const {
        data: wallet,
        error: walletError,
      } = await supabase
        .from("wallets")
        .select("balance")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

      if (walletError) {
        console.error(
          "HOME WALLET ERROR:",
          walletError
        );
      }

      setWalletBalance(
        wallet?.balance ?? 0
      );

      const {
        data: itemData,
        error: itemError,
      } = await supabase
        .from("items")
        .select(`
          id,
          serial,
          product,
          season,
          grade,
          level,
          size,
          created_at
        `)
        .eq(
          "owner_id",
          user.id
        )
        .order("id", {
          ascending: false,
        });

      if (itemError) {
        console.error(
          "HOME ITEMS ERROR:",
          itemError
        );
      }

      setItems(
        (itemData ?? []) as Item[]
      );

      setLoading(false);
    }

    loadHome();
  }, [router]);

  const stats = useMemo(() => {
    return {
      total: items.length,

      COMMON: items.filter(
        (item) =>
          item.grade === "COMMON"
      ).length,

      RARE: items.filter(
        (item) =>
          item.grade === "RARE"
      ).length,

      EPIC: items.filter(
        (item) =>
          item.grade === "EPIC"
      ).length,

      LEGENDARY: items.filter(
        (item) =>
          item.grade ===
          "LEGENDARY"
      ).length,
    };
  }, [items]);

  const latestItems =
    items.slice(0, 4);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-cyan-400 tracking-[0.35em] animate-pulse">
            LOADING HOME...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <Navbar />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-300px] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full bg-cyan-500/10 blur-[180px]" />

        <div className="absolute bottom-[-350px] left-[-250px] w-[700px] h-[700px] rounded-full bg-purple-500/10 blur-[180px]" />

        <div className="absolute bottom-[-350px] right-[-250px] w-[700px] h-[700px] rounded-full bg-lime-400/5 blur-[180px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

        {/* PLAYER BAR */}

        <div className="flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-3">

            <div className="w-11 h-11 rounded-xl border border-cyan-400/30 bg-cyan-400/5 flex items-center justify-center text-cyan-400 font-black">
              P1
            </div>

            <div>
              <p className="text-zinc-600 text-[9px] tracking-[0.25em]">
                PLAYER
              </p>

              <p className="text-cyan-400 text-sm mt-1">
                {userEmail}
              </p>
            </div>

          </div>

          <div className="flex items-center gap-3 flex-wrap">

            <button
              onClick={() =>
                router.push(
                  "/wallet"
                )
              }
              className="border border-zinc-800 bg-black/40 rounded-xl px-5 py-3 text-left hover:border-lime-400 transition"
            >
              <p className="text-zinc-600 text-[9px] tracking-[0.2em]">
                WALLET
              </p>

              <p className="text-lime-400 text-lg font-black">
                {walletBalance} LT
              </p>
            </button>

            <button
              onClick={() =>
                router.push(
                  "/collection"
                )
              }
              className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-bold hover:border-cyan-400 hover:text-cyan-400 transition"
            >
              MY COLLECTION
            </button>

          </div>
        </div>

        {/* HERO */}

        <section className="grid lg:grid-cols-2 gap-6 mt-10">

          <div className="relative overflow-hidden border border-cyan-400/20 bg-zinc-950/75 rounded-[30px] p-8 sm:p-10">

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/[0.05] via-transparent to-purple-400/[0.05]" />

            <div className="relative z-10">

              <div className="inline-flex items-center gap-2 border border-cyan-400/20 bg-cyan-400/5 rounded-full px-4 py-2">

                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />

                <span className="text-cyan-400 text-[9px] tracking-[0.3em]">
                  LOOTFORM SYSTEM ONLINE
                </span>

              </div>

              <h1 className="text-5xl sm:text-7xl font-black leading-[0.95] mt-8">
                DIGITAL
                <br />

                <span className="text-cyan-400">
                  LOOT.
                </span>
                <br />

                PHYSICAL
                <br />

                <span className="text-purple-400">
                  FORM.
                </span>
              </h1>

              <p className="text-zinc-500 leading-7 mt-7 max-w-lg">
                Craft physical loot, unlock rarity and build your LOOTFORM collection.
              </p>

              <div className="flex gap-3 flex-wrap mt-8">

                <button
                  onClick={() =>
                    router.push(
                      "/craft"
                    )
                  }
                  className="bg-lime-400 text-black px-8 py-4 rounded-xl text-sm font-black hover:bg-lime-300 transition"
                >
                  CRAFT NOW
                </button>

                <button
                  onClick={() =>
                    router.push(
                      "/collection"
                    )
                  }
                  className="border border-zinc-700 text-zinc-300 px-8 py-4 rounded-xl text-sm font-black hover:border-cyan-400 hover:text-cyan-400 transition"
                >
                  VIEW COLLECTION
                </button>

              </div>

            </div>
          </div>

          {/* ACTIVE DROP CHARACTER */}

          <div className="relative overflow-hidden border border-orange-400/20 bg-zinc-950/75 rounded-[30px] p-6 sm:p-8">

            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/[0.05] via-transparent to-black" />

            <div className="relative z-10">

              <div className="flex items-start justify-between gap-5">

                <div>

                  <p className="text-orange-400 text-[9px] tracking-[0.3em]">
                    ACTIVE DROP
                  </p>

                  <h2 className="text-3xl font-black mt-2">
                    POWER-UP TEE
                  </h2>

                  <p className="text-zinc-600 text-[9px] tracking-[0.25em] mt-2">
                    SEASON 001
                  </p>

                </div>

                <div className="border border-lime-400/30 bg-lime-400/[0.05] text-lime-400 rounded-full px-4 py-2 text-[9px] font-black">
                  ACTIVE
                </div>

              </div>

              <div className="relative h-[470px] mt-4 flex items-center justify-center">

                <Image
                  src="/characters/home-hero.png"
                  alt="LOOTFORM Character"
                  width={900}
                  height={1200}
                  priority
                  className="w-full h-full object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.9)]"
                />

              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">

                <InfoBox
                  label="SEASON"
                  value="S01"
                  className="text-cyan-400"
                />

                <InfoBox
                  label="CRAFT COST"
                  value="100 LT"
                  className="text-lime-400"
                />

                <InfoBox
                  label="TOP RARITY"
                  value="LEGENDARY"
                  className="text-orange-400"
                />

              </div>

            </div>

          </div>

        </section>

        {/* STATS */}

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">

          <StatCard
            label="TOTAL ITEMS"
            value={stats.total}
            className="text-white"
          />

          <StatCard
            label="COMMON"
            value={stats.COMMON}
            className="text-zinc-200"
          />

          <StatCard
            label="RARE"
            value={stats.RARE}
            className="text-cyan-400"
          />

          <StatCard
            label="EPIC"
            value={stats.EPIC}
            className="text-purple-400"
          />

          <StatCard
            label="LEGENDARY"
            value={stats.LEGENDARY}
            className="text-orange-400"
          />

        </section>

        {/* LATEST */}

        <section className="mt-7 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

          <div className="flex items-end justify-between gap-5 flex-wrap">

            <div>

              <p className="text-purple-400 text-[9px] tracking-[0.3em]">
                PLAYER FEED
              </p>

              <h2 className="text-2xl font-black mt-2">
                LATEST LOOT
              </h2>

            </div>

            <button
              onClick={() =>
                router.push(
                  "/collection"
                )
              }
              className="text-cyan-400 text-xs font-black"
            >
              VIEW ALL →
            </button>

          </div>

          {latestItems.length === 0 ? (
            <div className="mt-6 border border-zinc-800 bg-black/40 rounded-xl p-10 text-center">

              <p className="text-zinc-600">
                NO LOOT YET
              </p>

            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">

              {latestItems.map(
                (item) => (
                  <div
                    key={item.id}
                    className="border border-zinc-800 bg-black/40 rounded-2xl p-4"
                  >

                    <div className="relative h-[170px]">

                      <Image
                        src={
                          productImages[
                            item.grade
                          ]
                        }
                        alt={
                          item.product
                        }
                        width={300}
                        height={350}
                        className="w-full h-full object-contain"
                      />

                    </div>

                    <p
                      className={`
                        text-[9px]
                        font-black
                        tracking-[0.2em]
                        ${gradeText[item.grade]}
                      `}
                    >
                      {item.grade}
                    </p>

                    <p className="text-white font-black mt-2">
                      {item.product}
                    </p>

                    <p className="text-cyan-400 font-mono text-xs mt-2">
                      {item.serial}
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-3">

                      <InfoBox
                        label="SIZE"
                        value={
                          item.size ?? "-"
                        }
                        className="text-white"
                      />

                      <InfoBox
                        label="LEVEL"
                        value={`LVL ${String(
                          item.level
                        ).padStart(
                          2,
                          "0"
                        )}`}
                        className="text-white"
                      />

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </section>

      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/75 rounded-2xl p-5">

      <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
        {label}
      </p>

      <p
        className={`text-3xl font-black mt-2 ${className}`}
      >
        {value}
      </p>

    </div>
  );
}

function InfoBox({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-3">

      <p className="text-zinc-600 text-[7px] tracking-[0.15em]">
        {label}
      </p>

      <p
        className={`text-xs font-black mt-1 ${className}`}
      >
        {value}
      </p>

    </div>
  );
}