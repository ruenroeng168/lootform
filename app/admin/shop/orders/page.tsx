"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type ShippingAddress = {
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string | null;
  district: string | null;
  province: string;
  postal_code: string;
};

type ShopOrder = {
  id: number;
  reference: string;
  user_id: string;
  user_email: string;
  item_name_snapshot: string;
  size: string | null;
  quantity: number;
  total_thb: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  slip_image_signed_url: string | null;
  reject_reason: string | null;
  shipping_address: ShippingAddress | null;
  created_at: string;
};

export default function AdminShopOrdersPage() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [orderStatus, setOrderStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [orders, setOrders] = useState<ShopOrder[]>([]);
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

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const result = await authenticatedFetch(`/api/admin/shop/orders?status=${orderStatus}`);
      setOrders(result.orders as ShopOrder[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load shop orders");
    } finally {
      setOrdersLoading(false);
    }
  }, [authenticatedFetch, orderStatus, router]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  async function reviewOrder(order: ShopOrder, action: "APPROVE" | "REJECT") {
    if (reviewingId !== null) return;

    if (action === "REJECT" && !rejectReasonById[order.id]?.trim()) {
      setError("กรุณาระบุเหตุผลที่ปฏิเสธก่อน");
      return;
    }

    setReviewingId(order.id);
    setError("");
    setSuccess("");

    try {
      await authenticatedFetch("/api/admin/shop/orders/review", {
        method: "PATCH",
        body: JSON.stringify({
          order_id: order.id,
          action,
          reject_reason: rejectReasonById[order.id] ?? "",
        }),
      });

      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSuccess(action === "APPROVE" ? "ORDER APPROVED — READY TO SHIP" : "ORDER REJECTED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review order");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="text-zinc-600 text-[9px] tracking-[0.3em]">LOOTFORM ADMIN</p>
            <h1 className="text-4xl sm:text-6xl font-black mt-2">
              SHOP <span className="text-lime-400">ORDERS</span>
            </h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/shop")}
              className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
            >
              MANAGE CATALOG →
            </button>
            <button
              onClick={() => router.push("/admin")}
              className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
            >
              ← ADMIN DASHBOARD
            </button>
          </div>
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

        <section className="mt-6 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-orange-400 text-[9px] tracking-[0.3em]">SLIP REVIEW</p>
              <h2 className="text-2xl font-black mt-2">ORDERS — NO LT, PLAIN GOODS</h2>
            </div>

            <div className="flex gap-2">
              {(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
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
                      {order.item_name_snapshot}
                      {order.size && <span className="text-zinc-400 ml-2 text-sm">ไซซ์ {order.size}</span>}
                      <span className="text-zinc-400 ml-2 text-sm">x{order.quantity}</span>
                    </p>
                    <p className="text-lime-400 font-black mt-1">฿{order.total_thb.toLocaleString()}</p>

                    {order.shipping_address && (
                      <p className="text-zinc-500 text-[11px] mt-2 leading-5">
                        {order.shipping_address.recipient_name} · {order.shipping_address.phone}
                        <br />
                        {order.shipping_address.address_line}{" "}
                        {order.shipping_address.subdistrict ?? ""} {order.shipping_address.district ?? ""}{" "}
                        {order.shipping_address.province} {order.shipping_address.postal_code}
                      </p>
                    )}

                    <p className="text-zinc-600 text-[10px] mt-2">
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
