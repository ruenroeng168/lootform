"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cartCount, cartSubtotal, setLineQuantity, useCart } from "@/lib/cart";
import { FREE_SHIPPING_MIN_THB, SHOP_CATEGORIES, formatTHB, shippingFeeFor } from "@/lib/shop";

/* =========================================================
   SHOP BAR — store navigation under the global Navbar

   Category links, "my orders" and the cart button. Also owns
   the slide-in mini cart, opened by openCartDrawer() after an
   item is added anywhere in the store.
========================================================= */

const OPEN_EVENT = "lootform:cart-open";

export function openCartDrawer() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export default function ShopBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lines = useCart();
  const count = cartCount(lines);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const open = () => setDrawerOpen(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const activeCategory = pathname === "/shop" ? searchParams.get("category") : null;

  return (
    <>
      <div className="border-b border-[var(--border)] bg-[var(--surface)] text-center text-[11px] tracking-[0.08em] text-[var(--muted)] py-2 px-4">
        ส่งฟรีทั่วประเทศเมื่อช้อปครบ{" "}
        <span className="text-[var(--foreground)] font-semibold">{formatTHB(FREE_SHIPPING_MIN_THB)}</span>
        <span className="mx-2 text-[var(--muted-dim)]">·</span>
        เปลี่ยนไซซ์ได้ภายใน 7 วัน
      </div>

      <div className="sticky top-[76px] z-40 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <Link href="/shop" className="font-display text-sm font-bold tracking-[0.2em] shrink-0">
            LOOTFORM <span className="text-[var(--grade-rare)]">STORE</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
            <ShopNavLink href="/shop" active={pathname === "/shop" && !activeCategory}>
              ทั้งหมด
            </ShopNavLink>
            {SHOP_CATEGORIES.map((category) => (
              <ShopNavLink
                key={category.code}
                href={`/shop?category=${category.code}`}
                active={activeCategory === category.code}
              >
                {category.label}
              </ShopNavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/orders"
              className={`hidden sm:inline-flex h-9 items-center rounded-[var(--radius-md)] px-3 text-xs transition hover:text-[var(--foreground)] ${
                pathname === "/orders" ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
            >
              คำสั่งซื้อของฉัน
            </Link>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] px-3 text-xs font-semibold transition hover:border-[var(--foreground)]"
              aria-label={`ตะกร้าสินค้า ${count} ชิ้น`}
            >
              <BagIcon />
              <span className="hidden sm:inline">ตะกร้า</span>
              <span
                className={`min-w-5 h-5 rounded-full px-1.5 text-[11px] leading-5 font-mono ${
                  count > 0 ? "bg-[var(--grade-rare)] text-black" : "bg-[var(--surface-raised)] text-[var(--muted)]"
                }`}
              >
                {count}
              </span>
            </button>
          </div>
        </div>

        <nav className="md:hidden flex gap-1 overflow-x-auto px-4 pb-2 -mt-1 [scrollbar-width:none]">
          <ShopNavLink href="/shop" active={pathname === "/shop" && !activeCategory}>
            ทั้งหมด
          </ShopNavLink>
          {SHOP_CATEGORIES.map((category) => (
            <ShopNavLink
              key={category.code}
              href={`/shop?category=${category.code}`}
              active={activeCategory === category.code}
            >
              {category.label}
            </ShopNavLink>
          ))}
          <ShopNavLink href="/orders" active={pathname === "/orders"}>
            คำสั่งซื้อ
          </ShopNavLink>
        </nav>
      </div>

      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function ShopNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-[var(--radius-md)] px-3 py-1.5 text-xs transition ${
        active
          ? "bg-[var(--surface-raised)] text-[var(--foreground)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </Link>
  );
}

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lines = useCart();
  const subtotal = cartSubtotal(lines);
  const remaining = Math.max(0, FREE_SHIPPING_MIN_THB - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_MIN_THB) * 100);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />

      <aside
        role="dialog"
        aria-label="ตะกร้าสินค้า"
        className={`absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-[var(--border)] bg-[var(--bg)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 h-16">
          <p className="font-display font-bold tracking-[0.15em]">
            ตะกร้า <span className="font-mono text-sm text-[var(--muted)]">({cartCount(lines)})</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-[var(--radius-md)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <BagIcon size={40} />
            <p className="text-[var(--muted)]">ยังไม่มีสินค้าในตะกร้า</p>
            <Link
              href="/shop"
              onClick={onClose}
              className="rounded-[var(--radius-md)] bg-[var(--foreground)] px-6 py-3 text-sm font-semibold text-black hover:opacity-90"
            >
              เลือกซื้อสินค้า
            </Link>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <p className="text-xs text-[var(--muted)]">
                {remaining > 0 ? (
                  <>
                    ช้อปเพิ่มอีก <span className="text-[var(--foreground)] font-semibold">{formatTHB(remaining)}</span> เพื่อรับส่งฟรี
                  </>
                ) : (
                  <span className="text-[#7bd88f]">✓ คุณได้รับสิทธิ์ส่งฟรี</span>
                )}
              </p>
              <div className="mt-2 h-1 rounded-full bg-[var(--surface-raised)] overflow-hidden">
                <div className="h-full bg-[var(--grade-rare)] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
              {lines.map((line) => (
                <li key={line.variantId} className="flex gap-4 px-5 py-4">
                  <Link href={`/shop/${line.slug}`} onClick={onClose} className="shrink-0">
                    <img
                      src={line.image ?? "/logo.png"}
                      alt={line.name}
                      className="h-24 w-20 rounded-[var(--radius-sm)] object-cover bg-[var(--surface)]"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate text-sm font-semibold">{line.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {[line.colorName, `ไซซ์ ${line.size}`].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <QtyStepper
                        value={line.quantity}
                        onChange={(value) => setLineQuantity(line.variantId, value)}
                      />
                      <p className="font-mono text-sm">{formatTHB(line.priceThb * line.quantity)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-[var(--border)] px-5 py-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">ยอดรวมสินค้า</span>
                <span className="font-mono">{formatTHB(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">ค่าจัดส่ง</span>
                <span className="font-mono">
                  {shippingFeeFor(subtotal) === 0 ? "ฟรี" : formatTHB(shippingFeeFor(subtotal))}
                </span>
              </div>
              <Link
                href="/checkout"
                onClick={onClose}
                className="block w-full rounded-[var(--radius-md)] bg-[var(--foreground)] py-3.5 text-center text-sm font-semibold text-black hover:opacity-90"
              >
                ชำระเงิน · {formatTHB(subtotal + shippingFeeFor(subtotal))}
              </Link>
              <Link
                href="/cart"
                onClick={onClose}
                className="block w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] py-3 text-center text-sm hover:border-[var(--foreground)]"
              >
                ดูตะกร้าสินค้า
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function QtyStepper({
  value,
  onChange,
  max = 10,
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}) {
  return (
    <div className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border-strong)]">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className="h-full w-8 text-[var(--muted)] hover:text-[var(--foreground)]"
        aria-label="ลดจำนวน"
      >
        −
      </button>
      <span className="w-7 text-center font-mono text-sm">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="h-full w-8 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
        aria-label="เพิ่มจำนวน"
      >
        +
      </button>
    </div>
  );
}

export function BagIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M5 8h14l-1 13H6L5 8Z" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
