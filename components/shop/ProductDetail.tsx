"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SizeTable from "@/components/shop/SizeTable";
import { openCartDrawer, QtyStepper } from "@/components/shop/ShopBar";
import { addToCart } from "@/lib/cart";
import {
  FREE_SHIPPING_MIN_THB,
  MAX_QTY_PER_LINE,
  categoryLabel,
  discountPercent,
  formatTHB,
  type ShopProduct,
} from "@/lib/shop";

const LOW_STOCK = 5;

export default function ProductDetail({ product }: { product: ShopProduct }) {
  const router = useRouter();
  const images = product.images.length > 0 ? product.images : ["/logo.png"];
  const singleSize = product.variants.length === 1 ? product.variants[0] : null;

  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(
    singleSize && singleSize.stock > 0 ? singleSize.id : null
  );
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const variant = product.variants.find((item) => item.id === variantId) ?? null;
  const soldOut = product.variants.every((item) => item.stock === 0);
  const discount = discountPercent(product);
  const maxQty = variant ? Math.min(MAX_QTY_PER_LINE, variant.stock) : MAX_QTY_PER_LINE;

  function add(goToCheckout: boolean) {
    if (!variant) {
      setError("กรุณาเลือกไซซ์");
      return;
    }

    const added = addToCart(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        colorName: product.color_name,
        size: variant.size,
        priceThb: product.price_thb,
        image: product.images[0] ?? null,
      },
      quantity,
      variant.stock
    );

    if (!added && !goToCheckout) {
      setError("ไซซ์นี้อยู่ในตะกร้าครบจำนวนที่สั่งได้แล้ว");
      return;
    }

    setError("");

    if (goToCheckout) router.push("/checkout");
    else openCartDrawer();
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      {/* ================= GALLERY ================= */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {images.length > 1 && (
          <div className="flex gap-3 sm:flex-col">
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => setImageIndex(index)}
                className={`w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border transition sm:w-20 ${
                  index === imageIndex ? "border-[var(--foreground)]" : "border-[var(--border)] opacity-60 hover:opacity-100"
                }`}
                aria-label={`รูปที่ ${index + 1}`}
              >
                <img src={src} alt="" className="aspect-[4/5] w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="relative flex-1 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
          <img src={images[imageIndex]} alt={product.name} className="aspect-[4/5] w-full object-cover" />
          {discount > 0 && !soldOut && (
            <span className="absolute left-4 top-4 rounded-[var(--radius-sm)] bg-[var(--grade-legendary)] px-2.5 py-1 font-mono text-xs font-semibold text-black">
              -{discount}%
            </span>
          )}
        </div>
      </div>

      {/* ================= BUY BOX ================= */}
      <div className="lg:sticky lg:top-40 lg:self-start">
        <nav className="text-xs text-[var(--muted-dim)]">
          <Link href="/shop" className="hover:text-[var(--foreground)]">Store</Link>
          <span className="mx-2">/</span>
          <Link href={`/shop?category=${product.category}`} className="hover:text-[var(--foreground)]">
            {categoryLabel(product.category)}
          </Link>
        </nav>

        <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{product.name}</h1>
        {product.color_name && <p className="mt-1 text-[var(--muted)]">สี {product.color_name}</p>}

        <div className="mt-5 flex items-baseline gap-3">
          <p className={`font-mono text-2xl ${discount > 0 ? "text-[var(--grade-legendary)]" : ""}`}>
            {formatTHB(product.price_thb)}
          </p>
          {discount > 0 && product.compare_at_price_thb && (
            <p className="font-mono text-[var(--muted-dim)] line-through">{formatTHB(product.compare_at_price_thb)}</p>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">รวม VAT แล้ว · ส่งฟรีเมื่อช้อปครบ {formatTHB(FREE_SHIPPING_MIN_THB)}</p>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              ไซซ์{variant ? <span className="ml-2 font-mono text-[var(--muted)]">{variant.size}</span> : null}
            </p>
            <button
              type="button"
              onClick={() => setSizeGuideOpen(true)}
              className="text-xs text-[var(--muted)] underline underline-offset-4 hover:text-[var(--foreground)]"
            >
              ตารางไซซ์
            </button>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-2">
            {product.variants.map((item) => {
              const unavailable = item.stock === 0;
              const selected = item.id === variantId;

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => {
                    setVariantId(item.id);
                    setQuantity((current) => Math.min(current, Math.max(1, item.stock)));
                    setError("");
                  }}
                  className={`relative h-12 rounded-[var(--radius-md)] border font-mono text-sm transition ${
                    selected
                      ? "border-[var(--foreground)] bg-[var(--foreground)] text-black font-semibold"
                      : unavailable
                        ? "cursor-not-allowed border-[var(--border)] text-[var(--muted-dim)] line-through"
                        : "border-[var(--border-strong)] hover:border-[var(--foreground)]"
                  }`}
                  aria-pressed={selected}
                >
                  {item.size}
                </button>
              );
            })}
          </div>

          {variant && variant.stock <= LOW_STOCK && (
            <p className="mt-3 text-xs text-[var(--grade-legendary)]">เหลือเพียง {variant.stock} ชิ้น</p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <p className="text-sm font-semibold">จำนวน</p>
          <QtyStepper value={quantity} max={maxQty} onChange={(value) => setQuantity(Math.max(1, Math.min(maxQty, value)))} />
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-6 grid gap-3">
          {soldOut ? (
            <button
              type="button"
              disabled
              className="h-13 rounded-[var(--radius-md)] bg-[var(--surface-raised)] py-4 text-sm font-semibold text-[var(--muted)]"
            >
              สินค้าหมด
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => add(false)}
                className="rounded-[var(--radius-md)] bg-[var(--foreground)] py-4 text-sm font-semibold text-black transition hover:opacity-90"
              >
                เพิ่มลงตะกร้า
              </button>
              <button
                type="button"
                onClick={() => add(true)}
                className="rounded-[var(--radius-md)] border border-[var(--border-strong)] py-4 text-sm font-semibold transition hover:border-[var(--foreground)]"
              >
                ซื้อเลย
              </button>
            </>
          )}
        </div>

        <ul className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-[var(--muted)]">
          <li className="rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-3">จัดส่ง 2–4 วัน</li>
          <li className="rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-3">เปลี่ยนไซซ์ 7 วัน</li>
          <li className="rounded-[var(--radius-md)] border border-[var(--border)] px-2 py-3">ของแท้ 100%</li>
        </ul>

        <div className="mt-8 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          <Accordion title="รายละเอียดสินค้า" defaultOpen>
            <p className="whitespace-pre-line">{product.description}</p>
          </Accordion>
          {(product.material || product.fit) && (
            <Accordion title="เนื้อผ้าและทรง">
              <dl className="grid grid-cols-[96px_1fr] gap-y-2">
                {product.material && (
                  <>
                    <dt className="text-[var(--muted-dim)]">เนื้อผ้า</dt>
                    <dd>{product.material}</dd>
                  </>
                )}
                {product.fit && (
                  <>
                    <dt className="text-[var(--muted-dim)]">ทรง</dt>
                    <dd>{product.fit}</dd>
                  </>
                )}
              </dl>
            </Accordion>
          )}
          {product.care && (
            <Accordion title="การดูแลรักษา">
              <p>{product.care}</p>
            </Accordion>
          )}
          <Accordion title="การจัดส่งและการเปลี่ยนสินค้า">
            <p>
              จัดส่งภายใน 1–2 วันทำการหลังยืนยันการชำระเงิน ขนส่ง 2–4 วันทำการ ค่าส่ง ฿60 (ฟรีเมื่อครบ{" "}
              {formatTHB(FREE_SHIPPING_MIN_THB)}) เปลี่ยนไซซ์ได้ภายใน 7 วันหลังได้รับสินค้า
            </p>
          </Accordion>
        </div>
      </div>

      {sizeGuideOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-label="ตารางไซซ์">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSizeGuideOpen(false)} />
          <div className="relative w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg)] p-6">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold">ตารางไซซ์ (ซม.)</p>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(false)}
                className="h-8 w-8 text-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            <SizeTable kind={product.category === "PANTS" ? "PANTS" : "TOPS"} />
            <p className="mt-3 text-xs text-[var(--muted)]">
              {product.fit ? `${product.fit} · ` : ""}วัดจากสินค้าวางราบ คลาดเคลื่อนได้ ±1–2 ซม.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group py-4" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
        {title}
        <span className="text-[var(--muted)] transition group-open:rotate-45">+</span>
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{children}</div>
    </details>
  );
}
