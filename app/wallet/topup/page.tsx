"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

// =====================================
// TYPES
// =====================================

type TopupPackage = {
  id: number;
  amount_thb: number;
  label: string | null;
};

type TopupSettings = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  qr_image_url: string | null;
  rate_lt_per_thb: number;
};

type SubmittedOrder = {
  id: number;
  reference: string;
  amount_thb: number;
  token_amount: number;
  status: string;
};

type TopupSuccess = {
  reference: string;
  order_id: number;
  token_amount: number;
  balance: number;
};

const MAX_SLIP_SIZE = 5 * 1024 * 1024;

function validateSlipFile(file: File) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return "รองรับเฉพาะไฟล์ JPEG, PNG และ WEBP";
  if (file.size > MAX_SLIP_SIZE) return "สลิปต้องมีขนาดไม่เกิน 5 MB";
  return "";
}

// =====================================
// PAGE
// =====================================

export default function WalletTopupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [balance, setBalance] = useState(0);

  const [packages, setPackages] = useState<TopupPackage[]>([]);
  const [settings, setSettings] = useState<TopupSettings | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);

  const [testToppingUp, setTestToppingUp] = useState(false);
  const [testSuccess, setTestSuccess] = useState<TopupSuccess | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  // =====================================
  // LOAD
  // =====================================

  async function loadAll() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      setUserEmail(session.user.email ?? "PLAYER");

      const [{ data: wallet, error: walletError }, packagesResponse] = await Promise.all([
        supabase.from("wallets").select("balance").eq("user_id", session.user.id).maybeSingle(),
        fetch("/api/topup/packages", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        }),
      ]);

      if (walletError) throw walletError;

      setBalance(Number(wallet?.balance ?? 0));

      const packagesResult = await packagesResponse.json();

      if (!packagesResponse.ok || !packagesResult.success) {
        throw new Error(packagesResult.message || "Unable to load top-up options");
      }

      setPackages(packagesResult.packages as TopupPackage[]);
      setSettings(packagesResult.settings as TopupSettings | null);
    } catch (error) {
      console.error("LOAD TOPUP ERROR:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load top-up");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // =====================================
  // SUBMIT REAL TOP-UP REQUEST
  // =====================================

  async function submitTopupRequest() {
    if (!selectedPackageId) {
      setErrorMessage("กรุณาเลือกแพ็คเกจก่อน");
      return;
    }

    if (!slipFile) {
      setErrorMessage("กรุณาแนบสลิปการโอนเงิน");
      return;
    }

    const validationError = validateSlipFile(slipFile);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const formData = new FormData();
      formData.append("package_id", String(selectedPackageId));
      formData.append("file", slipFile);

      const response = await fetch("/api/wallet/topup/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "ไม่สามารถส่งคำขอเติมเงินได้");
      }

      setSubmittedOrder(result.order as SubmittedOrder);
      setSelectedPackageId(null);
      setSlipFile(null);
    } catch (error) {
      console.error("TOPUP REQUEST ERROR:", error);
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถส่งคำขอเติมเงินได้");
    } finally {
      setSubmitting(false);
    }
  }

  // =====================================
  // TEST TOP-UP (dev convenience, server rejects outside TEST mode)
  // =====================================

  async function testTopup() {
    setTestToppingUp(true);
    setErrorMessage("");
    setTestSuccess(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/wallet/topup/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packageCode: "LT100" }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "ไม่สามารถเติม LT ได้");
      }

      const topup = result.topup as TopupSuccess;
      setTestSuccess(topup);
      setBalance(Number(topup.balance ?? 0));
    } catch (error) {
      console.error("TEST TOPUP ERROR:", error);
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถเติม LT ได้");
    } finally {
      setTestToppingUp(false);
    }
  }

  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? null;
  const selectedTokenAmount =
    selectedPackage && settings ? Math.round(selectedPackage.amount_thb * settings.rate_lt_per_thb) : 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-lime-400 tracking-[0.35em] animate-pulse">LOADING TOP-UP...</p>
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
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <section className="flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border border-cyan-400/30 bg-cyan-400/5 flex items-center justify-center text-cyan-400 font-black">
              P1
            </div>
            <div>
              <p className="text-zinc-600 text-[9px] tracking-[0.25em]">PLAYER</p>
              <p className="text-cyan-400 text-sm mt-1">{userEmail}</p>
            </div>
          </div>

          <button
            onClick={() => router.push("/wallet")}
            className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
          >
            ← WALLET
          </button>
        </section>

        <section className="mt-10">
          <h1 className="text-5xl sm:text-7xl font-black">
            TOP UP <span className="text-lime-400">TOKEN</span>
          </h1>
          <p className="text-zinc-500 mt-4 max-w-xl">
            เลือกแพ็คเกจ โอนเงินตามบัญชี/QR ที่แสดง แล้วแนบสลิป — แอดมินจะตรวจสอบและเติม LT
            ให้เมื่ออนุมัติ
          </p>
        </section>

        {errorMessage && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">
            ⚠ {errorMessage}
          </div>
        )}

        {submittedOrder && (
          <section className="mt-6 border border-cyan-400/30 bg-cyan-400/[0.05] rounded-2xl p-6">
            <p className="text-cyan-400 text-[9px] tracking-[0.25em]">คำขอส่งสำเร็จ</p>
            <p className="text-white text-2xl font-black mt-3">รอการตรวจสอบจากแอดมิน</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-5">
              <Info label="REFERENCE" value={submittedOrder.reference} />
              <Info label="จำนวนเงิน" value={`฿${submittedOrder.amount_thb.toLocaleString()}`} />
              <Info label="LT ที่จะได้รับ" value={`${submittedOrder.token_amount} LT`} />
            </div>
          </section>
        )}

        <section className="mt-8 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">
          <p className="text-zinc-600 text-[9px] tracking-[0.25em]">CURRENT BALANCE</p>
          <div className="flex items-end gap-3 mt-4">
            <p className="text-lime-400 text-6xl sm:text-8xl font-black">
              {balance.toLocaleString()}
            </p>
            <p className="text-zinc-500 text-xl font-black mb-2">LT</p>
          </div>
        </section>

        {/* =====================================
            1. SELECT PACKAGE
        ===================================== */}

        <section className="mt-6">
          <p className="text-cyan-400 text-[9px] tracking-[0.25em]">STEP 1</p>
          <h2 className="text-2xl sm:text-3xl font-black mt-2">เลือกแพ็คเกจ</h2>

          {packages.length === 0 ? (
            <p className="text-zinc-600 text-sm mt-4">ยังไม่มีแพ็คเกจให้เลือกในขณะนี้</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {packages.map((pkg) => {
                const tokenAmount = settings
                  ? Math.round(pkg.amount_thb * settings.rate_lt_per_thb)
                  : 0;
                const selected = selectedPackageId === pkg.id;

                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-lime-400 bg-lime-400/[0.08]"
                        : "border-zinc-800 bg-black/40 hover:border-zinc-600"
                    }`}
                  >
                    <p className="text-white text-2xl font-black">฿{pkg.amount_thb.toLocaleString()}</p>
                    <p className="text-lime-400 text-sm font-black mt-1">{tokenAmount} LT</p>
                    {pkg.label && <p className="text-zinc-600 text-[10px] mt-1">{pkg.label}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* =====================================
            2. PAY + 3. ATTACH SLIP
        ===================================== */}

        {selectedPackage && (
          <section className="mt-6 border border-lime-400/30 bg-gradient-to-br from-lime-400/[0.06] to-black rounded-[28px] overflow-hidden">
            <div className="p-6 sm:p-8">
              <p className="text-cyan-400 text-[9px] tracking-[0.25em]">STEP 2</p>
              <h2 className="text-2xl font-black mt-2">โอนเงินตามรายละเอียดนี้</h2>

              <div className="grid sm:grid-cols-[auto_1fr] gap-6 mt-5">
                <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-black/50 p-4 h-[200px] w-[200px] mx-auto sm:mx-0">
                  {settings?.qr_image_url ? (
                    <img
                      src={settings.qr_image_url}
                      alt="Payment QR"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <p className="text-zinc-600 text-[10px] text-center">ยังไม่มี QR</p>
                  )}
                </div>

                <div className="space-y-3">
                  <Info label="ธนาคาร" value={settings?.bank_name || "-"} />
                  <Info label="ชื่อบัญชี" value={settings?.bank_account_name || "-"} />
                  <Info label="เลขบัญชี" value={settings?.bank_account_number || "-"} />
                  <Info
                    label="ยอดที่ต้องโอน"
                    value={`฿${selectedPackage.amount_thb.toLocaleString()} → ${selectedTokenAmount} LT`}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 p-6 sm:p-8">
              <p className="text-cyan-400 text-[9px] tracking-[0.25em]">STEP 3</p>
              <h2 className="text-2xl font-black mt-2">แนบสลิปการโอนเงิน</h2>

              <label className="mt-4 block">
                <span className="inline-block w-full text-center border border-dashed border-zinc-700 rounded-xl py-8 text-zinc-400 text-xs font-black cursor-pointer hover:border-lime-400 hover:text-lime-400 transition">
                  {slipFile ? slipFile.name : "แตะเพื่อเลือกไฟล์สลิป (JPEG/PNG/WEBP, ≤5MB)"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => setSlipFile(event.target.files?.[0] ?? null)}
                />
              </label>

              <button
                onClick={submitTopupRequest}
                disabled={submitting}
                className="w-full mt-5 bg-lime-400 text-black py-5 rounded-xl text-sm font-black hover:bg-lime-300 disabled:bg-zinc-800 disabled:text-zinc-600 transition"
              >
                {submitting ? "กำลังส่งคำขอ..." : "ส่งคำขอเติมเงิน"}
              </button>
            </div>
          </section>
        )}

        {/* =====================================
            DEV TEST TOP-UP
        ===================================== */}

        <section className="mt-10 border border-yellow-300/20 bg-yellow-300/[0.02] rounded-2xl p-6">
          <div className="inline-flex items-center gap-2 border border-yellow-300/20 bg-yellow-300/5 rounded-full px-4 py-2">
            <span className="w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse" />
            <span className="text-yellow-300 text-[9px] tracking-[0.3em]">DEV / TEST ONLY</span>
          </div>

          <p className="text-zinc-500 text-xs mt-4">
            ปุ่มนี้ใช้ทดสอบระบบเท่านั้น — เติม 100 LT ทันทีโดยไม่ต้องโอนเงินจริง
            ใช้ได้เฉพาะตอนระบบอยู่ใน TEST mode เท่านั้น
          </p>

          {testSuccess && (
            <p className="text-lime-400 text-sm font-black mt-3">
              +{testSuccess.token_amount} LT (Ref: {testSuccess.reference})
            </p>
          )}

          <button
            disabled={testToppingUp}
            onClick={testTopup}
            className="mt-4 border border-yellow-300/30 bg-yellow-300/[0.05] text-yellow-300 py-3 px-6 rounded-xl text-xs font-black hover:bg-yellow-300/10 disabled:opacity-50 transition"
          >
            {testToppingUp ? "PROCESSING..." : "TEST TOP-UP +100 LT"}
          </button>
        </section>
      </div>
    </main>
  );
}

// =====================================
// INFO
// =====================================

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">
      <p className="text-zinc-600 text-[8px] tracking-[0.18em]">{label}</p>
      <p className="text-white text-sm font-black mt-2 break-all">{value}</p>
    </div>
  );
}
