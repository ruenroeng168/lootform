"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import {
  SHOP_CATEGORIES,
  formatTHB,
  type ShopOrderStatus,
  type ShopProduct,
} from "@/lib/shop";

/* =========================================================
   LOOTFORM ADMIN — SHOP

   ORDERS    review payment slips, approve/reject, add tracking,
             mark delivered. Stock is restored on reject/cancel.
   PRODUCTS  create/edit products, photos, per-size stock,
             visibility and badges.
========================================================= */

type AdminProduct = ShopProduct & { is_active: boolean; sort_order: number };

type AdminOrder = {
  id: number;
  reference: string;
  user_email: string;
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
  note: string | null;
  tracking_carrier: string | null;
  tracking_number: string | null;
  cancel_reason: string | null;
  created_at: string;
  slip_image_signed_url: string | null;
  items: {
    id: number;
    product_name: string;
    size: string;
    image_url: string | null;
    unit_price_thb: number;
    quantity: number;
    line_total_thb: number;
  }[];
};

type ProductDraft = {
  id: number | null;
  slug: string;
  name: string;
  category: string;
  description: string;
  price_thb: string;
  compare_at_price_thb: string;
  images: string[];
  color_name: string;
  material: string;
  fit: string;
  care: string;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  sort_order: string;
  variants: { size: string; stock: string }[];
};

const ORDER_TABS: ShopOrderStatus[] = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"];
const CARRIERS = ["Kerry Express", "Flash Express", "J&T Express", "ไปรษณีย์ไทย (EMS)", "Shopee Express"];

const EMPTY_DRAFT: ProductDraft = {
  id: null,
  slug: "",
  name: "",
  category: "TEES",
  description: "",
  price_thb: "",
  compare_at_price_thb: "",
  images: [],
  color_name: "",
  material: "",
  fit: "",
  care: "",
  is_active: true,
  is_featured: false,
  is_new: true,
  sort_order: "100",
  variants: ["S", "M", "L", "XL", "XXL"].map((size) => ({ size, stock: "0" })),
};

function toDraft(product: AdminProduct): ProductDraft {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    description: product.description,
    price_thb: String(product.price_thb),
    compare_at_price_thb: product.compare_at_price_thb ? String(product.compare_at_price_thb) : "",
    images: product.images,
    color_name: product.color_name ?? "",
    material: product.material ?? "",
    fit: product.fit ?? "",
    care: product.care ?? "",
    is_active: product.is_active,
    is_featured: product.is_featured,
    is_new: product.is_new,
    sort_order: String(product.sort_order),
    variants: product.variants.map((variant) => ({ size: variant.size, stock: String(variant.stock) })),
  };
}

export default function AdminShopPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"ORDERS" | "PRODUCTS">("ORDERS");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [orderStatus, setOrderStatus] = useState<ShopOrderStatus>("PENDING");
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [reasonById, setReasonById] = useState<Record<number, string>>({});
  const [trackingById, setTrackingById] = useState<Record<number, { carrier: string; number: string }>>({});

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploading, setUploading] = useState(false);

  const authenticatedFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login?next=/admin/shop");
        throw new Error("Admin session not found. Please login again.");
      }

      const isForm = options?.body instanceof FormData;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(isForm ? {} : { "Content-Type": "application/json" }),
          Authorization: `Bearer ${data.session.access_token}`,
          ...(options?.headers ?? {}),
        },
      });
      const result = await response.json();

      if (!response.ok || !result?.success) throw new Error(result?.message || "Request failed");
      return result;
    },
    [router]
  );

  // Effects apply results in promise callbacks (never synchronously),
  // and ignore responses that arrive after the tab/status changed.
  const loadOrders = useCallback(
    (isCurrent: () => boolean = () => true) =>
      authenticatedFetch(`/api/admin/shop/orders?status=${orderStatus}`)
        .then((result) => isCurrent() && setOrders(result.orders as AdminOrder[]))
        .catch((err) => isCurrent() && setError(err instanceof Error ? err.message : "Unable to load orders"))
        .finally(() => isCurrent() && setOrdersLoading(false)),
    [authenticatedFetch, orderStatus]
  );

  const loadProducts = useCallback(
    (isCurrent: () => boolean = () => true) =>
      authenticatedFetch("/api/admin/shop/products")
        .then((result) => isCurrent() && setProducts(result.products as AdminProduct[]))
        .catch((err) => isCurrent() && setError(err instanceof Error ? err.message : "Unable to load products"))
        .finally(() => isCurrent() && setProductsLoading(false)),
    [authenticatedFetch]
  );

  useEffect(() => {
    let current = true;
    void loadOrders(() => current);
    return () => {
      current = false;
    };
  }, [loadOrders]);

  useEffect(() => {
    let current = true;
    void loadProducts(() => current);
    return () => {
      current = false;
    };
  }, [loadProducts]);

  function flash(message: string) {
    setError("");
    setSuccess(message);
    setTimeout(() => setSuccess(""), 3000);
  }

  async function runAction(order: AdminOrder, action: "APPROVE" | "REJECT" | "SHIP" | "DELIVER" | "CANCEL") {
    const reason = reasonById[order.id]?.trim() ?? "";
    const tracking = trackingById[order.id] ?? { carrier: CARRIERS[0], number: "" };

    if ((action === "REJECT" || action === "CANCEL") && !reason) {
      setError("กรุณาระบุเหตุผลก่อนปฏิเสธ/ยกเลิก");
      return;
    }
    if (action === "SHIP" && !tracking.number.trim()) {
      setError("กรุณาระบุเลขพัสดุ");
      return;
    }
    if ((action === "REJECT" || action === "CANCEL") && !window.confirm(`ยืนยันยกเลิกคำสั่งซื้อ ${order.reference}? สต็อกจะถูกคืน`)) {
      return;
    }

    try {
      setBusyOrderId(order.id);
      await authenticatedFetch("/api/admin/shop/orders", {
        method: "POST",
        body: JSON.stringify({
          order_id: order.id,
          action,
          reason,
          tracking_carrier: tracking.carrier || CARRIERS[0],
          tracking_number: tracking.number,
        }),
      });
      flash(`${order.reference}: ${action} สำเร็จ`);
      await loadOrders();
      if (action === "REJECT" || action === "CANCEL") void loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function saveProduct() {
    if (!draft) return;

    try {
      setSavingProduct(true);
      setError("");
      await authenticatedFetch("/api/admin/shop/products", {
        method: draft.id ? "PATCH" : "POST",
        body: JSON.stringify({
          ...draft,
          price_thb: Number(draft.price_thb),
          compare_at_price_thb: draft.compare_at_price_thb ? Number(draft.compare_at_price_thb) : null,
          sort_order: Number(draft.sort_order) || 0,
          variants: draft.variants.map((variant) => ({ size: variant.size, stock: Number(variant.stock) })),
        }),
      });
      flash(draft.id ? "บันทึกสินค้าแล้ว" : "เพิ่มสินค้าแล้ว");
      setDraft(null);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product");
    } finally {
      setSavingProduct(false);
    }
  }

  async function deleteProduct(product: AdminProduct) {
    if (!window.confirm(`ลบ "${product.name}" ถาวร? (แนะนำให้ซ่อนแทน — ประวัติคำสั่งซื้อจะยังอยู่)`)) return;

    try {
      await authenticatedFetch(`/api/admin/shop/products?id=${product.id}`, { method: "DELETE" });
      flash("ลบสินค้าแล้ว");
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete product");
    }
  }

  async function uploadImage(file: File) {
    if (!draft) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const result = await authenticatedFetch("/api/admin/shop/products/upload", { method: "POST", body: formData });
      setDraft((current) => (current ? { ...current, images: [...current.images, result.url as string] } : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <Navbar />

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[9px] tracking-[0.3em] text-zinc-600">LOOTFORM ADMIN</p>
            <h1 className="mt-2 text-4xl font-black sm:text-6xl">
              STORE <span className="text-cyan-400">CONTROL</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.push("/shop")}
              className="rounded-xl border border-zinc-800 px-5 py-3 text-xs font-black text-zinc-300 transition hover:border-cyan-400 hover:text-cyan-400"
            >
              VIEW STORE ↗
            </button>
            <button
              onClick={() => router.push("/admin")}
              className="rounded-xl border border-zinc-800 px-5 py-3 text-xs font-black text-zinc-300 transition hover:border-lime-400 hover:text-lime-400"
            >
              ← ADMIN DASHBOARD
            </button>
          </div>
        </div>

        <div className="mt-8 flex gap-2">
          {(["ORDERS", "PRODUCTS"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-xl px-5 py-3 text-xs font-black transition ${
                tab === value ? "bg-cyan-400 text-black" : "border border-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              {value === "ORDERS" ? "ORDERS" : `PRODUCTS (${products.length})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/[0.07] p-4 text-sm text-red-400">{error}</div>
        )}
        {success && (
          <div className="mt-6 rounded-xl border border-lime-400/30 bg-lime-400/[0.07] p-4 text-sm font-black text-lime-400">
            ✓ {success}
          </div>
        )}

        {/* ================= ORDERS ================= */}
        {tab === "ORDERS" && (
          <section className="mt-6">
            <div className="flex flex-wrap gap-2">
              {ORDER_TABS.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    if (status === orderStatus) return;
                    setOrdersLoading(true);
                    setOrderStatus(status);
                  }}
                  className={`rounded-lg px-4 py-2 text-[11px] font-black tracking-[0.1em] transition ${
                    orderStatus === status ? "bg-white text-black" : "border border-zinc-800 text-zinc-500 hover:text-white"
                  }`}
                >
                  {status}
                </button>
              ))}
              <button
                onClick={() => {
                  setOrdersLoading(true);
                  void loadOrders();
                }}
                className="ml-auto text-xs text-zinc-500 hover:text-white">
                ↻ REFRESH
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {ordersLoading && <p className="animate-pulse text-xs tracking-[0.3em] text-zinc-500">LOADING ORDERS...</p>}
              {!ordersLoading && orders.length === 0 && (
                <p className="rounded-2xl border border-zinc-800 p-10 text-center text-sm text-zinc-600">
                  ไม่มีคำสั่งซื้อสถานะ {orderStatus}
                </p>
              )}

              {orders.map((order) => {
                const busy = busyOrderId === order.id;
                const tracking = trackingById[order.id] ?? { carrier: CARRIERS[0], number: "" };

                return (
                  <article key={order.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/75 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-lg font-black">{order.reference}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(order.created_at).toLocaleString("th-TH")} · {order.user_email || "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-2xl font-black text-lime-400">{formatTHB(order.total_thb)}</p>
                        <p className="text-[11px] text-zinc-500">
                          สินค้า {formatTHB(order.subtotal_thb)} + ส่ง {formatTHB(order.shipping_fee_thb)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-[1fr_1fr_200px]">
                      <div>
                        <p className="text-[9px] tracking-[0.25em] text-zinc-600">ITEMS</p>
                        <ul className="mt-2 space-y-2">
                          {order.items.map((item) => (
                            <li key={item.id} className="flex items-center gap-3 text-sm">
                              <img src={item.image_url ?? "/logo.png"} alt="" className="h-12 w-10 rounded object-cover" />
                              <span className="flex-1">
                                {item.product_name} <span className="text-zinc-500">· {item.size} × {item.quantity}</span>
                              </span>
                              <span className="font-mono text-zinc-400">{formatTHB(item.line_total_thb)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-sm">
                        <p className="text-[9px] tracking-[0.25em] text-zinc-600">SHIP TO</p>
                        <p className="mt-2 font-bold">{order.recipient_name}</p>
                        <p className="text-zinc-400">{order.phone}</p>
                        <p className="text-zinc-400">
                          {[order.address_line, order.subdistrict, order.district, order.province, order.postal_code]
                            .filter(Boolean)
                            .join(" ")}
                        </p>
                        {order.note && <p className="mt-2 text-xs text-yellow-400">NOTE: {order.note}</p>}
                        {order.tracking_number && (
                          <p className="mt-2 text-xs text-cyan-400">
                            {order.tracking_carrier} · {order.tracking_number}
                          </p>
                        )}
                        {order.cancel_reason && <p className="mt-2 text-xs text-red-400">เหตุผล: {order.cancel_reason}</p>}
                      </div>

                      <div>
                        <p className="text-[9px] tracking-[0.25em] text-zinc-600">PAYMENT SLIP</p>
                        {order.slip_image_signed_url ? (
                          <a href={order.slip_image_signed_url} target="_blank" rel="noreferrer">
                            <img
                              src={order.slip_image_signed_url}
                              alt="slip"
                              className="mt-2 max-h-56 w-full rounded-xl border border-zinc-800 object-contain hover:border-cyan-400"
                            />
                          </a>
                        ) : (
                          <p className="mt-2 text-xs text-zinc-600">NO SLIP</p>
                        )}
                      </div>
                    </div>

                    {/* ---------- actions ---------- */}
                    {order.status === "PENDING" && (
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-900 pt-4">
                        <button
                          disabled={busy}
                          onClick={() => runAction(order, "APPROVE")}
                          className="rounded-xl bg-lime-400 px-5 py-2.5 text-xs font-black text-black hover:bg-lime-300 disabled:opacity-50"
                        >
                          ✓ APPROVE PAYMENT
                        </button>
                        <input
                          value={reasonById[order.id] ?? ""}
                          onChange={(event) => setReasonById({ ...reasonById, [order.id]: event.target.value })}
                          placeholder="เหตุผลที่ปฏิเสธ (เช่น ยอดไม่ตรง)"
                          className="min-w-[220px] flex-1 rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm outline-none focus:border-red-400"
                        />
                        <button
                          disabled={busy}
                          onClick={() => runAction(order, "REJECT")}
                          className="rounded-xl border border-red-400/40 px-5 py-2.5 text-xs font-black text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                        >
                          ✕ REJECT
                        </button>
                      </div>
                    )}

                    {order.status === "PAID" && (
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-900 pt-4">
                        <select
                          value={tracking.carrier}
                          onChange={(event) =>
                            setTrackingById({ ...trackingById, [order.id]: { ...tracking, carrier: event.target.value } })
                          }
                          className="rounded-xl border border-zinc-800 bg-black px-3 py-2.5 text-sm"
                        >
                          {CARRIERS.map((carrier) => (
                            <option key={carrier}>{carrier}</option>
                          ))}
                        </select>
                        <input
                          value={tracking.number}
                          onChange={(event) =>
                            setTrackingById({ ...trackingById, [order.id]: { ...tracking, number: event.target.value } })
                          }
                          placeholder="เลขพัสดุ"
                          className="min-w-[180px] flex-1 rounded-xl border border-zinc-800 bg-black px-4 py-2.5 font-mono text-sm outline-none focus:border-cyan-400"
                        />
                        <button
                          disabled={busy}
                          onClick={() => runAction(order, "SHIP")}
                          className="rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-black text-black hover:bg-cyan-300 disabled:opacity-50"
                        >
                          MARK SHIPPED
                        </button>
                        <input
                          value={reasonById[order.id] ?? ""}
                          onChange={(event) => setReasonById({ ...reasonById, [order.id]: event.target.value })}
                          placeholder="เหตุผลยกเลิก"
                          className="w-[160px] rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm outline-none focus:border-red-400"
                        />
                        <button
                          disabled={busy}
                          onClick={() => runAction(order, "CANCEL")}
                          className="rounded-xl border border-red-400/40 px-4 py-2.5 text-xs font-black text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                        >
                          CANCEL
                        </button>
                      </div>
                    )}

                    {order.status === "SHIPPED" && (
                      <div className="mt-5 border-t border-zinc-900 pt-4">
                        <button
                          disabled={busy}
                          onClick={() => runAction(order, "DELIVER")}
                          className="rounded-xl bg-purple-400 px-5 py-2.5 text-xs font-black text-black hover:bg-purple-300 disabled:opacity-50"
                        >
                          MARK DELIVERED
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ================= PRODUCTS ================= */}
        {tab === "PRODUCTS" && (
          <section className="mt-6">
            <div className="flex justify-between">
              <p className="text-sm text-zinc-500">รูปภาพ ราคา สต็อกต่อไซซ์ และการแสดงผลบนหน้าร้าน</p>
              <button
                onClick={() => setDraft({ ...EMPTY_DRAFT })}
                className="rounded-xl bg-cyan-400 px-5 py-3 text-xs font-black text-black hover:bg-cyan-300"
              >
                + NEW PRODUCT
              </button>
            </div>

            {productsLoading ? (
              <p className="mt-6 animate-pulse text-xs tracking-[0.3em] text-zinc-500">LOADING PRODUCTS...</p>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-800">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-zinc-950 text-left text-[10px] tracking-[0.2em] text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">PRODUCT</th>
                      <th className="px-4 py-3">PRICE</th>
                      <th className="px-4 py-3">STOCK BY SIZE</th>
                      <th className="px-4 py-3">STATUS</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {products.map((product) => (
                      <tr key={product.id} className={product.is_active ? "" : "opacity-50"}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={product.images[0] ?? "/logo.png"} alt="" className="h-14 w-11 rounded object-cover" />
                            <div>
                              <p className="font-bold">{product.name}</p>
                              <p className="text-xs text-zinc-500">
                                {product.category} · {product.color_name ?? "—"} · /{product.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {formatTHB(product.price_thb)}
                          {product.compare_at_price_thb && (
                            <span className="ml-2 text-xs text-zinc-600 line-through">
                              {formatTHB(product.compare_at_price_thb)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {product.variants.map((variant) => (
                              <span
                                key={variant.id}
                                className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                                  variant.stock === 0
                                    ? "bg-red-400/10 text-red-400"
                                    : variant.stock <= 5
                                      ? "bg-yellow-400/10 text-yellow-400"
                                      : "bg-zinc-900 text-zinc-300"
                                }`}
                              >
                                {variant.size}:{variant.stock}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[10px] font-black tracking-[0.1em]">
                          <span className={product.is_active ? "text-lime-400" : "text-zinc-500"}>
                            {product.is_active ? "LIVE" : "HIDDEN"}
                          </span>
                          {product.is_featured && <span className="ml-2 text-cyan-400">FEATURED</span>}
                          {product.is_new && <span className="ml-2 text-purple-400">NEW</span>}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => setDraft(toDraft(product))} className="text-xs font-black text-cyan-400 hover:underline">
                            EDIT
                          </button>
                          <button onClick={() => deleteProduct(product)} className="ml-4 text-xs text-zinc-600 hover:text-red-400">
                            DELETE
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ================= PRODUCT EDITOR ================= */}
      {draft && (
        <div className="fixed inset-0 z-[70] flex justify-end">
          <div className="absolute inset-0 bg-black/70" onClick={() => !savingProduct && setDraft(null)} />
          <div className="relative h-full w-full max-w-2xl overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black">{draft.id ? "EDIT PRODUCT" : "NEW PRODUCT"}</h2>
              <button onClick={() => setDraft(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AdminField label="NAME" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
              <AdminField
                label="SLUG (URL)"
                value={draft.slug}
                onChange={(v) => setDraft({ ...draft, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
              />
              <div>
                <label className="text-[9px] tracking-[0.25em] text-zinc-500">CATEGORY</label>
                <select
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm"
                >
                  {SHOP_CATEGORIES.map((category) => (
                    <option key={category.code} value={category.code}>
                      {category.labelEn} · {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <AdminField label="COLOR" value={draft.color_name} onChange={(v) => setDraft({ ...draft, color_name: v })} />
              <AdminField
                label="PRICE (THB)"
                value={draft.price_thb}
                onChange={(v) => setDraft({ ...draft, price_thb: v.replace(/\D/g, "") })}
              />
              <AdminField
                label="COMPARE-AT PRICE (ราคาก่อนลด)"
                value={draft.compare_at_price_thb}
                onChange={(v) => setDraft({ ...draft, compare_at_price_thb: v.replace(/\D/g, "") })}
              />
              <div className="sm:col-span-2">
                <label className="text-[9px] tracking-[0.25em] text-zinc-500">DESCRIPTION</label>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <AdminField label="MATERIAL" value={draft.material} onChange={(v) => setDraft({ ...draft, material: v })} />
              <AdminField label="FIT" value={draft.fit} onChange={(v) => setDraft({ ...draft, fit: v })} />
              <div className="sm:col-span-2">
                <AdminField label="CARE" value={draft.care} onChange={(v) => setDraft({ ...draft, care: v })} />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[9px] tracking-[0.25em] text-zinc-500">IMAGES (รูปแรก = รูปหลัก)</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {draft.images.map((src, index) => (
                  <div key={src} className="relative">
                    <img src={src} alt="" className="h-28 w-22 rounded-lg border border-zinc-800 object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/80 px-1 text-[10px]">
                      <button
                        disabled={index === 0}
                        onClick={() => {
                          const images = [...draft.images];
                          [images[index - 1], images[index]] = [images[index], images[index - 1]];
                          setDraft({ ...draft, images });
                        }}
                        className="disabled:opacity-20"
                      >
                        ◀
                      </button>
                      <button
                        onClick={() => setDraft({ ...draft, images: draft.images.filter((_, i) => i !== index) })}
                        className="text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <label className="flex h-28 w-22 cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:border-cyan-400 hover:text-cyan-400">
                  {uploading ? "..." : "+ UPLOAD"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadImage(file);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <p className="text-[9px] tracking-[0.25em] text-zinc-500">SIZES & STOCK</p>
                <button
                  onClick={() => setDraft({ ...draft, variants: [...draft.variants, { size: "", stock: "0" }] })}
                  className="text-xs text-cyan-400"
                >
                  + ADD SIZE
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {draft.variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black p-2">
                    <input
                      value={variant.size}
                      onChange={(event) => {
                        const variants = [...draft.variants];
                        variants[index] = { ...variant, size: event.target.value.toUpperCase() };
                        setDraft({ ...draft, variants });
                      }}
                      placeholder="SIZE"
                      className="w-14 bg-transparent font-mono text-sm font-black outline-none"
                    />
                    <input
                      value={variant.stock}
                      onChange={(event) => {
                        const variants = [...draft.variants];
                        variants[index] = { ...variant, stock: event.target.value.replace(/\D/g, "") };
                        setDraft({ ...draft, variants });
                      }}
                      className="w-full rounded bg-zinc-900 px-2 py-1 text-right font-mono text-sm outline-none"
                      aria-label={`stock ${variant.size}`}
                    />
                    <button
                      onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, i) => i !== index) })}
                      className="text-xs text-zinc-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-5 text-sm">
              <Toggle label="แสดงบนหน้าร้าน" checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} />
              <Toggle label="FEATURED" checked={draft.is_featured} onChange={(v) => setDraft({ ...draft, is_featured: v })} />
              <Toggle label="NEW" checked={draft.is_new} onChange={(v) => setDraft({ ...draft, is_new: v })} />
              <label className="flex items-center gap-2 text-zinc-400">
                ลำดับ
                <input
                  value={draft.sort_order}
                  onChange={(event) => setDraft({ ...draft, sort_order: event.target.value.replace(/[^\d-]/g, "") })}
                  className="w-16 rounded-lg border border-zinc-800 bg-black px-2 py-1 font-mono"
                />
              </label>
            </div>

            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

            <div className="sticky bottom-0 mt-8 flex gap-3 bg-zinc-950 py-4">
              <button
                onClick={saveProduct}
                disabled={savingProduct || uploading}
                className="flex-1 rounded-xl bg-cyan-400 py-3.5 font-black text-black hover:bg-cyan-300 disabled:opacity-50"
              >
                {savingProduct ? "SAVING..." : "SAVE PRODUCT"}
              </button>
              <button onClick={() => setDraft(null)} className="rounded-xl border border-zinc-800 px-6 text-sm text-zinc-400">
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function AdminField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-[9px] tracking-[0.25em] text-zinc-500">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm outline-none focus:border-cyan-400"
      />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-cyan-400" />
      {label}
    </label>
  );
}
