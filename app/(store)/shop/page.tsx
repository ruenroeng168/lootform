import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/shop/ProductCard";
import ShopCatalog from "@/components/shop/ShopCatalog";
import SizeTable from "@/components/shop/SizeTable";
import { TrustBar } from "@/components/shop/ShopFooter";
import { getActiveProducts } from "@/lib/shop-data";
import {
  SHOP_CATEGORIES,
  formatTHB,
  type ShopProduct,
} from "@/lib/shop";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LOOTFORM STORE — เสื้อผ้า Streetwear ออนไลน์",
  description:
    "ช้อปเสื้อยืด ฮู้ดดี้ แจ็กเก็ต กางเกง และแอคเซสซอรี่จาก LOOTFORM ส่งฟรีทั่วไทยเมื่อช้อปครบ ฿1,500 เปลี่ยนไซซ์ได้ภายใน 7 วัน",
};

const FAQ = [
  {
    q: "สั่งซื้อและชำระเงินอย่างไร?",
    a: "เลือกสินค้าและไซซ์ → กดชำระเงิน → โอนเงินผ่านบัญชีธนาคารหรือสแกน QR ที่แสดง → แนบสลิป ทีมงานจะตรวจสอบและยืนยันภายใน 24 ชม.",
  },
  {
    q: "จัดส่งกี่วัน?",
    a: "จัดส่งภายใน 1–2 วันทำการหลังยืนยันการชำระเงิน และใช้เวลาขนส่ง 2–4 วันทำการ ติดตามเลขพัสดุได้ที่หน้า “คำสั่งซื้อของฉัน”",
  },
  {
    q: "เปลี่ยนไซซ์หรือคืนสินค้าได้ไหม?",
    a: "เปลี่ยนไซซ์ได้ภายใน 7 วันหลังได้รับสินค้า สินค้าต้องยังไม่ผ่านการใช้งาน ไม่ผ่านการซัก และป้ายยังอยู่ครบ",
  },
  {
    q: "สินค้าเกี่ยวข้องกับ Craft / LT ไหม?",
    a: "สินค้าใน Store ซื้อด้วยเงินบาทโดยตรง แยกจากระบบ Craft ที่ใช้ LT และสุ่มเกรด หากต้องการลุ้นเกรด Legendary ไปที่หน้า Craft ได้เลย",
  },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const categoryParam = typeof params.category === "string" ? params.category : null;
  const initialCategory = SHOP_CATEGORIES.some((item) => item.code === categoryParam)
    ? categoryParam
    : null;

  let products: ShopProduct[] = [];
  let loadFailed = false;

  try {
    products = await getActiveProducts();
  } catch {
    loadFailed = true;
  }

  if (loadFailed) {
    return (
      <main className="mx-auto max-w-xl px-6 py-32 text-center">
        <p className="font-mono text-xs tracking-[0.25em] text-[var(--grade-legendary)]">STORE OFFLINE</p>
        <h1 className="mt-3 text-2xl font-bold">ร้านค้าปิดปรับปรุงชั่วคราว</h1>
        <p className="mt-3 text-[var(--muted)]">กรุณาลองใหม่อีกครั้งในอีกสักครู่</p>
      </main>
    );
  }

  const hero = products.find((product) => product.is_featured) ?? products[0];
  const newArrivals = products.filter((product) => product.is_new).slice(0, 4);

  return (
    <main>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 80% at 75% 40%, color-mix(in srgb, var(--grade-rare) 14%, transparent), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1400px] items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:py-20">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-[var(--grade-rare)]">
              FW26 · NEW COLLECTION
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl">
              Streetwear
              <br />
              ที่เกิดจาก<span className="text-[var(--grade-rare)]">โลกดิจิทัล</span>
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-[var(--muted)]">
              เสื้อผ้าคุณภาพพรีเมียมจาก LOOTFORM ผ้าหนา ตัดเย็บประณีต ผลิตจำนวนจำกัดในแต่ละคอลเลกชัน
              สั่งง่าย ส่งไวทั่วประเทศ
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#catalog"
                className="rounded-[var(--radius-md)] bg-[var(--foreground)] px-7 py-3.5 text-sm font-semibold text-black transition hover:opacity-90"
              >
                ช้อปเลย
              </Link>
              <Link
                href="#new-arrivals"
                className="rounded-[var(--radius-md)] border border-[var(--border-strong)] px-7 py-3.5 text-sm transition hover:border-[var(--foreground)]"
              >
                สินค้ามาใหม่
              </Link>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-[var(--border)] pt-6">
              <HeroStat label="สินค้า" value={`${products.length}+`} />
              <HeroStat label="ส่งฟรีเมื่อครบ" value="฿1,500" />
              <HeroStat label="เปลี่ยนไซซ์" value="7 วัน" />
            </dl>
          </div>

          {hero && (
            <Link
              href={`/shop/${hero.slug}`}
              className="hud-frame hud-glow group relative block overflow-hidden"
              style={{ "--grade-color": "var(--grade-rare)" } as React.CSSProperties}
            >
              <img
                src={hero.images[0] ?? "/logo.png"}
                alt={hero.name}
                className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.02] md:max-h-[620px]"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/90 to-transparent p-6 pt-16">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.25em] text-[var(--grade-rare)]">FEATURED</p>
                  <p className="mt-1 font-display text-lg font-semibold">{hero.name}</p>
                </div>
                <p className="font-mono text-lg">{formatTHB(hero.price_thb)}</p>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* ================= CATEGORIES ================= */}
      <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--grade-rare)]">SHOP BY CATEGORY</p>
        <h2 className="mt-2 text-3xl font-bold">เลือกตามหมวดหมู่</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SHOP_CATEGORIES.map((category) => {
            const sample = products.find((product) => product.category === category.code);
            const count = products.filter((product) => product.category === category.code).length;

            return (
              <Link
                key={category.code}
                href={`/shop?category=${category.code}#catalog`}
                className="group relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
              >
                {sample?.images[0] && (
                  <img
                    src={sample.images[0]}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
                  <p className="font-display font-semibold">{category.label}</p>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)]">
                    {category.labelEn} · {count}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ================= NEW ARRIVALS ================= */}
      {newArrivals.length > 0 && (
        <section id="new-arrivals" className="mx-auto max-w-[1400px] px-4 pb-14 sm:px-6 scroll-mt-32">
          <div className="flex items-end justify-between">
            <div>
              <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--grade-rare)]">NEW ARRIVALS</p>
              <h2 className="mt-2 text-3xl font-bold">มาใหม่ล่าสุด</h2>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <TrustBar />

      {/* ================= CATALOG ================= */}
      <ShopCatalog products={products} initialCategory={initialCategory} />

      {/* ================= SIZE GUIDE + FAQ ================= */}
      <section className="mx-auto grid max-w-[1400px] gap-10 px-4 pb-20 sm:px-6 lg:grid-cols-2">
        <div id="size-guide" className="scroll-mt-32">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--grade-rare)]">SIZE GUIDE</p>
          <h2 className="mt-2 text-2xl font-bold">ตารางไซซ์เสื้อ (ซม.)</h2>
          <SizeTable />
          <p className="mt-3 text-xs text-[var(--muted)]">
            วัดจากตัวเสื้อวางราบ · ทรง Oversized แนะนำลด 1 ไซซ์ · คลาดเคลื่อนได้ ±1–2 ซม.
          </p>
        </div>

        <div id="faq" className="scroll-mt-32">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--grade-rare)]">FAQ</p>
          <h2 className="mt-2 text-2xl font-bold">คำถามที่พบบ่อย</h2>
          <div className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
                  {item.q}
                  <span className="text-[var(--muted)] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--muted-dim)]">{label}</dt>
      <dd className="mt-1 font-mono text-lg">{value}</dd>
    </div>
  );
}
