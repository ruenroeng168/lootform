"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type TopupSettings = {
  id: number;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  qr_image_url: string | null;
  qr_image_path: string | null;
  rate_lt_per_thb: number;
  updated_at: string;
};

type TopupPackage = {
  id: number;
  amount_thb: number;
  label: string | null;
  is_active: boolean;
  sort_order: number;
};

type TopupOrder = {
  id: number;
  reference: string;
  user_id: string;
  user_email: string;
  amount_thb: number;
  token_amount: number;
  status: "PENDING" | "PAID" | "REJECTED";
  slip_image_signed_url: string | null;
  reject_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const MAX_QR_SIZE = 5 * 1024 * 1024;

function validateQrFile(file: File) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return "รองรับเฉพาะ JPEG, PNG และ WEBP";
  if (file.size > MAX_QR_SIZE) return "QR Image ต้องไม่เกิน 5 MB";
  return "";
}

export default function AdminTopupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [settings, setSettings] = useState<TopupSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  const [packages, setPackages] = useState<TopupPackage[]>([]);
  const [newPackageAmount, setNewPackageAmount] = useState("");
  const [newPackageLabel, setNewPackageLabel] = useState("");
  const [savingPackage, setSavingPackage] = useState(false);

  const [orderStatus, setOrderStatus] = useState<"PENDING" | "PAID" | "REJECTED">("PENDING");
  const [orders, setOrders] = useState<TopupOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [rejectReasonById, setRejectReasonById] = useState<Record<number, string>>({});

  const authenticatedFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw new Error(sessionError.message);
      if (!data.session) throw new Error("Admin session not found. Please login again.");

      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
          ...(options?.headers ?? {}),
        },
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Request failed");
      }

      return result;
    },
    []
  );

  const loadSettingsAndPackages = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const [settingsResult, packagesResult] = await Promise.all([
        authenticatedFetch("/api/admin/topup/settings"),
        authenticatedFetch("/api/admin/topup/packages"),
      ]);

      setSettings(settingsResult.settings as TopupSettings);
      setPackages(packagesResult.packages as TopupPackage[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load top-up admin data");
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, router]);

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const result = await authenticatedFetch(`/api/admin/topup/orders?status=${orderStatus}`);
      setOrders(result.orders as TopupOrder[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load top-up orders");
    } finally {
      setOrdersLoading(false);
    }
  }, [authenticatedFetch, orderStatus]);

  useEffect(() => {
    loadSettingsAndPackages();
  }, [loadSettingsAndPackages]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function saveSettings() {
    if (!settings) return;

    setSavingSettings(true);
    setError("");
    setSuccess("");

    try {
      const result = await authenticatedFetch("/api/admin/topup/settings", {
        method: "PATCH",
        body: JSON.stringify({
          bank_name: settings.bank_name,
          bank_account_name: settings.bank_account_name,
          bank_account_number: settings.bank_account_number,
          rate_lt_per_thb: settings.rate_lt_per_thb,
        }),
      });

      setSettings(result.settings as TopupSettings);
      setSuccess("TOP-UP SETTINGS SAVED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function uploadQr(file: File) {
    const validationError = validateQrFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSuccess("");
    setUploadingQr(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/topup/settings/upload-qr", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Unable to upload QR image");
      }

      setSettings(result.settings as TopupSettings);
      setSuccess("QR IMAGE UPLOADED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload QR image");
    } finally {
      setUploadingQr(false);
    }
  }

  async function createPackage() {
    const amount = Number(newPackageAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("กรุณาใส่จำนวนเงินให้ถูกต้อง");
      return;
    }

    setSavingPackage(true);
    setError("");
    setSuccess("");

    try {
      const result = await authenticatedFetch("/api/admin/topup/packages", {
        method: "POST",
        body: JSON.stringify({
          amount_thb: amount,
          label: newPackageLabel,
          sort_order: packages.length,
        }),
      });

      setPackages((current) => [...current, result.package as TopupPackage]);
      setNewPackageAmount("");
      setNewPackageLabel("");
      setSuccess("PACKAGE ADDED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create package");
    } finally {
      setSavingPackage(false);
    }
  }

  async function togglePackageActive(pkg: TopupPackage) {
    try {
      const result = await authenticatedFetch("/api/admin/topup/packages", {
        method: "PATCH",
        body: JSON.stringify({ id: pkg.id, is_active: !pkg.is_active }),
      });

      setPackages((current) =>
        current.map((item) => (item.id === pkg.id ? (result.package as TopupPackage) : item))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update package");
    }
  }

  async function deletePackage(pkg: TopupPackage) {
    try {
      await authenticatedFetch(`/api/admin/topup/packages?id=${pkg.id}`, { method: "DELETE" });
      setPackages((current) => current.filter((item) => item.id !== pkg.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete package");
    }
  }

  async function reviewOrder(order: TopupOrder, action: "APPROVE" | "REJECT") {
    if (reviewingId !== null) return;

    if (action === "REJECT" && !rejectReasonById[order.id]?.trim()) {
      setError("กรุณาระบุเหตุผลที่ปฏิเสธก่อน");
      return;
    }

    setReviewingId(order.id);
    setError("");
    setSuccess("");

    try {
      await authenticatedFetch("/api/admin/topup/orders/review", {
        method: "PATCH",
        body: JSON.stringify({
          order_id: order.id,
          action,
          reject_reason: rejectReasonById[order.id] ?? "",
        }),
      });

      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSuccess(action === "APPROVE" ? "ORDER APPROVED — WALLET CREDITED" : "ORDER REJECTED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review order");
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-lime-400 tracking-[0.35em] animate-pulse">LOADING TOP-UP ADMIN...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="text-zinc-600 text-[9px] tracking-[0.3em]">LOOTFORM ADMIN</p>
            <h1 className="text-4xl sm:text-6xl font-black mt-2">
              TOP-UP <span className="text-lime-400">CONTROL</span>
            </h1>
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
          >
            ← ADMIN DASHBOARD
          </button>
        </div>

        {error && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] rounded-xl p-5 text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 border border-lime-400/30 bg-lime-400/[0.07] rounded-xl p-5 text-lime-400 font-black">
            ✓ {success}
          </div>
        )}

        {/* =====================================
            SETTINGS
        ===================================== */}

        {settings && (
          <section className="mt-8 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">
            <p className="text-cyan-400 text-[9px] tracking-[0.3em]">PAYMENT DETAILS</p>
            <h2 className="text-2xl font-black mt-2">BANK / QR SETTINGS</h2>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div className="space-y-4">
                <Field
                  label="BANK NAME"
                  value={settings.bank_name}
                  onChange={(value) => setSettings({ ...settings, bank_name: value })}
                />
                <Field
                  label="ACCOUNT NAME"
                  value={settings.bank_account_name}
                  onChange={(value) => setSettings({ ...settings, bank_account_name: value })}
                />
                <Field
                  label="ACCOUNT NUMBER"
                  value={settings.bank_account_number}
                  onChange={(value) => setSettings({ ...settings, bank_account_number: value })}
                />
                <div>
                  <label className="text-zinc-600 text-[8px] tracking-[0.25em]">
                    RATE (LT PER 1 THB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settings.rate_lt_per_thb}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        rate_lt_per_thb: Number(event.target.value) || 0,
                      })
                    }
                    className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-lime-400 font-black outline-none focus:border-lime-400"
                  />
                </div>

                <button
                  onClick={saveSettings}
                  disabled={savingSettings}
                  className="w-full bg-lime-400 text-black rounded-xl py-3.5 font-black hover:bg-lime-300 disabled:bg-zinc-800 disabled:text-zinc-600 transition"
                >
                  {savingSettings ? "SAVING..." : "SAVE SETTINGS"}
                </button>
              </div>

              <div>
                <p className="text-zinc-600 text-[8px] tracking-[0.2em]">QR CODE IMAGE</p>

                {settings.qr_image_url ? (
                  <div className="mt-3 flex h-[220px] items-center justify-center rounded-xl border border-zinc-800 bg-black/50 overflow-hidden">
                    <img
                      src={settings.qr_image_url}
                      alt="Top-up QR"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="mt-3 flex h-[220px] items-center justify-center rounded-xl border border-dashed border-zinc-700 text-zinc-600 text-xs">
                    NO QR IMAGE SET
                  </div>
                )}

                <label className="mt-4 block">
                  <span
                    className={`inline-block w-full text-center border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 rounded-xl py-3 text-xs font-black cursor-pointer hover:bg-cyan-400/10 transition ${
                      uploadingQr ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {uploadingQr ? "UPLOADING..." : "UPLOAD QR IMAGE"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingQr}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadQr(file);
                    }}
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {/* =====================================
            PACKAGES
        ===================================== */}

        <section className="mt-6 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">
          <p className="text-purple-400 text-[9px] tracking-[0.3em]">PLAYER OPTIONS</p>
          <h2 className="text-2xl font-black mt-2">TOP-UP PACKAGES</h2>

          <div className="mt-5 space-y-2">
            {packages.length === 0 && (
              <p className="text-zinc-600 text-sm">ยังไม่มีแพ็คเกจ — เพิ่มด้านล่าง</p>
            )}

            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between gap-4 border border-zinc-800 bg-black/40 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-white font-black">
                    ฿{pkg.amount_thb.toLocaleString()}
                    {settings && (
                      <span className="text-lime-400 ml-2 text-sm">
                        → {Math.round(pkg.amount_thb * settings.rate_lt_per_thb)} LT
                      </span>
                    )}
                  </p>
                  {pkg.label && <p className="text-zinc-600 text-xs mt-0.5">{pkg.label}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePackageActive(pkg)}
                    className={`rounded-lg border px-3 py-2 text-[10px] font-black transition ${
                      pkg.is_active
                        ? "border-lime-400/30 bg-lime-400/[0.05] text-lime-400"
                        : "border-zinc-700 bg-black/50 text-zinc-500"
                    }`}
                  >
                    {pkg.is_active ? "ACTIVE" : "INACTIVE"}
                  </button>

                  <button
                    onClick={() => deletePackage(pkg)}
                    className="rounded-lg border border-red-400/20 bg-red-400/[0.03] px-3 py-2 text-[10px] font-black text-red-400/70 hover:border-red-400 hover:text-red-400 transition"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid sm:grid-cols-[1fr_1fr_auto] gap-3">
            <input
              type="number"
              min="0"
              placeholder="จำนวนเงิน (THB)"
              value={newPackageAmount}
              onChange={(event) => setNewPackageAmount(event.target.value)}
              className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
            />
            <input
              type="text"
              placeholder="ป้ายกำกับ (ไม่บังคับ)"
              value={newPackageLabel}
              onChange={(event) => setNewPackageLabel(event.target.value)}
              className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
            />
            <button
              onClick={createPackage}
              disabled={savingPackage}
              className="border border-purple-400/30 bg-purple-400/[0.05] text-purple-400 rounded-xl px-6 py-3 text-xs font-black hover:bg-purple-400/10 disabled:opacity-50 transition"
            >
              {savingPackage ? "ADDING..." : "+ ADD PACKAGE"}
            </button>
          </div>
        </section>

        {/* =====================================
            ORDERS
        ===================================== */}

        <section className="mt-6 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-orange-400 text-[9px] tracking-[0.3em]">SLIP REVIEW</p>
              <h2 className="text-2xl font-black mt-2">TOP-UP ORDERS</h2>
            </div>

            <div className="flex gap-2">
              {(["PENDING", "PAID", "REJECTED"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setOrderStatus(status)}
                  className={`rounded-lg border px-4 py-2 text-[10px] font-black transition ${
                    orderStatus === status
                      ? "border-orange-400 bg-orange-400/10 text-orange-400"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {ordersLoading ? (
              <p className="text-zinc-600 text-sm">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-zinc-600 text-sm">ไม่มีรายการในสถานะนี้</p>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="grid sm:grid-cols-[140px_1fr_auto] gap-4 border border-zinc-800 bg-black/40 rounded-2xl p-4"
                >
                  <div className="flex h-[140px] items-center justify-center rounded-xl border border-zinc-800 bg-black/60 overflow-hidden">
                    {order.slip_image_signed_url ? (
                      <img
                        src={order.slip_image_signed_url}
                        alt="Payment slip"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <p className="text-zinc-600 text-[9px]">NO SLIP</p>
                    )}
                  </div>

                  <div>
                    <p className="font-mono text-cyan-400 text-xs">{order.reference}</p>
                    <p className="text-zinc-500 text-xs mt-1">{order.user_email}</p>
                    <p className="mt-2 text-white font-black">
                      ฿{order.amount_thb.toLocaleString()}{" "}
                      <span className="text-lime-400">→ {order.token_amount} LT</span>
                    </p>
                    <p className="text-zinc-600 text-[10px] mt-1">
                      {new Date(order.created_at).toLocaleString("th-TH")}
                    </p>

                    {order.status === "REJECTED" && order.reject_reason && (
                      <p className="text-red-400 text-xs mt-2">เหตุผล: {order.reject_reason}</p>
                    )}

                    {order.status === "PENDING" && (
                      <input
                        type="text"
                        placeholder="เหตุผล (กรอกถ้าจะปฏิเสธ)"
                        value={rejectReasonById[order.id] ?? ""}
                        onChange={(event) =>
                          setRejectReasonById((current) => ({
                            ...current,
                            [order.id]: event.target.value,
                          }))
                        }
                        className="mt-3 w-full border border-zinc-800 bg-black/50 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-400"
                      />
                    )}
                  </div>

                  {order.status === "PENDING" && (
                    <div className="flex flex-col gap-2 justify-center">
                      <button
                        onClick={() => reviewOrder(order, "APPROVE")}
                        disabled={reviewingId === order.id}
                        className="rounded-xl bg-lime-400 text-black px-5 py-3 text-xs font-black hover:bg-lime-300 disabled:opacity-50 transition"
                      >
                        {reviewingId === order.id ? "..." : "APPROVE"}
                      </button>
                      <button
                        onClick={() => reviewOrder(order, "REJECT")}
                        disabled={reviewingId === order.id}
                        className="rounded-xl border border-red-400/30 bg-red-400/[0.05] text-red-400 px-5 py-3 text-xs font-black hover:bg-red-400/10 disabled:opacity-50 transition"
                      >
                        REJECT
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-zinc-600 text-[8px] tracking-[0.25em]">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full mt-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}
