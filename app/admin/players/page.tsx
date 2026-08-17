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

type PlayerItem = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: Grade;
  level: number;
  size: string | null;
  production_status: string;
};

type Player = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at:
    string | null;

  wallet: {
    balance: number;
  };

  stats: {
    totalItems: number;

    grade: {
      COMMON: number;
      RARE: number;
      EPIC: number;
      LEGENDARY: number;
    };
  };

  items: PlayerItem[];
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

export default function AdminPlayersPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [search, setSearch] =
    useState("");

  const [
    selectedPlayerId,
    setSelectedPlayerId,
  ] =
    useState<
      string | null
    >(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function loadPlayers() {
    setLoading(true);

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
          "/api/admin/players",
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

      setPlayers(
        result.players ?? []
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load players"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlayers();
  }, []);

  const filteredPlayers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return players;
      }

      return players.filter(
        (player) =>
          player.email
            .toLowerCase()
            .includes(query)
      );
    }, [players, search]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-purple-400 tracking-[0.35em] animate-pulse">
            LOADING PLAYERS...
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

          <p className="text-purple-400 text-[9px] tracking-[0.3em]">
            PLAYER DATABASE
          </p>

          <div className="flex items-end justify-between gap-5 flex-wrap">

            <h1 className="text-4xl sm:text-6xl font-black mt-2">
              PLAYER{" "}
              <span className="text-purple-400">
                CONTROL
              </span>
            </h1>

            <button
              onClick={() =>
                router.push(
                  "/admin"
                )
              }
              className="border border-zinc-800 px-5 py-3 rounded-xl text-xs font-black hover:border-orange-400 hover:text-orange-400"
            >
              ← ADMIN
            </button>

          </div>

        </section>

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">
            {errorMessage}
          </div>
        )}

        <section className="mt-6">

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search email"
            className="w-full border border-zinc-800 bg-zinc-950 rounded-xl px-4 py-4 outline-none focus:border-purple-400"
          />

        </section>

        <section className="space-y-4 mt-6">

          {filteredPlayers.map(
            (player) => {
              const expanded =
                selectedPlayerId ===
                player.id;

              return (
                <article
                  key={player.id}
                  className="border border-zinc-800 bg-zinc-950/75 rounded-[24px] overflow-hidden"
                >

                  <div className="p-5 flex items-center justify-between gap-5 flex-wrap">

                    <div>

                      <p className="text-zinc-600 text-[8px]">
                        PLAYER ACCOUNT
                      </p>

                      <p className="text-white font-black mt-1">
                        {player.email}
                      </p>

                      <p className="text-zinc-700 text-[8px] font-mono mt-2">
                        {player.id}
                      </p>

                    </div>

                    <div className="flex items-center gap-3">

                      <div className="border border-lime-400/20 rounded-xl px-4 py-3">

                        <p className="text-zinc-600 text-[8px]">
                          WALLET
                        </p>

                        <p className="text-lime-400 font-black">
                          {
                            player.wallet.balance
                          }{" "}
                          LT
                        </p>

                      </div>

                      <button
                        onClick={() =>
                          setSelectedPlayerId(
                            expanded
                              ? null
                              : player.id
                          )
                        }
                        className="border border-zinc-800 px-5 py-4 rounded-xl text-xs font-black hover:border-purple-400 hover:text-purple-400"
                      >
                        {expanded
                          ? "CLOSE"
                          : "VIEW PLAYER"}
                      </button>

                    </div>

                  </div>

                  <div className="grid grid-cols-4 border-t border-zinc-900">

                    <GradeMetric
                      label="COMMON"
                      value={
                        player.stats.grade.COMMON
                      }
                      className="text-zinc-200"
                    />

                    <GradeMetric
                      label="RARE"
                      value={
                        player.stats.grade.RARE
                      }
                      className="text-cyan-400"
                    />

                    <GradeMetric
                      label="EPIC"
                      value={
                        player.stats.grade.EPIC
                      }
                      className="text-purple-400"
                    />

                    <GradeMetric
                      label="LEGENDARY"
                      value={
                        player.stats.grade.LEGENDARY
                      }
                      className="text-orange-400"
                    />

                  </div>

                  {expanded && (
                    <div className="border-t border-zinc-900 p-5">

                      <p className="text-purple-400 text-[9px]">
                        COLLECTION
                      </p>

                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">

                        {player.items.map(
                          (item) => (
                            <div
                              key={
                                item.id
                              }
                              className="border border-zinc-800 bg-black/40 rounded-xl p-4"
                            >

                              <div className="h-[150px]">

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
                                className={`text-[9px] font-black ${gradeText[item.grade]}`}
                              >
                                {item.grade}
                              </p>

                              <p className="text-white font-black mt-1">
                                {item.serial}
                              </p>

                              <p className="text-zinc-600 text-[9px] mt-2">
                                SIZE{" "}
                                {item.size ??
                                  "-"}{" "}
                                · LVL{" "}
                                {item.level}
                              </p>

                            </div>
                          )
                        )}

                      </div>

                    </div>
                  )}

                </article>
              );
            }
          )}

        </section>

      </div>

    </main>
  );
}

function GradeMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="p-4 border-r border-zinc-900 last:border-r-0">

      <p
        className={`text-[8px] font-black ${className}`}
      >
        {label}
      </p>

      <p className="text-white text-2xl font-black mt-2">
        {value}
      </p>

    </div>
  );
}