"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QtyStepper } from "@/components/shop/ShopBar";
import {
  cartCount,
  cartSubtotal,
  reconcileCart,
  replaceCart,
  setLineQuantity,
  useCart,
} from "@/lib/cart";
import {
  FREE_SHIPPING_MIN_THB,
  MAX_QTY_PER_LINE,
  formatTHB,
  shippingFeeFor,
  type ShopProduct,
} from "@/lib/shop";

export default function CartPage() {
  const lines = useCart();
  const [stockByVariant, setStockByVariant] = useState<Record<number, number>>({});
  const [notices, setNotices] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      try {
        const response = await fetch("/api/shop/products", { cache: "no-store" });
        const result = await response.json();
        if (!result.success || cancelled) return;

        const products = result.products as ShopProduct[];
        const stock: Record<number, number> = {};
        products.forEach((product) => product.variants.forEach((variant) => (stock[variant.id] = variant.stock)));
        setStockByVariant(stock);

        const reconciled = reconcileCart(lines, products);
        if (reconciled.changed) {
          setNotices(reconciled.notices);
          replaceCart(reconciled.lines);
        }
      } catch {
        // Offline — keep the snapshot; checkout re-validates anyway.
      }
    }

    void sync();
    return () => {
      cancelled = true;
    };
    // Reconcile once per visit, not on every quantity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = cartSubtotal(lines);
  const shipping = shippingFeeFor(subtotal);

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-xl px-6 py-32 text-center">
        <h1 className="text-3xl font-bold">ตะกร้าของคุณว่างอยู่</h1>
        <p className="mt-3 text-[var(--muted)]">เลือกชมสินค้าใหม่ล่าสุดจาก LOOTFORM</p>
        {notices.length > 0 && <Notices notices={notices} />}
        <Link
          href="/shop"
          className="mt-8 inline-block rounded-[var(--radius-md)] bg-[var(--foreground)] px-8 py-3.5 text-sm font-semibold text-black hover:opacity-90"
        >
          เลือกซื้อสินค้า
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold">
        ตะกร้าสินค้า <span className="font-mono text-lg text-[var(--muted)]">({cartCount(lines)})</span>
      </h1>

      {notices.length > 0 && <Notices notices={notices} />}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {lines.map((line) => {
            const stock = stockByVariant[line.variantId];
            const max = Math.min(MAX_QTY_PER_LINE, stock ?? MAX_QTY_PER_LINE);

            return (
              <li key={line.variantId} className="flex gap-5 py-6">
                <Link href={`/shop/${line.slug}`} className="shrink-0">
                  <img
                    src={line.image ?? "/logo.png"}
                    alt={line.name}
                    className="h-36 w-28 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] object-cover"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <Link href={`/shop/${line.slug}`} className="font-display font-semibold hover:text-[var(--grade-rare)]">
                        {line.name}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {[line.colorName, `ไซซ์ ${line.size}`].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-1 font-mono text-sm text-[var(--muted)]">{formatTHB(line.priceThb)}</p>
                    </div>
                    <p className="font-mono">{formatTHB(line.priceThb * line.quantity)}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <QtyStepper
                      value={line.quantity}
                      max={max}
                      onChange={(value) => setLineQuantity(line.variantId, Math.min(max, value))}
                    />
                    <button
                      type="button"
                      onClick={() => setLineQuantity(line.variantId, 0)}
                      className="text-xs text-[var(--muted)] underline underline-offset-4 hover:text-red-400"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 lg:sticky lg:top-40">
          <p className="font-display text-lg font-bold">สรุปคำสั่งซื้อ</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">ยอดรวมสินค้า</dt>
              <dd className="font-mono">{formatTHB(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">ค่าจัดส่ง</dt>
              <dd className="font-mono">{shipping === 0 ? "ฟรี" : formatTHB(shipping)}</dd>
            </div>
            {shipping > 0 && (
              <p className="text-xs text-[var(--muted)]">
                ช้อปเพิ่มอีก {formatTHB(FREE_SHIPPING_MIN_THB - subtotal)} เพื่อรับส่งฟรี
              </p>
            )}
            <div className="flex justify-between border-t border-[var(--border)] pt-4 text-base">
              <dt className="font-semibold">ยอดชำระทั้งหมด</dt>
              <dd className="font-mono font-semibold">{formatTHB(subtotal + shipping)}</dd>
            </div>
          </dl>
          <Link
            href="/checkout"
            className="mt-6 block rounded-[var(--radius-md)] bg-[var(--foreground)] py-4 text-center text-sm font-semibold text-black hover:opacity-90"
          >
            ดำเนินการชำระเงิน
          </Link>
          <Link href="/shop" className="mt-3 block text-center text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            ← เลือกซื้อสินค้าต่อ
          </Link>
        </aside>
      </div>
    </main>
  );
}

function Notices({ notices }: { notices: string[] }) {
  return (
    <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--grade-legendary)]/40 bg-[var(--grade-legendary)]/[0.06] p-4 text-left text-sm text-[var(--grade-legendary)]">
      {notices.map((notice) => (
        <p key={notice}>• {notice}</p>
      ))}
    </div>
  );
}
