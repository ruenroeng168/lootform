"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ORDER_STATUS_META, formatTHB, type ShopOrderStatus } from "@/lib/shop";

type OrderItem = {
  id: number;
  product_name: string;
  product_slug: string | null;
  size: string;
  image_url: string | null;
  unit_price_thb: number;
  quantity: number;
  line_total_thb: number;
};

type Order = {
  id: number;
  reference: string;
  status: ShopOrderStatus;
  subtotal_thb: number;
  shipping_fee_thb: number;
  total_thb: number;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string | null;
  district: string | null;
  province: string;
  postal_code: string;
  tracking_carrier: string | null;
  tracking_number: string | null;
  cancel_reason: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  items: OrderItem[];
};

const STEPS: { status: ShopOrderStatus; label: string; at: keyof Order }[] = [
  { status: "PENDING", label: "สั่งซื้อแล้ว", at: "created_at" },
  { status: "PAID", label: "ชำระเงินแล้ว", at: "paid_at" },
  { status: "SHIPPED", label: "จัดส่งแล้ว", at: "shipped_at" },
  { status: "DELIVERED", label: "ได้รับสินค้า", at: "delivered_at" },
];

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OrdersPage() {
  const [state, setState] = useState<"loading" | "guest" | "error" | "ready">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [placedReference, setPlacedReference] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      setPlacedReference(new URLSearchParams(window.location.search).get("placed"));

      if (!data.session) {
        setState("guest");
        return;
      }

      try {
        const response = await fetch("/api/shop/orders", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message);

        setOrders(result.orders as Order[]);
        setState("ready");
      } catch {
        setState("error");
      }
    }

    void load();
  }, []);

  if (state === "loading") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs tracking-[0.3em] text-[var(--muted)] animate-pulse">LOADING ORDERS...</p>
      </main>
    );
  }

  if (state === "guest") {
    return (
      <main className="mx-auto max-w-md px-6 py-28 text-center">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบเพื่อดูคำสั่งซื้อ</h1>
        <Link
          href="/login?next=/orders"
          className="mt-8 inline-block rounded-[var(--radius-md)] bg-[var(--foreground)] px-8 py-3.5 text-sm font-semibold text-black"
        >
          เข้าสู่ระบบ
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-12 sm:px-6">
      {placedReference && (
        <div className="mb-10 rounded-[var(--radius-lg)] border border-[#7bd88f]/40 bg-[#7bd88f]/[0.06] p-6">
          <p className="font-mono text-xs tracking-[0.2em] text-[#7bd88f]">ORDER PLACED ✓</p>
          <p className="mt-2 text-xl font-bold">ขอบคุณสำหรับคำสั่งซื้อ!</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            หมายเลขคำสั่งซื้อ <span className="font-mono text-[var(--foreground)]">{placedReference}</span> ·
            ทีมงานกำลังตรวจสอบสลิป และจะยืนยันภายใน 24 ชม.
          </p>
        </div>
      )}

      <h1 className="text-3xl font-bold">คำสั่งซื้อของฉัน</h1>

      {state === "error" && (
        <p className="mt-6 text-sm text-red-400">ไม่สามารถโหลดคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง</p>
      )}

      {state === "ready" && orders.length === 0 && (
        <div className="mt-10 rounded-[var(--radius-lg)] border border-[var(--border)] py-20 text-center">
          <p className="text-[var(--muted)]">ยังไม่มีคำสั่งซื้อ</p>
          <Link href="/shop" className="mt-4 inline-block text-sm underline underline-offset-4 hover:text-[var(--grade-rare)]">
            เริ่มช้อปเลย
          </Link>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} highlight={order.reference === placedReference} />
        ))}
      </div>
    </main>
  );
}

function OrderCard({ order, highlight }: { order: Order; highlight: boolean }) {
  const meta = ORDER_STATUS_META[order.status];
  const stepIndex = STEPS.findIndex((step) => step.status === order.status);
  const cancelled = order.status === "CANCELLED";

  return (
    <article
      className={`rounded-[var(--radius-lg)] border bg-[var(--surface)] ${
        highlight ? "border-[var(--grade-rare)]" : "border-[var(--border)]"
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <p className="font-mono text-sm">{order.reference}</p>
          <p className="text-xs text-[var(--muted)]">{formatDate(order.created_at)}</p>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ color: meta.color, borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)` }}
        >
          {meta.label}
        </span>
      </header>

      {!cancelled && (
        <ol className="grid grid-cols-4 gap-2 px-5 pt-5">
          {STEPS.map((step, index) => {
            const done = index <= stepIndex;
            return (
              <li key={step.status}>
                <div className={`h-1 rounded-full ${done ? "bg-[var(--grade-rare)]" : "bg-[var(--surface-raised)]"}`} />
                <p className={`mt-2 text-[11px] ${done ? "text-[var(--foreground)]" : "text-[var(--muted-dim)]"}`}>
                  {step.label}
                </p>
                <p className="font-mono text-[10px] text-[var(--muted-dim)]">
                  {formatDate(order[step.at] as string | null)}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <div className="px-5 py-4 text-sm text-[var(--muted)]">
        {cancelled && order.cancel_reason ? (
          <p className="text-red-400">เหตุผล: {order.cancel_reason}</p>
        ) : (
          <p>{meta.description}</p>
        )}
        {order.tracking_number && (
          <p className="mt-2">
            ขนส่ง <span className="text-[var(--foreground)]">{order.tracking_carrier}</span> · เลขพัสดุ{" "}
            <span className="font-mono text-[var(--foreground)] select-all">{order.tracking_number}</span>
          </p>
        )}
      </div>

      <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-4 px-5 py-3">
            <img
              src={item.image_url ?? "/logo.png"}
              alt=""
              className="h-16 w-12 rounded-[var(--radius-sm)] border border-[var(--border)] object-cover"
            />
            <div className="min-w-0 flex-1">
              {item.product_slug ? (
                <Link href={`/shop/${item.product_slug}`} className="text-sm font-semibold hover:text-[var(--grade-rare)]">
                  {item.product_name}
                </Link>
              ) : (
                <p className="text-sm font-semibold">{item.product_name}</p>
              )}
              <p className="text-xs text-[var(--muted)]">
                ไซซ์ {item.size} · {formatTHB(item.unit_price_thb)} × {item.quantity}
              </p>
            </div>
            <p className="font-mono text-sm">{formatTHB(item.line_total_thb)}</p>
          </li>
        ))}
      </ul>

      <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-[var(--border)] px-5 py-4 text-sm">
        <p className="max-w-md text-xs leading-relaxed text-[var(--muted)]">
          {order.recipient_name} · {order.phone}
          <br />
          {[order.address_line, order.subdistrict, order.district, order.province, order.postal_code]
            .filter(Boolean)
            .join(" ")}
        </p>
        <div className="text-right">
          <p className="text-xs text-[var(--muted)]">
            สินค้า {formatTHB(order.subtotal_thb)} · ค่าส่ง{" "}
            {order.shipping_fee_thb === 0 ? "ฟรี" : formatTHB(order.shipping_fee_thb)}
          </p>
          <p className="mt-1 font-mono text-lg">{formatTHB(order.total_thb)}</p>
        </div>
      </footer>
    </article>
  );
}
