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

type WalletTransaction = {
  id: number;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  item_id: number | null;
  created_at: string;
};

type AdminWallet = {
  id: number;
  user_id: string;
  email: string;
  balance: number;
  created_at: string;
  updated_at: string;

  totalTopup: number;
  totalSpent: number;
  transactionCount: number;

  transactions:
    WalletTransaction[];
};

type WalletData = {
  admin: {
    email: string;
  };

  stats: {
    totalWallets: number;
    totalBalance: number;
    totalTopup: number;
    totalSpent: number;
    transactionCount: number;
  };

  wallets:
    AdminWallet[];

  recentTransactions:
    WalletTransaction[];
};

export default function AdminWalletsPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    data,
    setData,
  ] =
    useState<
      WalletData | null
    >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    selectedWalletId,
    setSelectedWalletId,
  ] =
    useState<
      number | null
    >(null);

  async function loadWallets() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push(
          "/login"
        );

        return;
      }

      const response =
        await fetch(
          "/api/admin/wallets",
          {
            method: "GET",

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
          result.message ||
            "Unable to load wallets"
        );
      }

      setData(
        result as WalletData
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load wallets"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallets();
  }, []);

  const filteredWallets =
    useMemo(() => {
      if (!data) {
        return [];
      }

      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return data.wallets;
      }

      return data.wallets.filter(
        (wallet) =>
          wallet.email
            .toLowerCase()
            .includes(query) ||
          wallet.user_id
            .toLowerCase()
            .includes(query)
      );
    }, [data, search]);

  function formatDate(
    value: string
  ) {
    return new Date(
      value
    ).toLocaleString(
      "th-TH"
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">

          <p className="text-lime-400 tracking-[0.35em] animate-pulse">
            LOADING WALLET SYSTEM...
          </p>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">

      <Navbar />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        <div className="absolute top-[-300px] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full bg-lime-400/8 blur-[180px]" />

        <div className="absolute bottom-[-300px] left-[-250px] w-[700px] h-[700px] rounded-full bg-cyan-500/8 blur-[180px]" />

        <div className="absolute bottom-[-300px] right-[-250px] w-[700px] h-[700px] rounded-full bg-purple-500/8 blur-[180px]" />

      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">

        <section>

          <div className="inline-flex items-center gap-2 border border-lime-400/20 bg-lime-400/5 rounded-full px-4 py-2">

            <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse" />

            <span className="text-lime-400 text-[9px] tracking-[0.3em]">
              TOKEN DATABASE
            </span>

          </div>

          <div className="flex items-end justify-between gap-6 flex-wrap mt-4">

            <div>

              <p className="text-zinc-600 text-[9px] tracking-[0.3em]">
                LOOTFORM ADMIN
              </p>

              <h1 className="text-4xl sm:text-6xl font-black mt-2">
                WALLET{" "}
                <span className="text-lime-400">
                  CONTROL
                </span>
              </h1>

              {data && (
                <p className="text-zinc-500 text-sm mt-4">
                  ADMIN{" "}
                  <span className="text-cyan-400">
                    {
                      data.admin
                        .email
                    }
                  </span>
                </p>
              )}

            </div>

            <div className="flex gap-3 flex-wrap">

              <button
                onClick={() =>
                  router.push(
                    "/admin"
                  )
                }
                className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-orange-400 hover:text-orange-400 transition"
              >
                ← ADMIN DASHBOARD
              </button>

              <button
                onClick={
                  loadWallets
                }
                className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
              >
                REFRESH
              </button>

            </div>

          </div>

        </section>

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">

            {errorMessage}

          </div>
        )}

        {data && (
          <>

            <section className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 mt-9">

              <Stat
                label="WALLETS"
                value={
                  data.stats
                    .totalWallets
                }
                suffix=""
                className="text-purple-400"
              />

              <Stat
                label="TOKEN BALANCE"
                value={
                  data.stats
                    .totalBalance
                }
                suffix="LT"
                className="text-lime-400"
              />

              <Stat
                label="TOTAL TOP UP"
                value={
                  data.stats
                    .totalTopup
                }
                suffix="LT"
                className="text-cyan-400"
              />

              <Stat
                label="TOTAL SPENT"
                value={
                  data.stats
                    .totalSpent
                }
                suffix="LT"
                className="text-red-400"
              />

              <Stat
                label="TRANSACTIONS"
                value={
                  data.stats
                    .transactionCount
                }
                suffix=""
                className="text-orange-400"
              />

            </section>

            <section className="mt-6 border border-zinc-800 bg-zinc-950/75 rounded-2xl p-4">

              <label className="text-zinc-600 text-[8px] tracking-[0.25em]">
                SEARCH WALLET
              </label>

              <input
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Email or Player ID"
                className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-4 text-white outline-none placeholder:text-zinc-700 focus:border-lime-400"
              />

            </section>

            <div className="flex items-end justify-between gap-5 mt-8 flex-wrap">

              <div>

                <p className="text-lime-400 text-[9px] tracking-[0.3em]">
                  PLAYER WALLETS
                </p>

                <h2 className="text-2xl font-black mt-2">
                  WALLET DATABASE
                </h2>

              </div>

              <p className="text-zinc-600 text-xs">
                {
                  filteredWallets.length
                }{" "}
                RESULTS
              </p>

            </div>

            <section className="space-y-4 mt-5">

              {filteredWallets.map(
                (wallet) => {
                  const expanded =
                    selectedWalletId ===
                    wallet.id;

                  return (
                    <article
                      key={
                        wallet.id
                      }
                      className={`
                        border
                        rounded-[26px]
                        bg-zinc-950/75
                        overflow-hidden
                        ${
                          expanded
                            ? "border-lime-400/35"
                            : "border-zinc-800"
                        }
                      `}
                    >

                      <div className="grid lg:grid-cols-[1fr_auto] gap-5 items-center p-5 sm:p-6">

                        <div className="min-w-0">

                          <p className="text-zinc-600 text-[8px] tracking-[0.25em]">
                            PLAYER WALLET
                          </p>

                          <p className="text-white font-black mt-2 truncate">
                            {
                              wallet.email
                            }
                          </p>

                          <p className="text-zinc-700 text-[9px] font-mono mt-2 break-all">
                            {
                              wallet.user_id
                            }
                          </p>

                        </div>

                        <div className="flex items-center gap-3 flex-wrap">

                          <div className="border border-lime-400/30 bg-lime-400/[0.04] rounded-xl px-5 py-3">

                            <p className="text-zinc-600 text-[8px]">
                              BALANCE
                            </p>

                            <p className="text-lime-400 text-xl font-black mt-1">
                              {
                                wallet.balance
                              }{" "}
                              LT
                            </p>

                          </div>

                          <button
                            onClick={() =>
                              setSelectedWalletId(
                                expanded
                                  ? null
                                  : wallet.id
                              )
                            }
                            className="border border-zinc-800 px-5 py-4 rounded-xl text-xs font-black text-zinc-300 hover:border-lime-400 hover:text-lime-400 transition"
                          >
                            {expanded
                              ? "CLOSE"
                              : "VIEW WALLET"}
                          </button>

                        </div>

                      </div>

                      <div className="grid grid-cols-3 border-t border-zinc-900">

                        <WalletMetric
                          label="TOP UP"
                          value={
                            wallet.totalTopup
                          }
                          suffix="LT"
                          className="text-lime-400"
                        />

                        <WalletMetric
                          label="SPENT"
                          value={
                            wallet.totalSpent
                          }
                          suffix="LT"
                          className="text-red-400"
                        />

                        <WalletMetric
                          label="TRANSACTIONS"
                          value={
                            wallet.transactionCount
                          }
                          suffix=""
                          className="text-cyan-400"
                        />

                      </div>

                      {expanded && (
                        <div className="border-t border-lime-400/10 bg-black/30 p-5 sm:p-6">

                          <div className="grid md:grid-cols-2 gap-3">

                            <Info
                              label="WALLET CREATED"
                              value={formatDate(
                                wallet.created_at
                              )}
                            />

                            <Info
                              label="LAST UPDATED"
                              value={formatDate(
                                wallet.updated_at
                              )}
                            />

                          </div>

                          <div className="mt-6">

                            <p className="text-lime-400 text-[8px] tracking-[0.25em]">
                              TOKEN LEDGER
                            </p>

                            <h3 className="text-xl font-black mt-2">
                              RECENT TRANSACTIONS
                            </h3>

                          </div>

                          <div className="space-y-2 mt-4">

                            {wallet.transactions.length ===
                              0 && (
                              <div className="border border-zinc-800 rounded-xl p-6 text-center text-zinc-600">
                                NO TRANSACTIONS
                              </div>
                            )}

                            {wallet.transactions.map(
                              (
                                transaction
                              ) => {
                                const positive =
                                  Number(
                                    transaction.amount
                                  ) > 0;

                                return (
                                  <div
                                    key={
                                      transaction.id
                                    }
                                    className="border border-zinc-800 bg-black/50 rounded-xl p-4 flex items-center justify-between gap-5"
                                  >

                                    <div>

                                      <p className="text-white text-xs font-black">
                                        {
                                          transaction.type
                                        }
                                      </p>

                                      <p className="text-zinc-600 text-xs mt-1">
                                        {
                                          transaction.description ??
                                          "-"
                                        }
                                      </p>

                                      <p className="text-zinc-700 text-[8px] mt-2">
                                        {formatDate(
                                          transaction.created_at
                                        )}
                                      </p>

                                    </div>

                                    <p
                                      className={`
                                        text-lg
                                        font-black
                                        ${
                                          positive
                                            ? "text-lime-400"
                                            : "text-red-400"
                                        }
                                      `}
                                    >
                                      {positive
                                        ? "+"
                                        : ""}
                                      {
                                        transaction.amount
                                      }{" "}
                                      LT
                                    </p>

                                  </div>
                                );
                              }
                            )}

                          </div>

                        </div>
                      )}

                    </article>
                  );
                }
              )}

            </section>

            <div className="mt-12 pb-6 text-center">

              <p className="text-zinc-800 text-[9px] tracking-[0.4em]">
                LOOTFORM ADMIN // TOKEN SYSTEM
              </p>

            </div>

          </>
        )}

      </div>
    </main>
  );
}

function Stat({
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
    <div className="border border-zinc-800 bg-zinc-950/75 rounded-[22px] p-5">

      <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
        {label}
      </p>

      <div className="flex items-end gap-2 mt-3">

        <p
          className={`text-3xl font-black ${className}`}
        >
          {value.toLocaleString()}
        </p>

        {suffix && (
          <p className="text-zinc-600 text-[8px] font-black mb-1">
            {suffix}
          </p>
        )}

      </div>

    </div>
  );
}

function WalletMetric({
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
    <div className="p-4 sm:p-5 border-r border-zinc-900 last:border-r-0">

      <p className="text-zinc-600 text-[8px]">
        {label}
      </p>

      <p
        className={`text-xl font-black mt-2 ${className}`}
      >
        {value.toLocaleString()}

        {suffix && (
          <span className="text-[9px] ml-1">
            {suffix}
          </span>
        )}

      </p>

    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">

      <p className="text-zinc-600 text-[8px] tracking-[0.18em]">
        {label}
      </p>

      <p className="text-zinc-300 text-xs mt-2">
        {value}
      </p>

    </div>
  );
}