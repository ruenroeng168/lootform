"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Navbar from "@/components/Navbar";

import {
  supabase,
} from "@/lib/supabase";

// =====================================
// TYPES
// =====================================

type TopupSuccess = {
  reference: string;
  order_id: number;
  token_amount: number;
  previous_balance?: number;
  balance: number;
  already_paid?: boolean;
};

type TopupPackage = {
  code: string;
  tokenAmount: number;
  priceTHB: number;
};

// =====================================
// TEST PACKAGE
// =====================================

const TOPUP_PACKAGE: TopupPackage = {
  code: "LT100",
  tokenAmount: 100,
  priceTHB: 999,
};

// =====================================
// PAGE
// =====================================

export default function WalletTopupPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    toppingUp,
    setToppingUp,
  ] =
    useState(false);

  const [
    userEmail,
    setUserEmail,
  ] =
    useState("");

  const [
    balance,
    setBalance,
  ] =
    useState(0);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState<
      TopupSuccess | null
    >(null);

  // =====================================
  // LOAD WALLET
  // =====================================

  async function loadWallet() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session) {
        router.push(
          "/login"
        );

        return;
      }

      const user =
        session.user;

      setUserEmail(
        user.email ??
          "PLAYER"
      );

      const {
        data:
          wallet,

        error:
          walletError,
      } =
        await supabase
          .from(
            "wallets"
          )
          .select(`
            balance
          `)
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (
        walletError
      ) {
        throw walletError;
      }

      setBalance(
        Number(
          wallet?.balance ??
            0
        )
      );
    } catch (error) {
      console.error(
        "LOAD TOPUP WALLET ERROR:",
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

  // =====================================
  // FIRST LOAD
  // =====================================

  useEffect(() => {
    loadWallet();
  }, []);

  // =====================================
  // TEST TOP-UP
  // =====================================

  async function testTopup() {
    setToppingUp(true);
    setErrorMessage("");
    setSuccess(null);

    try {
      const {
        data: {
          session,
        },
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
          "/api/wallet/topup/test",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${session.access_token}`,
            },

            body:
              JSON.stringify({
                packageCode:
                  TOPUP_PACKAGE.code,
              }),
          }
        );

      const text =
        await response.text();

      let result:
        any = null;

      if (text) {
        try {
          result =
            JSON.parse(
              text
            );
        } catch {
          throw new Error(
            "Top-up API ตอบกลับข้อมูลไม่ถูกต้อง"
          );
        }
      }

      if (
        !response.ok
      ) {
        throw new Error(
          result?.message ||
            "ไม่สามารถเติม LT ได้"
        );
      }

      if (
        !result?.topup
      ) {
        throw new Error(
          "ไม่พบข้อมูล Top-up Result"
        );
      }

      const topup =
        result.topup as
          TopupSuccess;

      setSuccess(
        topup
      );

      setBalance(
        Number(
          topup.balance ??
            0
        )
      );
    } catch (error) {
      console.error(
        "TEST TOPUP ERROR:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถเติม LT ได้"
      );
    } finally {
      setToppingUp(false);
    }
  }

  // =====================================
  // LOADING
  // =====================================

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">

          <p className="text-lime-400 tracking-[0.35em] animate-pulse">
            LOADING TOP-UP...
          </p>

        </div>

      </main>
    );
  }

  // =====================================
  // PAGE
  // =====================================

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">

      <Navbar />

      {/* BACKGROUND */}

      <div className="absolute inset-0 pointer-events-none overflow-hidden">

        <div className="absolute top-[-300px] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full bg-lime-400/8 blur-[180px]" />

        <div className="absolute bottom-[-300px] left-[-250px] w-[700px] h-[700px] rounded-full bg-cyan-500/8 blur-[180px]" />

        <div className="absolute bottom-[-300px] right-[-250px] w-[700px] h-[700px] rounded-full bg-purple-500/8 blur-[180px]" />

      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">

        {/* =====================================
            PLAYER
        ===================================== */}

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
            onClick={() =>
              router.push(
                "/wallet"
              )
            }
            className="
              border
              border-zinc-800
              bg-black/40
              text-zinc-300
              px-5
              py-3
              rounded-xl
              text-xs
              font-black
              hover:border-lime-400
              hover:text-lime-400
              transition
            "
          >
            ← WALLET
          </button>

        </section>

        {/* =====================================
            HEADER
        ===================================== */}

        <section className="mt-10">

          <div className="inline-flex items-center gap-2 border border-yellow-300/20 bg-yellow-300/5 rounded-full px-4 py-2">

            <span className="w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse" />

            <span className="text-yellow-300 text-[9px] tracking-[0.3em]">
              TEST MODE
            </span>

          </div>

          <h1 className="text-5xl sm:text-7xl font-black mt-5">
            TOP UP{" "}

            <span className="text-lime-400">
              TOKEN
            </span>
          </h1>

          <p className="text-zinc-500 mt-4 max-w-xl">
            เติม Loot Token สำหรับทดสอบระบบ LOOTFORM
            โดยยังไม่มีการเรียกเก็บเงินจริง
          </p>

        </section>

        {/* =====================================
            ERROR
        ===================================== */}

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">

            ⚠ {errorMessage}

          </div>
        )}

        {/* =====================================
            SUCCESS
        ===================================== */}

        {success && (
          <section className="mt-6 border border-lime-400/30 bg-lime-400/[0.05] rounded-2xl p-6">

            <p className="text-lime-400 text-[9px] tracking-[0.25em]">
              TOP-UP SUCCESS
            </p>

            <div className="flex items-end justify-between gap-5 flex-wrap mt-4">

              <div>

                <p className="text-white text-4xl font-black">
                  +{success.token_amount} LT
                </p>

                <p className="text-zinc-500 text-sm mt-2">
                  Loot Token added successfully.
                </p>

              </div>

              <div className="border border-lime-400/25 bg-black/40 rounded-xl px-5 py-4">

                <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                  NEW BALANCE
                </p>

                <p className="text-lime-400 text-2xl font-black mt-1">
                  {success.balance.toLocaleString()} LT
                </p>

              </div>

            </div>

            <div className="grid sm:grid-cols-2 gap-3 mt-5">

              <Info
                label="REFERENCE"
                value={
                  success.reference
                }
              />

              <Info
                label="ORDER ID"
                value={
                  `#${success.order_id}`
                }
              />

            </div>

          </section>
        )}

        {/* =====================================
            WALLET BALANCE
        ===================================== */}

        <section className="mt-8 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">

          <p className="text-zinc-600 text-[9px] tracking-[0.25em]">
            CURRENT BALANCE
          </p>

          <div className="flex items-end gap-3 mt-4">

            <p className="text-lime-400 text-6xl sm:text-8xl font-black">
              {balance.toLocaleString()}
            </p>

            <p className="text-zinc-500 text-xl font-black mb-2">
              LT
            </p>

          </div>

        </section>

        {/* =====================================
            PACKAGE
        ===================================== */}

        <section className="mt-6">

          <p className="text-cyan-400 text-[9px] tracking-[0.25em]">
            TOKEN PACKAGE
          </p>

          <h2 className="text-2xl sm:text-3xl font-black mt-2">
            SELECT PACKAGE
          </h2>

          <div className="mt-5 border border-lime-400/30 bg-gradient-to-br from-lime-400/[0.08] to-black rounded-[28px] overflow-hidden">

            <div className="p-6 sm:p-8">

              <div className="flex items-start justify-between gap-5 flex-wrap">

                <div>

                  <p className="text-lime-400 text-[9px] tracking-[0.3em]">
                    LOOT TOKEN
                  </p>

                  <div className="flex items-end gap-3 mt-3">

                    <p className="text-white text-5xl sm:text-6xl font-black">
                      100
                    </p>

                    <p className="text-lime-400 text-xl font-black mb-1">
                      LT
                    </p>

                  </div>

                </div>

                <div className="text-right">

                  <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                    PRICE
                  </p>

                  <p className="text-orange-400 text-3xl font-black mt-2">
                    ฿999
                  </p>

                </div>

              </div>

              <div className="grid sm:grid-cols-3 gap-3 mt-7">

                <Info
                  label="PACKAGE"
                  value="LT100"
                />

                <Info
                  label="TOKEN"
                  value="100 LT"
                />

                <Info
                  label="PRICE"
                  value="999 THB"
                />

              </div>

            </div>

            {/* TEST WARNING */}

            <div className="border-t border-yellow-300/20 bg-yellow-300/[0.03] p-5">

              <p className="text-yellow-300 text-[9px] tracking-[0.2em] font-black">
                ⚠ TEST PAYMENT
              </p>

              <p className="text-zinc-500 text-xs leading-5 mt-2">
                ไม่มีการตัดเงินจริงในขั้นตอนนี้
                ระบบจะจำลองการชำระเงินสำเร็จและเพิ่ม 100 LT
                เข้า Wallet เพื่อทดสอบระบบ
              </p>

            </div>

            {/* BUTTON */}

            <div className="p-5 sm:p-6 border-t border-zinc-800">

              <button
                disabled={
                  toppingUp
                }
                onClick={
                  testTopup
                }
                className="
                  w-full
                  bg-lime-400
                  text-black
                  py-5
                  rounded-xl
                  text-sm
                  font-black
                  hover:bg-lime-300
                  disabled:bg-zinc-800
                  disabled:text-zinc-600
                  disabled:cursor-not-allowed
                  transition
                "
              >
                {toppingUp
                  ? "PROCESSING TEST TOP-UP..."
                  : "TEST TOP-UP +100 LT"}
              </button>

            </div>

          </div>

        </section>

        {/* =====================================
            FLOW
        ===================================== */}

        <section className="mt-6 border border-zinc-800 bg-zinc-950/60 rounded-2xl p-6">

          <p className="text-purple-400 text-[9px] tracking-[0.25em]">
            TEST FLOW
          </p>

          <div className="grid sm:grid-cols-3 gap-3 mt-5">

            <Step
              number="01"
              title="TOP UP"
              text="กดเติม 100 LT"
            />

            <Step
              number="02"
              title="SERVER"
              text="สร้าง Order + Ledger"
            />

            <Step
              number="03"
              title="WALLET"
              text="Balance เพิ่ม +100 LT"
            />

          </div>

        </section>

      </div>

    </main>
  );
}

// =====================================
// INFO
// =====================================

function Info({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">

      <p className="text-zinc-600 text-[8px] tracking-[0.18em]">
        {label}
      </p>

      <p className="text-white text-sm font-black mt-2 break-all">
        {value}
      </p>

    </div>
  );
}

// =====================================
// STEP
// =====================================

function Step({
  number,
  title,
  text,
}: {
  number:
    string;

  title:
    string;

  text:
    string;
}) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">

      <p className="text-cyan-400 text-[8px] font-black">
        {number}
      </p>

      <p className="text-white font-black mt-2">
        {title}
      </p>

      <p className="text-zinc-600 text-xs mt-2">
        {text}
      </p>

    </div>
  );
}