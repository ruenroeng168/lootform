"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type TokenPackage = {
  amount: number;
  name: string;
  subtitle: string;
  badge?: string;
  accent: string;
  border: string;
  background: string;
  glow: string;
};

const packages: TokenPackage[] = [
  {
    amount: 100,
    name: "STARTER",
    subtitle: "1 CRAFT",
    accent: "text-zinc-200",
    border: "border-zinc-700",
    background: "bg-white/[0.02]",
    glow: "bg-white",
  },
  {
    amount: 500,
    name: "CRAFTER",
    subtitle: "5 CRAFTS",
    badge: "POPULAR",
    accent: "text-cyan-400",
    border: "border-cyan-400/50",
    background: "bg-cyan-400/[0.04]",
    glow: "bg-cyan-400",
  },
  {
    amount: 1000,
    name: "HUNTER",
    subtitle: "10 CRAFTS",
    accent: "text-purple-400",
    border: "border-purple-400/50",
    background: "bg-purple-400/[0.04]",
    glow: "bg-purple-500",
  },
  {
    amount: 2000,
    name: "VAULT",
    subtitle: "20 CRAFTS",
    badge: "MAX",
    accent: "text-orange-400",
    border: "border-orange-400/50",
    background: "bg-orange-400/[0.04]",
    glow: "bg-orange-400",
  },
];

export default function TopUpPage() {
  const router = useRouter();

  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [balance, setBalance] = useState(0);

  const [selectedAmount, setSelectedAmount] = useState(500);
  const [topupLoading, setTopupLoading] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.push("/login");
        return;
      }

      setUserEmail(user.email ?? "PLAYER");

      const {
        data: wallet,
        error: walletError,
      } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (walletError) {
        console.error("WALLET ERROR:", walletError);
      }

      setBalance(wallet?.balance ?? 0);
      setAuthLoading(false);
    }

    loadData();
  }, [router]);

  async function topUp() {
    if (topupLoading) return;

    setTopupLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/topup", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },

        body: JSON.stringify({
          amount: selectedAmount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Top Up failed"
        );
      }

      setBalance(result.wallet.balance);

      setSuccessMessage(
        `เติม ${result.topup.amount} LT สำเร็จ`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Top Up failed"
      );
    } finally {
      setTopupLoading(false);
    }
  }

  const selectedPackage =
    packages.find(
      (item) => item.amount === selectedAmount
    ) ?? packages[1];

  if (authLoading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-lime-400 tracking-[0.35em] animate-pulse">
            LOADING TOKEN STORE...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <Navbar />

      {/* BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-300px] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full bg-lime-400/8 blur-[180px]" />

        <div className="absolute bottom-[-300px] left-[-250px] w-[700px] h-[700px] rounded-full bg-purple-500/10 blur-[180px]" />

        <div className="absolute bottom-[-300px] right-[-250px] w-[700px] h-[700px] rounded-full bg-orange-400/8 blur-[180px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        {/* PLAYER */}
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
              onClick={() => router.push("/craft")}
              className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-bold hover:border-lime-400 hover:text-lime-400 transition"
            >
              CRAFT
            </button>

            <button
              onClick={() => router.push("/wallet")}
              className="border border-zinc-800 bg-black/40 rounded-xl px-5 py-3 text-left hover:border-lime-400 transition"
            >
              <p className="text-zinc-600 text-[9px]">
                WALLET
              </p>

              <p className="text-lime-400 font-black text-lg">
                {balance} LT
              </p>
            </button>
          </div>
        </div>

        {/* HERO */}
        <section className="text-center mt-12">
          <div className="inline-flex items-center gap-2 border border-lime-400/20 bg-lime-400/5 rounded-full px-5 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />

            <span className="text-lime-400 text-[10px] tracking-[0.35em]">
              TOKEN STORE ONLINE
            </span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mt-5">
            TOP UP{" "}
            <span className="text-lime-400">
              TOKEN
            </span>
          </h1>

          <p className="text-zinc-500 text-[10px] sm:text-xs tracking-[0.3em] mt-4">
            LOAD TOKEN. CRAFT LOOT.
          </p>
        </section>

        {/* BALANCE */}
        <section className="relative mt-10 border border-lime-400/25 bg-zinc-950/75 rounded-[28px] overflow-hidden">
          <div className="relative z-10 flex items-center justify-between gap-6 flex-wrap p-6 sm:p-8">
            <div>
              <p className="text-zinc-600 text-[9px] tracking-[0.25em]">
                CURRENT BALANCE
              </p>

              <p className="text-zinc-500 text-sm mt-2">
                Loot Token
              </p>
            </div>

            <div className="flex items-end gap-3">
              <p className="text-lime-400 text-5xl sm:text-6xl font-black">
                {balance}
              </p>

              <p className="text-lime-400 text-xl font-black mb-1">
                LT
              </p>
            </div>
          </div>
        </section>

        {/* STORE */}
        <div className="flex items-end justify-between gap-5 flex-wrap mt-10">
          <div>
            <p className="text-cyan-400 text-[9px] tracking-[0.3em]">
              TOKEN STORE
            </p>

            <h2 className="text-2xl sm:text-3xl font-black mt-2">
              SELECT PACKAGE
            </h2>
          </div>

          <p className="text-zinc-600 text-xs">
            DEVELOPMENT MODE
          </p>
        </div>

        <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
          {packages.map((pack) => {
            const selected =
              selectedAmount === pack.amount;

            return (
              <button
                key={pack.amount}
                onClick={() => {
                  setSelectedAmount(pack.amount);
                  setSuccessMessage("");
                  setErrorMessage("");
                }}
                className={`
                  relative
                  overflow-hidden
                  border
                  rounded-[24px]
                  text-left
                  p-5
                  min-h-[245px]
                  transition-all
                  duration-300
                  ${pack.border}
                  ${pack.background}
                  ${
                    selected
                      ? "scale-[1.02]"
                      : "hover:-translate-y-1"
                  }
                `}
              >
                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={`
                        text-[10px]
                        font-black
                        tracking-[0.25em]
                        ${pack.accent}
                      `}
                    >
                      {pack.name}
                    </p>

                    {pack.badge && (
                      <span
                        className={`
                          border
                          rounded-full
                          px-2.5
                          py-1
                          text-[8px]
                          font-black
                          ${pack.border}
                          ${pack.accent}
                        `}
                      >
                        {pack.badge}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex items-center justify-center py-5">
                    <div
                      className={`
                        w-20
                        h-20
                        rounded-full
                        border
                        flex
                        items-center
                        justify-center
                        ${pack.border}
                      `}
                    >
                      <span
                        className={`
                          text-xl
                          font-black
                          ${pack.accent}
                        `}
                      >
                        LT
                      </span>
                    </div>
                  </div>

                  <p
                    className={`
                      text-3xl
                      font-black
                      ${pack.accent}
                    `}
                  >
                    {pack.amount.toLocaleString()}
                    <span className="text-sm ml-2">
                      LT
                    </span>
                  </p>

                  <p className="text-zinc-600 text-[9px] tracking-[0.2em] mt-2">
                    {pack.subtitle}
                  </p>

                  {selected && (
                    <p
                      className={`
                        text-[9px]
                        font-black
                        tracking-[0.2em]
                        mt-4
                        ${pack.accent}
                      `}
                    >
                      ● SELECTED
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </section>

        {/* SUMMARY */}
        <section className="relative mt-6 border border-zinc-800 bg-zinc-950/80 rounded-[28px] overflow-hidden">
          <div className="relative z-10 grid lg:grid-cols-[1fr_0.75fr] gap-8 p-6 sm:p-8">
            <div>
              <p className="text-zinc-600 text-[9px] tracking-[0.3em]">
                TOP UP TERMINAL
              </p>

              <h3 className="text-2xl font-black mt-2">
                ORDER SUMMARY
              </h3>

              <div className="mt-6 space-y-3">
                <div className="border border-zinc-800 bg-black/40 rounded-xl p-4 flex items-center justify-between">
                  <p
                    className={`
                      font-black
                      ${selectedPackage.accent}
                    `}
                  >
                    {selectedPackage.name}
                  </p>

                  <p className="text-zinc-400 font-bold">
                    {selectedPackage.subtitle}
                  </p>
                </div>

                <div className="border border-zinc-800 bg-black/40 rounded-xl p-4 flex items-center justify-between">
                  <p className="text-zinc-500">
                    TOKEN
                  </p>

                  <p className="text-lime-400 text-2xl font-black">
                    +{selectedAmount.toLocaleString()} LT
                  </p>
                </div>

                <div className="border border-zinc-800 bg-black/40 rounded-xl p-4 flex items-center justify-between">
                  <p className="text-zinc-500">
                    BALANCE AFTER
                  </p>

                  <p className="text-white text-xl font-black">
                    {(balance + selectedAmount).toLocaleString()} LT
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <div className="border border-yellow-400/20 bg-yellow-400/[0.04] rounded-xl p-4">
                <p className="text-yellow-300 text-[9px] font-black tracking-[0.2em]">
                  DEVELOPMENT MODE
                </p>

                <p className="text-zinc-500 text-xs leading-5 mt-2">
                  ระบบนี้ใช้ทดสอบ Wallet เท่านั้น
                  ยังไม่มีการเรียกเก็บเงินจริง
                </p>
              </div>

              <button
                onClick={topUp}
                disabled={topupLoading}
                className="mt-4 min-h-[76px] rounded-xl bg-lime-400 text-black font-black text-lg hover:bg-lime-300 disabled:opacity-40 transition"
              >
                {topupLoading
                  ? "PROCESSING..."
                  : `TEST TOP UP +${selectedAmount.toLocaleString()} LT`}
              </button>

              <button
                onClick={() => router.push("/wallet")}
                className="mt-3 border border-zinc-800 text-zinc-400 py-4 rounded-xl font-bold hover:border-cyan-400 hover:text-cyan-400 transition"
              >
                BACK TO WALLET
              </button>
            </div>
          </div>

          {successMessage && (
            <div className="mx-6 sm:mx-8 mb-8 border border-lime-400/30 bg-lime-400/[0.07] rounded-xl p-5 text-center">
              <p className="text-lime-400 font-black">
                ✓ {successMessage}
              </p>

              <p className="text-zinc-500 text-xs mt-2">
                CURRENT BALANCE: {balance.toLocaleString()} LT
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="mx-6 sm:mx-8 mb-8 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5 text-center font-bold">
              {errorMessage}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}