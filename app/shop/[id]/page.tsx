"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type ShopItem = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  price_thb: number;
  available_sizes: string[];
  image_url: string | null;
};

type ShippingAddress = {
  id: number;
  recipient_name: string;
  phone: string;
  address_line: string;
  province: string;
  postal_code: string;
  is_default: boolean;
};

type SubmittedOrder = {
  id: number;
  reference: string;
  item_name_snapshot: string;
  total_thb: number;
  status: string;
};

const MAX_SLIP_SIZE = 5 * 1024 * 1024;

function validateSlipFile(file: File) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) return "รองรับเฉพาะไฟล์ JPEG, PNG และ WEBP";
  if (file.size > MAX_SLIP_SIZE) return "สลิปต้องมีขนาดไม่เกิน 5 MB";
  return "";
}

export default function ShopItemPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const itemId = Number(params.id);

  const [item, setItem] = useState<ShopItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedOrder | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push(`/login?redirect=/shop/${itemId}`);
          return;
        }

        const [itemsResponse, addressResult] = await Promise.all([
          fetch("/api/shop/items", { cache: "no-store" }),
          supabase
            .from("shipping_addresses")
            .select("id, recipient_name, phone, address_line, province, postal_code, is_default")
            .order("is_default", { ascending: false }),
        ]);

        if (cancelled) return;

        const itemsResult = await itemsResponse.json();

        if (!itemsResponse.ok || !itemsResult.success) {
          throw new Error(itemsResult.message || "Unable to load product");
        }

        const found = (itemsResult.items as ShopItem[]).find((row) => row.id === itemId) ?? null;

        if (!found) {
          throw new Error("ไม่พบสินค้านี้");
        }

        setItem(found);
        if (found.available_sizes.length > 0) {
          setSelectedSize(found.available_sizes[0]);
        }

        if (addressResult.error) throw addressResult.error;

        const addressRows = (addressResult.data ?? []) as ShippingAddress[];
        setAddresses(addressRows);
        setSelectedAddressId(addressRows[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load product");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (Number.isInteger(itemId) && itemId > 0) {
      void load();
    } else {
      setError("รหัสสินค้าไม่ถูกต้อง");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [itemId, router]);

  async function submitOrder() {
    if (!item) return;

    if (item.available_sizes.length > 0 && !selectedSize) {
      setError("กรุณาเลือกไซซ์");
      return;
    }

    if (!selectedAddressId) {
      setError("กรุณาเลือกที่อยู่จัดส่ง");
      return;
    }

    if (!slipFile) {
      setError("กรุณาแนบสลิปการโอนเงิน");
      return;
    }

    const validationError = validateSlipFile(slipFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push(`/login?redirect=/shop/${itemId}`);
        return;
      }

      const formData = new FormData();
      formData.append("shop_item_id", String(item.id));
      if (selectedSize) formData.append("size", selectedSize);
      formData.append("quantity", String(quantity));
      formData.append("shipping_address_id", String(selectedAddressId));
      formData.append("file", slipFile);

      const response = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "ไม่สามารถสั่งซื้อได้");
      }

      setSubmittedOrder(result.order as SubmittedOrder);
      setSlipFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถสั่งซื้อได้");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-lime-400 tracking-[0.35em] animate-pulse">LOADING...</p>
        </div>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
          <p className="text-red-400">{error || "ไม่พบสินค้านี้"}</p>
          <button
            onClick={() => router.push("/shop")}
            className="rounded-xl border border-zinc-800 bg-black/40 px-5 py-3 text-xs font-black text-zinc-300 hover:border-lime-400 hover:text-lime-400 transition"
          >
            ← กลับไปหน้าร้าน
          </button>
        </div>
      </main>
    );
  }

  const totalThb = item.price_thb * quantity;

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <Navbar />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        <button
          onClick={() => router.push("/shop")}
          className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
        >
          ← กลับไปหน้าร้าน
        </button>

        {error && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] text-red-400 rounded-xl p-5">
            ⚠ {error}
          </div>
        )}

        {submittedOrder ? (
          <section className="mt-6 border border-cyan-400/30 bg-cyan-400/[0.05] rounded-2xl p-6">
            <p className="text-cyan-400 text-[9px] tracking-[0.25em]">คำขอส่งสำเร็จ</p>
            <p className="text-white text-2xl font-black mt-3">รอการตรวจสอบจากแอดมิน</p>
            <div className="grid sm:grid-cols-3 gap-3 mt-5">
              <Info label="REFERENCE" value={submittedOrder.reference} />
              <Info label="สินค้า" value={submittedOrder.item_name_snapshot} />
              <Info label="ยอดรวม" value={`฿${submittedOrder.total_thb.toLocaleString()}`} />
            </div>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-6 sm:grid-cols-[240px_1fr]">
              <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-black/40 h-[240px] overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <p className="text-zinc-600 text-xs">ยังไม่มีรูป</p>
                )}
              </div>

              <div>
                <p className="font-mono text-[9px] tracking-[0.25em] text-cyan-400">{item.category}</p>
                <h1 className="text-3xl font-black mt-2">{item.name}</h1>
                <p className="text-lime-400 text-2xl font-black mt-3">
                  ฿{item.price_thb.toLocaleString()}
                </p>
                {item.description && (
                  <p className="text-zinc-500 text-sm mt-3 leading-6">{item.description}</p>
                )}
              </div>
            </section>

            <section className="mt-8 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8 space-y-6">
              {item.available_sizes.length > 0 && (
                <div>
                  <p className="text-cyan-400 text-[9px] tracking-[0.25em]">เลือกไซซ์</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.available_sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`rounded-xl border px-5 py-3 text-sm font-black transition ${
                          selectedSize === size
                            ? "border-lime-400 bg-lime-400/[0.08] text-lime-400"
                            : "border-zinc-800 bg-black/40 text-zinc-300 hover:border-zinc-600"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-cyan-400 text-[9px] tracking-[0.25em]">จำนวน</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="h-10 w-10 rounded-xl border border-zinc-800 bg-black/40 text-white font-black hover:border-lime-400"
                  >
                    −
                  </button>
                  <span className="text-white font-black text-lg w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((current) => current + 1)}
                    className="h-10 w-10 rounded-xl border border-zinc-800 bg-black/40 text-white font-black hover:border-lime-400"
                  >
                    +
                  </button>
                  <span className="text-zinc-500 text-sm ml-2">
                    ยอดรวม <span className="text-lime-400 font-black">฿{totalThb.toLocaleString()}</span>
                  </span>
                </div>
              </div>

              <div>
                <p className="text-cyan-400 text-[9px] tracking-[0.25em]">ที่อยู่จัดส่ง</p>

                {addresses.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-zinc-700 p-5 text-center">
                    <p className="text-zinc-500 text-sm">ยังไม่มีที่อยู่จัดส่ง</p>
                    <button
                      onClick={() => router.push("/shipping")}
                      className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 px-5 py-2.5 text-xs font-black hover:bg-cyan-400/10 transition"
                    >
                      + เพิ่มที่อยู่จัดส่ง
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {addresses.map((address) => (
                      <button
                        key={address.id}
                        onClick={() => setSelectedAddressId(address.id)}
                        className={`w-full text-left rounded-xl border p-4 transition ${
                          selectedAddressId === address.id
                            ? "border-lime-400 bg-lime-400/[0.06]"
                            : "border-zinc-800 bg-black/40 hover:border-zinc-600"
                        }`}
                      >
                        <p className="text-white text-sm font-black">
                          {address.recipient_name} · {address.phone}
                        </p>
                        <p className="text-zinc-500 text-xs mt-1">
                          {address.address_line} {address.province} {address.postal_code}
                        </p>
                      </button>
                    ))}
                    <button
                      onClick={() => router.push("/shipping")}
                      className="text-cyan-400 text-xs font-black hover:underline"
                    >
                      + เพิ่มที่อยู่ใหม่
                    </button>
                  </div>
                )}
              </div>

              <div>
                <p className="text-cyan-400 text-[9px] tracking-[0.25em]">แนบสลิปการโอนเงิน</p>
                <label className="mt-3 block">
                  <span className="inline-block w-full text-center border border-dashed border-zinc-700 rounded-xl py-8 text-zinc-400 text-xs font-black cursor-pointer hover:border-lime-400 hover:text-lime-400 transition">
                    {slipFile ? slipFile.name : "แตะเพื่อเลือกไฟล์สลิป (JPEG/PNG/WEBP, ≤5MB)"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => setSlipFile(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <button
                onClick={submitOrder}
                disabled={submitting}
                className="w-full bg-lime-400 text-black py-5 rounded-xl text-sm font-black hover:bg-lime-300 disabled:bg-zinc-800 disabled:text-zinc-600 transition"
              >
                {submitting ? "กำลังส่งคำขอ..." : "สั่งซื้อ"}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-black/40 rounded-xl p-4">
      <p className="text-zinc-600 text-[8px] tracking-[0.18em]">{label}</p>
      <p className="text-white text-sm font-black mt-2 break-all">{value}</p>
    </div>
  );
}
