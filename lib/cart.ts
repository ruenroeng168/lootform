"use client";

import { useSyncExternalStore } from "react";
import { MAX_CART_LINES, MAX_QTY_PER_LINE, formatTHB, type ShopProduct } from "@/lib/shop";

/* =========================================================
   LOOTFORM SHOP CART (client only)

   Persisted in localStorage so guests can shop before logging
   in. Each line is a snapshot for display — price and stock are
   re-checked against /api/shop/products on the cart page and
   re-priced by the database at checkout.
========================================================= */

export type CartLine = {
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  colorName: string | null;
  size: string;
  priceThb: number;
  image: string | null;
  quantity: number;
};

const STORAGE_KEY = "lootform.cart.v1";
const EMPTY: CartLine[] = [];

let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (cache) return cache;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? (parsed as CartLine[]) : [];
  } catch {
    cache = [];
  }

  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Storage blocked (private mode) — cart still works for this tab.
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.priceThb * line.quantity, 0);
}

/* Returns false when the cart is full or the line is capped. */
export function addToCart(line: Omit<CartLine, "quantity">, quantity: number, maxStock: number) {
  const lines = read();
  const existing = lines.find((item) => item.variantId === line.variantId);
  const cap = Math.min(MAX_QTY_PER_LINE, maxStock);

  if (existing) {
    const nextQuantity = Math.min(cap, existing.quantity + quantity);
    if (nextQuantity === existing.quantity) return false;

    write(
      lines.map((item) =>
        item.variantId === line.variantId ? { ...item, ...line, quantity: nextQuantity } : item
      )
    );
    return true;
  }

  if (lines.length >= MAX_CART_LINES || cap < 1) return false;

  write([...lines, { ...line, quantity: Math.min(cap, quantity) }]);
  return true;
}

export function setLineQuantity(variantId: number, quantity: number) {
  const lines = read();

  if (quantity <= 0) {
    write(lines.filter((line) => line.variantId !== variantId));
    return;
  }

  write(
    lines.map((line) =>
      line.variantId === variantId
        ? { ...line, quantity: Math.min(MAX_QTY_PER_LINE, quantity) }
        : line
    )
  );
}

export function replaceCart(lines: CartLine[]) {
  write(lines);
}

export function clearCart() {
  write([]);
}

/* Re-check the localStorage snapshot against live price/stock. */
export function reconcileCart(lines: CartLine[], products: ShopProduct[]) {
  const notices: string[] = [];
  const next: CartLine[] = [];

  for (const line of lines) {
    const product = products.find((item) => item.id === line.productId);
    const variant = product?.variants.find((item) => item.id === line.variantId);

    if (!product || !variant || variant.stock === 0) {
      notices.push(`${line.name} (${line.size}) หมดหรือไม่พร้อมจำหน่ายแล้ว — นำออกจากตะกร้า`);
      continue;
    }

    const quantity = Math.min(line.quantity, variant.stock, MAX_QTY_PER_LINE);
    if (quantity < line.quantity) {
      notices.push(`${product.name} (${variant.size}) เหลือ ${variant.stock} ชิ้น — ปรับจำนวนแล้ว`);
    }
    if (product.price_thb !== line.priceThb) {
      notices.push(`${product.name} ราคาเปลี่ยนเป็น ${formatTHB(product.price_thb)}`);
    }

    next.push({
      ...line,
      name: product.name,
      slug: product.slug,
      colorName: product.color_name,
      priceThb: product.price_thb,
      image: product.images[0] ?? null,
      quantity,
    });
  }

  return { lines: next, notices, changed: notices.length > 0 };
}
