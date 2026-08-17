"use client";

import {
  useEffect,
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
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export default function WalletPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    userEmail,
    setUserEmail,
  ] = useState("");

  const [
    balance,
    setBalance,
  ] = useState(0);

  const [
    transactions,
    setTransactions,
  ] =
    useState<
      WalletTransaction[]
    >([]);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  async function loadWallet() {
    setLoading(true);
    setErrorMessage("");

    try {
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
        .select(`
          balance
        `)
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

      if (walletError) {
        throw walletError;
      }

      setBalance(
        Number(
          wallet?.balance ?? 0
        )
      );

      const {
        data: transactionData,
        error:
          transactionError,
      } = await supabase
        .from(
          "wallet_transactions"
        )
        .select(`
          id,
          type,
          amount,
          description,
          created_at
        `)
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(50);

      if (
        transactionError
      ) {
        throw transactionError;
      }

      setTransactions(
        transactionData ?? []
      );
    } catch (error) {
      console.error(
        "PLAYER WALLET ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load wallet"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
  }, []);

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
            LOADING WALLET...
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

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">

        <section className="flex items-center justify-between gap-5 flex-wrap">

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

          <button
            onClick={
              loadWallet
            }
            className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
          >
            REFRESH
          </button>

        </section>

        <section className="mt-10">

          <div className="inline-flex items-center gap-2 border border-lime-400/20 bg-lime-400/5 rounded-full px-4 py-2">

            <span className="w-1.5 h-1.5 bg-lime-400 rounded-full animate-pulse" />

            <span className="text-lime-400 text-[9px] tracking-[0.3em]">
              PLAYER TOKEN WALLET
            </span>

          </div>

          <h1 className="text-5xl sm:text-7xl font-black mt-5">
            MY{" "}
            <span className="text-lime-400">
              WALLET
            </span>
          </h1>

          <p className="text-zinc-500 mt-4 max-w-xl">
            Manage your Loot Token balance and view your recent activity.
          </p>

        </section>

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">
            {errorMessage}
          </div>
        )}

        <section className="grid lg:grid-cols-[1fr_320px] gap-6 mt-8">

          <div className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

            <p className="text-zinc-600 text-[9px] tracking-[0.25em]">
              AVAILABLE BALANCE
            </p>

            <div className="flex items-end gap-3 mt-4">

              <p className="text-lime-400 text-6xl sm:text-8xl font-black">
                {balance.toLocaleString()}
              </p>

              <p className="text-zinc-500 text-xl font-black mb-2">
                LT
              </p>

            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-8">

              <button
                onClick={() =>
                  router.push(
                    "/wallet/topup"
                  )
                }
                className="bg-lime-400 text-black px-6 py-4 rounded-xl text-sm font-black hover:bg-lime-300 transition"
              >
                TOP UP TOKEN
              </button>

              <button
                onClick={() =>
                  router.push(
                    "/craft"
                  )
                }
                className="border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 px-6 py-4 rounded-xl text-sm font-black hover:bg-cyan-400/10 transition"
              >
                GO TO CRAFT
              </button>

            </div>

          </div>

          <div className="border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6">

            <p className="text-cyan-400 text-[9px] tracking-[0.25em]">
              TOKEN SYSTEM
            </p>

            <h2 className="text-2xl font-black mt-2">
              LOOT TOKEN
            </h2>

            <div className="space-y-3 mt-6">

              <Info
                label="BALANCE"
                value={`${balance.toLocaleString()} LT`}
                className="text-lime-400"
              />

              <Info
                label="STATUS"
                value="ACTIVE"
                className="text-cyan-400"
              />

              <Info
                label="ACCOUNT"
                value="PLAYER"
                className="text-white"
              />

            </div>

          </div>

        </section>

        <section className="mt-6 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

          <div className="flex items-end justify-between gap-5 flex-wrap">

            <div>

              <p className="text-purple-400 text-[9px] tracking-[0.3em]">
                TOKEN LEDGER
              </p>

              <h2 className="text-2xl sm:text-3xl font-black mt-2">
                TRANSACTION HISTORY
              </h2>

            </div>

            <p className="text-zinc-600 text-xs">
              {transactions.length} RECORDS
            </p>

          </div>

          <div className="space-y-3 mt-6">

            {transactions.length ===
              0 && (
              <div className="border border-zinc-800 bg-black/40 rounded-xl p-10 text-center">

                <p className="text-zinc-600">
                  NO TRANSACTIONS
                </p>

              </div>
            )}

            {transactions.map(
              (transaction) => {
                const positive =
                  Number(
                    transaction.amount
                  ) > 0;

                return (
                  <div
                    key={
                      transaction.id
                    }
                    className="border border-zinc-800 bg-black/40 rounded-xl p-4 sm:p-5 flex items-center justify-between gap-5"
                  >

                    <div>

                      <div className="flex items-center gap-3">

                        <p className="text-white text-sm font-black">
                          {
                            transaction.type
                          }
                        </p>

                        <span
                          className={`
                            text-[8px]
                            font-black
                            rounded-full
                            px-2
                            py-1

                            ${
                              positive
                                ? "text-lime-400 bg-lime-400/5 border border-lime-400/20"
                                : "text-red-400 bg-red-400/5 border border-red-400/20"
                            }
                          `}
                        >
                          {positive
                            ? "CREDIT"
                            : "DEBIT"}
                        </span>

                      </div>

                      <p className="text-zinc-500 text-xs mt-2">
                        {
                          transaction.description ??
                          "-"
                        }
                      </p>

                      <p className="text-zinc-700 text-[9px] mt-2">
                        {formatDate(
                          transaction.created_at
                        )}
                      </p>

                    </div>

                    <p
                      className={`
                        text-xl
                        sm:text-2xl
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

        </section>

      </div>

    </main>
  );
}

function Info({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">

      <p className="text-zinc-600 text-[8px] tracking-[0.18em]">
        {label}
      </p>

      <p
        className={`text-lg font-black mt-2 ${className}`}
      >
        {value}
      </p>

    </div>
  );
}