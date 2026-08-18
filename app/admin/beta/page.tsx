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

type BetaPreview = {
  admin: {
    email: string;
  };

  system: {
    environmentMode:
      "TEST" | "LIVE";

    betaName:
      string | null;

    betaStartedAt:
      string | null;

    betaEndsAt:
      string | null;

    updatedAt:
      string;
  };

  preview: {
    testItems:
      number;

    testTransactions:
      number;

    testTopupOrders:
      number;

    affectedPlayers:
      number;

    affectedWallets:
      number;

    totalTestTopup:
      number;

    totalTestTopupTHB:
      number;

    totalTestSpent:
      number;

    previousResets:
      number;
  };

  resetPlan: {
    deleteTestItems:
      boolean;

    deleteTestTransactions:
      boolean;

    deleteTestTopupOrders:
      boolean;

    resetAffectedWallets:
      boolean;

    deleteUsers:
      boolean;

    deleteShippingAddresses:
      boolean;

    deleteSeasonSettings:
      boolean;

    deleteSystemSettings:
      boolean;
  };
};

type ResetResult = {
  success:
    boolean;

  environment_mode:
    string;

  items_deleted:
    number;

  transactions_deleted:
    number;

  topup_orders_deleted?:
    number;

  wallets_reset:
    number;
};

// =====================================
// CONFIRM
// =====================================

const RESET_CONFIRMATION =
  "RESET LOOTFORM BETA";

// =====================================
// PAGE
// =====================================

export default function BetaControlPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    resetting,
    setResetting,
  ] =
    useState(false);

  const [
    data,
    setData,
  ] =
    useState<
      BetaPreview | null
    >(null);

  const [
    confirmation,
    setConfirmation,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    lastReset,
    setLastReset,
  ] =
    useState<
      ResetResult | null
    >(null);

  // =====================================
  // SESSION TOKEN
  // =====================================

  async function getSessionToken() {
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

      return null;
    }

    return session.access_token;
  }

  // =====================================
  // LOAD PREVIEW
  // =====================================

  async function loadPreview() {
    setLoading(true);
    setErrorMessage("");

    try {
      const token =
        await getSessionToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          "/api/admin/beta/preview",
          {
            method:
              "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache:
              "no-store",
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
            "Beta Preview API ตอบกลับข้อมูลไม่ถูกต้อง"
          );
        }
      }

      if (
        !response.ok
      ) {
        throw new Error(
          result?.message ||
            "Unable to load Beta Control"
        );
      }

      if (!result) {
        throw new Error(
          "Beta Preview API ไม่มีข้อมูลตอบกลับ"
        );
      }

      setData(
        result as
          BetaPreview
      );
    } catch (error) {
      console.error(
        "BETA CONTROL ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Unable to load Beta Control"
      );
    } finally {
      setLoading(false);
    }
  }

  // =====================================
  // FIRST LOAD
  // =====================================

  useEffect(() => {
    loadPreview();
  }, []);

  // =====================================
  // RESET BETA
  // =====================================

  async function resetBeta() {
    if (
      confirmation !==
      RESET_CONFIRMATION
    ) {
      setErrorMessage(
        `กรุณาพิมพ์ ${RESET_CONFIRMATION} ให้ถูกต้อง`
      );

      return;
    }

    if (
      !data ||
      data.system
        .environmentMode !==
        "TEST"
    ) {
      setErrorMessage(
        "Reset ใช้งานได้เฉพาะ TEST MODE"
      );

      return;
    }

    const confirmed =
      window.confirm(
        [
          "คำเตือน: การดำเนินการนี้จะ Reset ข้อมูล TEST",
          "",
          `Items: ${data.preview.testItems}`,
          `Transactions: ${data.preview.testTransactions}`,
          `Top-up Orders: ${data.preview.testTopupOrders}`,
          `Wallets: ${data.preview.affectedWallets}`,
          "",
          "ยืนยัน RESET LOOTFORM BETA หรือไม่?",
        ].join("\n")
      );

    if (!confirmed) {
      return;
    }

    setResetting(true);
    setErrorMessage("");
    setSuccessMessage("");
    setLastReset(null);

    try {
      const token =
        await getSessionToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          "/api/admin/beta/reset",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                confirmation:
                  RESET_CONFIRMATION,
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
            "Beta Reset API ตอบกลับข้อมูลไม่ถูกต้อง"
          );
        }
      }

      if (
        !response.ok
      ) {
        throw new Error(
          result?.message ||
            "Reset failed"
        );
      }

      setLastReset(
        result.result as
          ResetResult
      );

      setSuccessMessage(
        "LOOTFORM BETA RESET สำเร็จ"
      );

      setConfirmation("");

      await loadPreview();
    } catch (error) {
      console.error(
        "RESET BETA ERROR:",
        error
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : "Reset failed"
      );
    } finally {
      setResetting(false);
    }
  }

  // =====================================
  // DATE
  // =====================================

  function formatDate(
    value:
      string | null
  ) {
    if (!value) {
      return "-";
    }

    return new Date(
      value
    ).toLocaleString(
      "th-TH"
    );
  }

  // =====================================
  // LOADING
  // =====================================

  if (
    loading &&
    !data
  ) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="min-h-[80vh] flex items-center justify-center">

          <p className="text-yellow-300 tracking-[0.35em] animate-pulse">
            LOADING BETA CONTROL...
          </p>

        </div>

      </main>
    );
  }

  // =====================================
  // ERROR PAGE
  // =====================================

  if (!data) {
    return (
      <main className="min-h-screen bg-black text-white">

        <Navbar />

        <div className="max-w-5xl mx-auto px-6 py-12">

          <div className="border border-red-400/30 bg-red-400/[0.06] text-red-400 rounded-2xl p-6">

            {errorMessage ||
              "Unable to load Beta Control"}

          </div>

          <button
            onClick={
              loadPreview
            }
            className="mt-5 border border-zinc-800 px-5 py-3 rounded-xl"
          >
            RETRY
          </button>

        </div>

      </main>
    );
  }

  const mode =
    data.system
      .environmentMode;

  const testMode =
    mode ===
    "TEST";

  const confirmationReady =
    confirmation ===
    RESET_CONFIRMATION;

  // =====================================
  // PAGE
  // =====================================

  return (
    <main className="min-h-screen bg-black text-white">

      <Navbar />

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* =====================================
            HEADER
        ===================================== */}

        <section>

          <p className="text-yellow-300 text-[9px] tracking-[0.3em]">
            SYSTEM CONTROL
          </p>

          <div className="flex items-end justify-between gap-5 flex-wrap mt-2">

            <div>

              <h1 className="text-4xl sm:text-6xl font-black">
                BETA{" "}

                <span className="text-yellow-300">
                  CONTROL
                </span>
              </h1>

              <p className="text-zinc-500 mt-3 max-w-2xl">
                ตรวจสอบและควบคุมข้อมูลทดสอบของ LOOTFORM
              </p>

            </div>

            <div className="flex gap-3">

              <button
                onClick={
                  loadPreview
                }
                disabled={
                  loading ||
                  resetting
                }
                className="border border-zinc-800 px-5 py-3 rounded-xl text-xs font-black hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40"
              >
                {loading
                  ? "LOADING..."
                  : "REFRESH"}
              </button>

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

          </div>

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

        {successMessage && (
          <div className="mt-6 border border-lime-400/30 bg-lime-400/[0.07] text-lime-400 rounded-xl p-5">

            ✓ {successMessage}

          </div>
        )}

        {/* =====================================
            LAST RESET
        ===================================== */}

        {lastReset && (
          <section className="mt-6 border border-lime-400/25 bg-lime-400/[0.03] rounded-2xl p-5">

            <p className="text-lime-400 text-[9px] tracking-[0.2em]">
              RESET COMPLETED
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">

              <Info
                label="ITEMS DELETED"
                value={
                  String(
                    lastReset
                      .items_deleted
                  )
                }
              />

              <Info
                label="TRANSACTIONS DELETED"
                value={
                  String(
                    lastReset
                      .transactions_deleted
                  )
                }
              />

              <Info
                label="TOP-UP ORDERS DELETED"
                value={
                  String(
                    lastReset
                      .topup_orders_deleted ??
                      0
                  )
                }
              />

              <Info
                label="WALLETS RESET"
                value={
                  String(
                    lastReset
                      .wallets_reset
                  )
                }
              />

            </div>

          </section>
        )}

        {/* =====================================
            SYSTEM MODE
        ===================================== */}

        <section
          className={`
            mt-8
            border
            rounded-[26px]
            p-6
            sm:p-8

            ${
              testMode
                ? "border-yellow-300/30 bg-yellow-300/[0.04]"
                : "border-lime-400/30 bg-lime-400/[0.04]"
            }
          `}
        >

          <div className="flex items-start justify-between gap-5 flex-wrap">

            <div>

              <p
                className={`
                  text-[9px]
                  tracking-[0.25em]
                  font-black

                  ${
                    testMode
                      ? "text-yellow-300"
                      : "text-lime-400"
                  }
                `}
              >
                CURRENT ENVIRONMENT
              </p>

              <h2
                className={`
                  text-4xl
                  font-black
                  mt-3

                  ${
                    testMode
                      ? "text-yellow-300"
                      : "text-lime-400"
                  }
                `}
              >
                {mode}
              </h2>

              <p className="text-white font-black mt-4">
                {data.system
                  .betaName ??
                  "LOOTFORM"}
              </p>

            </div>

            <div
              className={`
                border
                rounded-full
                px-4
                py-2
                text-xs
                font-black

                ${
                  testMode
                    ? "border-yellow-300/30 bg-yellow-300/[0.08] text-yellow-300"
                    : "border-lime-400/30 bg-lime-400/[0.08] text-lime-400"
                }
              `}
            >
              ● {mode} MODE
            </div>

          </div>

          <div className="grid md:grid-cols-3 gap-3 mt-7">

            <Info
              label="BETA START"
              value={
                formatDate(
                  data.system
                    .betaStartedAt
                )
              }
            />

            <Info
              label="BETA END"
              value={
                formatDate(
                  data.system
                    .betaEndsAt
                )
              }
            />

            <Info
              label="LAST UPDATE"
              value={
                formatDate(
                  data.system
                    .updatedAt
                )
              }
            />

          </div>

        </section>

        {/* =====================================
            TEST DATA
        ===================================== */}

        <section className="mt-8">

          <p className="text-cyan-400 text-[9px] tracking-[0.25em]">
            RESET PREVIEW
          </p>

          <h2 className="text-3xl font-black mt-2">
            TEST DATA
          </h2>

          <p className="text-zinc-600 text-sm mt-2">
            ข้อมูลทั้งหมดที่ถูกระบุเป็น TEST
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mt-5">

            <Stat
              label="TEST ITEMS"
              value={
                data.preview
                  .testItems
              }
              suffix=""
              className="text-orange-400"
            />

            <Stat
              label="TRANSACTIONS"
              value={
                data.preview
                  .testTransactions
              }
              suffix=""
              className="text-cyan-400"
            />

            <Stat
              label="TOP-UP ORDERS"
              value={
                data.preview
                  .testTopupOrders
              }
              suffix=""
              className="text-lime-400"
            />

            <Stat
              label="PLAYERS"
              value={
                data.preview
                  .affectedPlayers
              }
              suffix=""
              className="text-purple-400"
            />

            <Stat
              label="WALLETS"
              value={
                data.preview
                  .affectedWallets
              }
              suffix=""
              className="text-yellow-300"
            />

            <Stat
              label="TEST TOPUP"
              value={
                data.preview
                  .totalTestTopup
              }
              suffix=" LT"
              className="text-lime-400"
            />

            <Stat
              label="TEST VALUE"
              value={
                data.preview
                  .totalTestTopupTHB
              }
              suffix=" THB"
              className="text-orange-400"
            />

            <Stat
              label="TEST SPENT"
              value={
                data.preview
                  .totalTestSpent
              }
              suffix=" LT"
              className="text-red-400"
            />

          </div>

        </section>

        {/* =====================================
            RESET PLAN
        ===================================== */}

        <section className="mt-8 border border-zinc-800 bg-zinc-950/70 rounded-[26px] overflow-hidden">

          <div className="border-b border-zinc-800 p-6 sm:p-8">

            <p className="text-red-400 text-[9px] tracking-[0.25em]">
              RESET PLAN
            </p>

            <h2 className="text-2xl font-black mt-2">
              สิ่งที่จะเกิดขึ้นเมื่อ Reset
            </h2>

          </div>

          <div className="grid md:grid-cols-2">

            {/* WILL RESET */}

            <div className="p-6 sm:p-8 border-b md:border-b-0 md:border-r border-zinc-800">

              <p className="text-red-400 font-black text-sm">
                WILL RESET
              </p>

              <div className="space-y-3 mt-5">

                <PlanRow
                  label="TEST Crafted Items"
                />

                <PlanRow
                  label="TEST Wallet Transactions"
                />

                <PlanRow
                  label="TEST Top-up Orders"
                />

                <PlanRow
                  label="Wallet Balances → 0 LT"
                />

              </div>

            </div>

            {/* WILL KEEP */}

            <div className="p-6 sm:p-8">

              <p className="text-lime-400 font-black text-sm">
                WILL KEEP
              </p>

              <div className="space-y-3 mt-5">

                <KeepRow
                  label="User Accounts"
                />

                <KeepRow
                  label="Shipping Addresses"
                />

                <KeepRow
                  label="Season Settings"
                />

                <KeepRow
                  label="System Settings"
                />

                <KeepRow
                  label="Admin Accounts"
                />

              </div>

            </div>

          </div>

        </section>

        {/* =====================================
            RESET HISTORY
        ===================================== */}

        <section className="mt-6 border border-zinc-800 bg-black/50 rounded-2xl p-5">

          <div className="flex items-center justify-between gap-5 flex-wrap">

            <div>

              <p className="text-zinc-600 text-[8px] tracking-[0.2em]">
                RESET HISTORY
              </p>

              <p className="text-white font-black mt-2">
                Previous Beta Resets
              </p>

            </div>

            <p className="text-cyan-400 text-2xl font-black">
              {
                data.preview
                  .previousResets
              }
            </p>

          </div>

        </section>

        {/* =====================================
            DANGER ZONE
        ===================================== */}

        <section className="mt-8 border border-red-500/40 bg-red-500/[0.04] rounded-[26px] p-6 sm:p-8">

          <p className="text-red-400 text-[9px] tracking-[0.25em]">
            DANGER ZONE
          </p>

          <h2 className="text-2xl font-black mt-3">
            RESET TEST DATA
          </h2>

          <p className="text-zinc-400 text-sm leading-6 mt-3 max-w-3xl">
            การ Reset จะลบ TEST Item,
            TEST Wallet Transaction,
            TEST Top-up Order
            และตั้ง Wallet Balance เป็น 0 LT
            แต่จะไม่ลบ User Account,
            Shipping Address หรือ Season Settings
          </p>

          {!testMode && (
            <div className="mt-5 border border-red-400/30 bg-red-400/[0.05] text-red-400 p-4 rounded-xl font-bold">
              🔒 RESET DISABLED — SYSTEM IS LIVE
            </div>
          )}

          {testMode && (
            <>

              <div className="mt-6">

                <p className="text-zinc-500 text-xs">
                  พิมพ์ข้อความด้านล่างเพื่อปลดล็อก
                </p>

                <div className="mt-3 border border-zinc-800 bg-black rounded-xl p-4">

                  <p className="text-red-400 font-mono font-black">
                    {RESET_CONFIRMATION}
                  </p>

                </div>

              </div>

              <input
                type="text"
                value={
                  confirmation
                }
                disabled={
                  resetting
                }
                onChange={(
                  event
                ) =>
                  setConfirmation(
                    event.target
                      .value
                  )
                }
                placeholder="Type RESET LOOTFORM BETA"
                autoComplete="off"
                className="
                  w-full
                  max-w-xl
                  mt-4
                  border
                  border-red-400/25
                  bg-black
                  rounded-xl
                  px-5
                  py-4
                  text-white
                  font-mono
                  outline-none
                  focus:border-red-400
                  disabled:opacity-40
                "
              />

              <div className="mt-3 text-xs">

                {confirmation.length ===
                0 ? (
                  <span className="text-zinc-700">
                    Waiting for confirmation...
                  </span>
                ) : confirmationReady ? (
                  <span className="text-lime-400">
                    ✓ CONFIRMATION MATCHED
                  </span>
                ) : (
                  <span className="text-red-400">
                    ✕ CONFIRMATION DOES NOT MATCH
                  </span>
                )}

              </div>

              <button
                disabled={
                  !confirmationReady ||
                  resetting
                }
                onClick={
                  resetBeta
                }
                className="
                  mt-6
                  bg-red-500
                  text-white
                  px-7
                  py-4
                  rounded-xl
                  font-black
                  hover:bg-red-400
                  disabled:bg-zinc-800
                  disabled:text-zinc-600
                  disabled:cursor-not-allowed
                  transition
                "
              >
                {resetting
                  ? "RESETTING..."
                  : "RESET LOOTFORM BETA"}
              </button>

              <p className="text-red-400/50 text-[10px] mt-4">
                THIS ACTION CANNOT BE UNDONE
              </p>

            </>
          )}

        </section>

      </div>

    </main>
  );
}

// =====================================
// STAT
// =====================================

function Stat({
  label,
  value,
  suffix,
  className,
}: {
  label:
    string;

  value:
    number;

  suffix:
    string;

  className:
    string;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-950/75 rounded-xl p-4">

      <p className="text-zinc-600 text-[7px]">
        {label}
      </p>

      <p
        className={`text-2xl font-black mt-2 ${className}`}
      >
        {value.toLocaleString()}
        {suffix}
      </p>

    </div>
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

      <p className="text-zinc-600 text-[7px]">
        {label}
      </p>

      <p className="text-white text-xs font-bold mt-2 break-all">
        {value}
      </p>

    </div>
  );
}

// =====================================
// RESET ROW
// =====================================

function PlanRow({
  label,
}: {
  label:
    string;
}) {
  return (
    <div className="flex items-center gap-3">

      <span className="text-red-400">
        ✕
      </span>

      <span className="text-zinc-300 text-sm">
        {label}
      </span>

    </div>
  );
}

// =====================================
// KEEP ROW
// =====================================

function KeepRow({
  label,
}: {
  label:
    string;
}) {
  return (
    <div className="flex items-center gap-3">

      <span className="text-lime-400">
        ✓
      </span>

      <span className="text-zinc-300 text-sm">
        {label}
      </span>

    </div>
  );
}