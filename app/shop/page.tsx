"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

type ShopItem = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  price_thb: number;
  available_sizes: string[];
  image_url: string | null;
};

export default function ShopPage() {
  const router = useRouter();

  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      try {
        const response = await fetch("/api/shop/items", { cache: "no-store" });
        const result = await response.json();

        if (cancelled) return;

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load shop items");
        }

        setItems(result.items as ShopItem[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load shop items");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--foreground)] relative overflow-hidden">
      <Navbar />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-360px] h-[900px] w-[1100px] -translate-x-1/2 rounded-full bg-[var(--grade-rare)]/[0.06] blur-[190px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-5 pb-16 pt-12 sm:px-6 lg:px-7 lg:pt-16">
        <p className="font-mono text-[9px] tracking-[0.34em] text-[var(--grade-rare)]">
          LOOTFORM SHOP
        </p>

        <h1 className="font-display mt-5 max-w-[640px] text-[36px] font-black leading-[1.25] sm:text-[48px]">
          เลือกเอง <span className="text-[var(--grade-rare)]">ได้ของแน่นอน</span>
        </h1>

        <p className="mt-5 max-w-[600px] text-sm leading-7 text-[var(--muted)] sm:text-base">
          เลือกดีไซน์ที่ใช่ ในราคาที่ชัดเจน จัดส่งของจริงถึงบ้านคุณ
        </p>

        {error && (
          <div className="mt-8 rounded-xl border border-red-400/30 bg-red-400/[0.07] p-5 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-sm text-[var(--muted-dim)]">กำลังโหลดสินค้า…</p>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-[var(--border)] bg-black/20 p-8 text-center text-sm text-[var(--muted-dim)]">
            ยังไม่มีสินค้าวางจำหน่ายตอนนี้ — กลับมาเช็คอีกครั้งเร็ว ๆ นี้
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/shop/${item.id}`)}
                className="hud-frame relative overflow-hidden p-3 text-left transition hover:brightness-110"
                style={{ ["--grade-color" as string]: "var(--grade-rare)" }}
              >
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-black/25">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="font-mono text-[8px] tracking-[0.2em] text-[var(--muted-dim)]">
                      ยังไม่มีรูป
                    </span>
                  )}
                </div>

                <p className="mt-3 truncate font-mono text-[8px] tracking-[0.18em] text-[var(--muted-dim)]">
                  {item.category}
                </p>
                <p className="mt-1 truncate text-sm font-black text-white">{item.name}</p>
                <p className="mt-1 text-xs font-black text-[var(--grade-rare)]">
                  ฿{item.price_thb.toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
