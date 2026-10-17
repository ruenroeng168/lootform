"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/shop/ProductCard";
import { SHOP_CATEGORIES, SHOP_SIZE_ORDER, totalStock, type ShopProduct } from "@/lib/shop";

type SortKey = "featured" | "newest" | "price-asc" | "price-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "แนะนำ" },
  { value: "newest", label: "มาใหม่" },
  { value: "price-asc", label: "ราคา: ต่ำ → สูง" },
  { value: "price-desc", label: "ราคา: สูง → ต่ำ" },
];

export default function ShopCatalog({
  products,
  initialCategory,
}: {
  products: ShopProduct[];
  initialCategory: string | null;
}) {
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [size, setSize] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");

  // Keep the chip state in sync when the ShopBar links change ?category=.
  const [syncedInitial, setSyncedInitial] = useState(initialCategory);
  if (syncedInitial !== initialCategory) {
    setSyncedInitial(initialCategory);
    setCategory(initialCategory);
  }

  const sizes = useMemo(() => {
    const all = new Set(products.flatMap((product) => product.variants.map((variant) => variant.size)));
    return SHOP_SIZE_ORDER.filter((value) => all.has(value));
  }, [products]);

  const visible = useMemo(() => {
    const filtered = products.filter((product) => {
      if (category && product.category !== category) return false;
      if (inStockOnly && totalStock(product) === 0) return false;
      if (size) {
        const variant = product.variants.find((item) => item.size === size);
        if (!variant || (inStockOnly && variant.stock === 0)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    if (sort === "price-asc") sorted.sort((a, b) => a.price_thb - b.price_thb);
    if (sort === "price-desc") sorted.sort((a, b) => b.price_thb - a.price_thb);
    if (sort === "newest") sorted.sort((a, b) => Number(b.is_new) - Number(a.is_new) || b.id - a.id);
    if (sort === "featured") sorted.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
    return sorted;
  }, [products, category, size, inStockOnly, sort]);

  function selectCategory(next: string | null) {
    setCategory(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("category", next);
    else url.searchParams.delete("category");
    window.history.replaceState(null, "", url);
  }

  return (
    <section id="catalog" className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 scroll-mt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--grade-rare)]">ALL PRODUCTS</p>
          <h2 className="mt-2 text-3xl font-bold">
            {category ? SHOP_CATEGORIES.find((item) => item.code === category)?.label : "สินค้าทั้งหมด"}
          </h2>
        </div>
        <p className="font-mono text-xs text-[var(--muted)]">{visible.length} รายการ</p>
      </div>

      <div className="mt-6 flex flex-col gap-4 border-y border-[var(--border)] py-4 lg:flex-row lg:items-center">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          <Chip active={!category} onClick={() => selectCategory(null)}>
            ทั้งหมด
          </Chip>
          {SHOP_CATEGORIES.map((item) => (
            <Chip key={item.code} active={category === item.code} onClick={() => selectCategory(item.code)}>
              {item.label}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-[var(--muted)]">ไซซ์</span>
            {sizes.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSize(size === value ? null : value)}
                className={`h-8 min-w-8 rounded-[var(--radius-sm)] border px-2 font-mono text-[11px] transition ${
                  size === value
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-black"
                    : "border-[var(--border-strong)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(event) => setInStockOnly(event.target.checked)}
              className="accent-[var(--grade-rare)]"
            />
            มีสินค้าเท่านั้น
          </label>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="h-9 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-xs outline-none focus:border-[var(--foreground)]"
            aria-label="เรียงลำดับ"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="py-24 text-center">
          <p className="text-[var(--muted)]">ไม่พบสินค้าที่ตรงกับตัวกรอง</p>
          <button
            type="button"
            onClick={() => {
              selectCategory(null);
              setSize(null);
              setInStockOnly(false);
            }}
            className="mt-4 text-sm underline underline-offset-4 hover:text-[var(--grade-rare)]"
          >
            ล้างตัวกรอง
          </button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-xs transition ${
        active
          ? "border-[var(--foreground)] bg-[var(--foreground)] text-black font-semibold"
          : "border-[var(--border-strong)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--muted)]"
      }`}
    >
      {children}
    </button>
  );
}
