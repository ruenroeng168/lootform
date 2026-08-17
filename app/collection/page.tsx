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

type ProductionStatus =
  | "CRAFTED"
  | "PRODUCTION"
  | "QC"
  | "PACKING"
  | "SHIPPED"
  | "DELIVERED";

type Item = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: Grade;
  level: number;
  size: string | null;
  created_at: string;

  production_status:
    ProductionStatus;

  tracking_number:
    string | null;

  production_updated_at:
    string;
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

const gradeBorder: Record<
  Grade,
  string
> = {
  COMMON: "border-zinc-700",
  RARE: "border-cyan-400/50",
  EPIC: "border-purple-400/50",
  LEGENDARY: "border-orange-400/50",
};

const productionSteps:
  ProductionStatus[] = [
    "CRAFTED",
    "PRODUCTION",
    "QC",
    "PACKING",
    "SHIPPED",
    "DELIVERED",
  ];

export default function CollectionPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [items, setItems] =
    useState<Item[]>([]);

  const [
    userEmail,
    setUserEmail,
  ] = useState("");

  const [
    walletBalance,
    setWalletBalance,
  ] = useState(0);

  useEffect(() => {
    async function loadCollection() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserEmail(
        user.email ?? "PLAYER"
      );

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

      const {
        data,
        error,
      } = await supabase
        .from("items")
        .select("*")
        .eq(
          "owner_id",
          user.id
        )
        .order("id", {
          ascending: false,
        });

      if (error) {
        console.error(
          "COLLECTION ERROR:",
          error
        );
      }

      setItems(
        (data ?? []) as Item[]
      );

      setLoading(false);
    }

    loadCollection();
  }, [router]);

  const stats =
    useMemo(() => {
      return {
        total: items.length,

        COMMON: items.filter(
          (item) =>
            item.grade ===
            "COMMON"
        ).length,

        RARE: items.filter(
          (item) =>
            item.grade ===
            "RARE"
        ).length,

        EPIC: items.filter(
          (item) =>
            item.grade ===
            "EPIC"
        ).length,

        LEGENDARY: items.filter(
          (item) =>
            item.grade ===
            "LEGENDARY"
        ).length,
      };
    }, [items]);

  function getProgress(
    status: ProductionStatus
  ) {
    const index =
      productionSteps.indexOf(
        status
      );

    return (
      ((index + 1) /
        productionSteps.length) *
      100
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-cyan-400 tracking-[0.35em] animate-pulse">
            LOADING COLLECTION...
          </p>
        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">

      <Navbar />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

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

          <div className="flex items-center gap-3">

            <button
              onClick={() =>
                router.push(
                  "/wallet"
                )
              }
              className="border border-zinc-800 bg-black/40 rounded-xl px-5 py-3"
            >
              <p className="text-zinc-600 text-[8px]">
                WALLET
              </p>

              <p className="text-lime-400 font-black">
                {walletBalance} LT
              </p>
            </button>

            <button
              onClick={() =>
                router.push(
                  "/craft"
                )
              }
              className="border border-zinc-800 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
            >
              CRAFT NEW ITEM
            </button>

          </div>

        </div>

        <section className="text-center mt-12">

          <p className="text-purple-400 text-[9px] tracking-[0.35em]">
            PLAYER INVENTORY
          </p>

          <h1 className="text-5xl sm:text-7xl font-black mt-4">
            MY{" "}
            <span className="text-cyan-400">
              COLLECTION
            </span>
          </h1>

        </section>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-10">

          <CollectionStat
            label="TOTAL"
            value={stats.total}
            className="text-white"
          />

          <CollectionStat
            label="COMMON"
            value={
              stats.COMMON
            }
            className="text-zinc-200"
          />

          <CollectionStat
            label="RARE"
            value={stats.RARE}
            className="text-cyan-400"
          />

          <CollectionStat
            label="EPIC"
            value={stats.EPIC}
            className="text-purple-400"
          />

          <CollectionStat
            label="LEGENDARY"
            value={
              stats.LEGENDARY
            }
            className="text-orange-400"
          />

        </section>

        <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">

          {items.map((item) => {
            const progress =
              getProgress(
                item.production_status ??
                  "CRAFTED"
              );

            return (
              <article
                key={item.id}
                className={`
                  border
                  rounded-[26px]
                  bg-zinc-950/75
                  p-5
                  ${gradeBorder[item.grade]}
                `}
              >

                <div className="flex items-start justify-between">

                  <div>

                    <p className="text-zinc-600 text-[8px]">
                      RARITY
                    </p>

                    <p
                      className={`
                        text-xl
                        font-black
                        mt-1
                        ${gradeText[item.grade]}
                      `}
                    >
                      {item.grade}
                    </p>

                  </div>

                  <div className="border border-lime-400/20 bg-lime-400/5 text-lime-400 rounded-full px-3 py-1.5 text-[8px] font-black">
                    OWNED
                  </div>

                </div>

                <div className="h-[280px] mt-2">

                  <Image
                    src={
                      productImages[
                        item.grade
                      ]
                    }
                    alt={
                      item.product
                    }
                    width={600}
                    height={700}
                    className="w-full h-full object-contain"
                  />

                </div>

                <div className="text-center">

                  <p className="text-white text-xl font-black">
                    {item.product}
                  </p>

                  <p className="text-zinc-600 text-[9px] mt-2">
                    SEASON {item.season}
                  </p>

                </div>

                <div className="mt-5 border border-zinc-800 bg-black/50 rounded-xl p-4">

                  <p className="text-zinc-600 text-[8px]">
                    ITEM ID
                  </p>

                  <p className="text-cyan-400 font-mono font-bold mt-2">
                    {item.serial}
                  </p>

                </div>

                <div className="grid grid-cols-3 gap-2 mt-2">

                  <MiniInfo
                    label="SIZE"
                    value={
                      item.size ?? "-"
                    }
                  />

                  <MiniInfo
                    label="LEVEL"
                    value={`LVL ${String(
                      item.level
                    ).padStart(
                      2,
                      "0"
                    )}`}
                  />

                  <MiniInfo
                    label="DROP"
                    value={
                      item.season
                    }
                  />

                </div>

                <div className="mt-4 border border-zinc-800 bg-black/50 rounded-xl p-4">

                  <div className="flex justify-between">

                    <div>

                      <p className="text-zinc-600 text-[8px]">
                        PRODUCTION
                      </p>

                      <p className="text-white text-sm font-black mt-1">
                        {
                          item.production_status
                        }
                      </p>

                    </div>

                    <p className="text-cyan-400 text-xs font-black">
                      {Math.round(
                        progress
                      )}
                      %
                    </p>

                  </div>

                  <div className="h-1.5 bg-zinc-900 rounded-full mt-4 overflow-hidden">

                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-purple-400 to-lime-400"
                      style={{
                        width:
                          `${progress}%`,
                      }}
                    />

                  </div>

                  {(item.production_status ===
                    "SHIPPED" ||
                    item.production_status ===
                      "DELIVERED") && (
                    <div className="mt-4 border-t border-zinc-900 pt-4">

                      <p className="text-zinc-600 text-[8px]">
                        TRACKING
                      </p>

                      <p className="text-lime-400 font-mono text-xs font-black mt-2">
                        {item.tracking_number ??
                          "WAITING"}
                      </p>

                    </div>
                  )}

                </div>

              </article>
            );
          })}

        </section>

      </div>

    </main>
  );
}

function CollectionStat({
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

      <p className="text-zinc-600 text-[8px]">
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

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-3">

      <p className="text-zinc-600 text-[7px]">
        {label}
      </p>

      <p className="text-white text-xs font-black mt-1">
        {value}
      </p>

    </div>
  );
}