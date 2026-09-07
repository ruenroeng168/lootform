"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type ShopItem = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  price_thb: number;
  available_sizes: string[];
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

const EMPTY_FORM = {
  name: "",
  category: "",
  description: "",
  price_thb: "",
  available_sizes: "",
  image_url: "",
};

export default function AdminShopPage() {
  const router = useRouter();

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ShopItem[]>([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);

  const authenticatedFetch = useCallback(async (url: string, options?: RequestInit) => {
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) throw new Error(sessionError.message);
    if (!data.session) throw new Error("Admin session not found. Please login again.");

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
        ...(options?.headers ?? {}),
      },
    });

    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.message || "Request failed");
    }

    return result;
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const result = await authenticatedFetch("/api/admin/shop/items");
      setItems(result.items as ShopItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load shop items");
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch, router]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function uploadImage(file: File) {
    setUploadingImage(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/shop/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Unable to upload image");
      }

      setForm((current) => ({ ...current, image_url: result.image_url as string }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  async function createItem() {
    const priceThb = Number(form.price_thb);

    if (!form.name.trim()) {
      setError("กรุณาระบุชื่อสินค้า");
      return;
    }

    if (!form.category.trim()) {
      setError("กรุณาระบุหมวดหมู่สินค้า");
      return;
    }

    if (!Number.isFinite(priceThb) || priceThb <= 0) {
      setError("ราคาต้องมากกว่า 0");
      return;
    }

    const parsedSizes = form.available_sizes
      .split(",")
      .map((size) => size.trim())
      .filter(Boolean);

    if (parsedSizes.length === 0) {
      setError("กรุณาระบุไซซ์อย่างน้อย 1 ไซซ์ (เช่น S, M, L, XL) — ไม่งั้นลูกค้าจะสั่งซื้อโดยไม่มีไซซ์ได้");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await authenticatedFetch("/api/admin/shop/items", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          description: form.description,
          price_thb: priceThb,
          available_sizes: parsedSizes,
          image_url: form.image_url,
          sort_order: items.length,
        }),
      });

      setItems((current) => [...current, result.item as ShopItem]);
      setForm(EMPTY_FORM);
      setSuccess("SHOP ITEM ADDED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create shop item");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: ShopItem) {
    try {
      const result = await authenticatedFetch("/api/admin/shop/items", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });

      setItems((current) => current.map((row) => (row.id === item.id ? (result.item as ShopItem) : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update shop item");
    }
  }

  async function deleteItem(item: ShopItem) {
    if (!window.confirm(`ลบสินค้า "${item.name}" ถาวร? ย้อนกลับไม่ได้`)) return;

    try {
      await authenticatedFetch(`/api/admin/shop/items?id=${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete shop item");
    }
  }

  function startEdit(item: ShopItem) {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      category: item.category,
      description: item.description ?? "",
      price_thb: String(item.price_thb),
      available_sizes: item.available_sizes.join(", "),
      image_url: item.image_url ?? "",
    });
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  async function uploadEditImage(file: File) {
    setUploadingEditImage(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/shop/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Unable to upload image");
      }

      setEditForm((current) => ({ ...current, image_url: result.image_url as string }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload image");
    } finally {
      setUploadingEditImage(false);
    }
  }

  async function saveEdit() {
    if (editingId === null) return;

    const priceThb = Number(editForm.price_thb);

    if (!editForm.name.trim()) {
      setError("กรุณาระบุชื่อสินค้า");
      return;
    }

    if (!editForm.category.trim()) {
      setError("กรุณาระบุหมวดหมู่สินค้า");
      return;
    }

    if (!Number.isFinite(priceThb) || priceThb <= 0) {
      setError("ราคาต้องมากกว่า 0");
      return;
    }

    const parsedSizes = editForm.available_sizes
      .split(",")
      .map((size) => size.trim())
      .filter(Boolean);

    if (parsedSizes.length === 0) {
      setError("กรุณาระบุไซซ์อย่างน้อย 1 ไซซ์ (เช่น S, M, L, XL) — ไม่งั้นลูกค้าจะสั่งซื้อโดยไม่มีไซซ์ได้");
      return;
    }

    setSavingEdit(true);
    setError("");
    setSuccess("");

    try {
      const result = await authenticatedFetch("/api/admin/shop/items", {
        method: "PATCH",
        body: JSON.stringify({
          id: editingId,
          name: editForm.name,
          category: editForm.category,
          description: editForm.description,
          price_thb: priceThb,
          available_sizes: parsedSizes,
          image_url: editForm.image_url,
        }),
      });

      setItems((current) =>
        current.map((row) => (row.id === editingId ? (result.item as ShopItem) : row))
      );
      cancelEdit();
      setSuccess("SHOP ITEM UPDATED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update shop item");
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white">
        <Navbar />
        <div className="min-h-[80vh] flex items-center justify-center">
          <p className="text-lime-400 tracking-[0.35em] animate-pulse">LOADING SHOP ADMIN...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white relative overflow-hidden">
      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="text-zinc-600 text-[9px] tracking-[0.3em]">LOOTFORM ADMIN</p>
            <h1 className="text-4xl sm:text-6xl font-black mt-2">
              SHOP <span className="text-lime-400">CATALOG</span>
            </h1>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/admin/shop/orders")}
              className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
            >
              REVIEW ORDERS →
            </button>
            <button
              onClick={() => router.push("/admin")}
              className="border border-zinc-800 bg-black/40 text-zinc-300 px-5 py-3 rounded-xl text-xs font-black hover:border-lime-400 hover:text-lime-400 transition"
            >
              ← ADMIN DASHBOARD
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 border border-red-400/30 bg-red-400/[0.07] rounded-xl p-5 text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 border border-lime-400/30 bg-lime-400/[0.07] rounded-xl p-5 text-lime-400 font-black">
            ✓ {success}
          </div>
        )}

        {/* =====================================
            ITEMS
        ===================================== */}

        <section className="mt-8 border border-zinc-800 bg-zinc-950/75 rounded-[28px] p-6 sm:p-8">
          <p className="text-purple-400 text-[9px] tracking-[0.3em]">PLAIN CATALOG — NO GRADE ROLL</p>
          <h2 className="text-2xl font-black mt-2">SHOP ITEMS</h2>

          <div className="mt-5 space-y-2">
            {items.length === 0 && <p className="text-zinc-600 text-sm">ยังไม่มีสินค้า — เพิ่มด้านล่าง</p>}

            {items.map((item) =>
              editingId === item.id ? (
                <div
                  key={item.id}
                  className="border border-purple-400/30 bg-purple-400/[0.04] rounded-xl px-4 py-4 space-y-3"
                >
                  <div className="grid md:grid-cols-[auto_1fr] gap-4">
                    <div>
                      <div className="flex h-[100px] w-[100px] items-center justify-center rounded-xl border border-zinc-800 bg-black/50 overflow-hidden">
                        {editForm.image_url ? (
                          <img src={editForm.image_url} alt="Preview" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-zinc-700 text-[9px]">NO IMAGE</span>
                        )}
                      </div>
                      <label className="mt-2 block">
                        <span
                          className={`inline-block w-[100px] text-center border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 rounded-lg py-2 text-[9px] font-black cursor-pointer hover:bg-cyan-400/10 transition ${
                            uploadingEditImage ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {uploadingEditImage ? "UPLOADING..." : "เปลี่ยนรูป"}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          disabled={uploadingEditImage}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void uploadEditImage(file);
                          }}
                        />
                      </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="ชื่อสินค้า"
                        value={editForm.name}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, name: event.target.value }))
                        }
                        className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
                      />
                      <input
                        type="text"
                        placeholder="หมวดหมู่ (เช่น เสื้อ, หมวก)"
                        value={editForm.category}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, category: event.target.value }))
                        }
                        className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="ราคา (THB)"
                        value={editForm.price_thb}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, price_thb: event.target.value }))
                        }
                        className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
                      />
                      <input
                        type="text"
                        placeholder="ไซซ์ คั่นด้วย , เช่น S,M,L"
                        value={editForm.available_sizes}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, available_sizes: event.target.value }))
                        }
                        className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
                      />
                      <textarea
                        placeholder="คำอธิบายสินค้า (ไม่บังคับ)"
                        value={editForm.description}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, description: event.target.value }))
                        }
                        className="sm:col-span-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400 min-h-[60px]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg border border-zinc-700 bg-black/40 px-4 py-2.5 text-[10px] font-black text-zinc-400 hover:border-zinc-500 transition"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={savingEdit}
                      className="rounded-lg border border-lime-400/30 bg-lime-400/[0.08] px-4 py-2.5 text-[10px] font-black text-lime-400 hover:bg-lime-400/15 disabled:opacity-50 transition"
                    >
                      {savingEdit ? "SAVING..." : "บันทึก"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 border border-zinc-800 bg-black/40 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-lg border border-zinc-800 bg-black/50 overflow-hidden flex items-center justify-center shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-zinc-700 text-[8px]">NO IMG</span>
                      )}
                    </div>
                    <div>
                      <p className="text-white font-black">
                        {item.name}
                        <span className="text-lime-400 ml-2 text-sm">฿{item.price_thb.toLocaleString()}</span>
                      </p>
                      <p className="text-zinc-600 text-xs mt-0.5">
                        {item.category}
                        {item.available_sizes.length > 0 && <> · ไซซ์ {item.available_sizes.join(", ")}</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(item)}
                      className={`rounded-lg border px-3 py-2 text-[10px] font-black transition ${
                        item.is_active
                          ? "border-lime-400/30 bg-lime-400/[0.05] text-lime-400"
                          : "border-zinc-700 bg-black/50 text-zinc-500"
                      }`}
                    >
                      {item.is_active ? "ACTIVE" : "INACTIVE"}
                    </button>

                    <button
                      onClick={() => startEdit(item)}
                      className="rounded-lg border border-cyan-400/20 bg-cyan-400/[0.03] px-3 py-2 text-[10px] font-black text-cyan-400/80 hover:border-cyan-400 hover:text-cyan-400 transition"
                    >
                      EDIT
                    </button>

                    <button
                      onClick={() => deleteItem(item)}
                      className="rounded-lg border border-red-400/20 bg-red-400/[0.03] px-3 py-2 text-[10px] font-black text-red-400/70 hover:border-red-400 hover:text-red-400 transition"
                    >
                      DELETE
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="mt-6 grid md:grid-cols-[auto_1fr] gap-6">
            <div>
              <p className="text-zinc-600 text-[8px] tracking-[0.2em]">รูปสินค้า</p>

              <div className="mt-3 flex h-[140px] w-[140px] items-center justify-center rounded-xl border border-zinc-800 bg-black/50 overflow-hidden">
                {form.image_url ? (
                  <img src={form.image_url} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-zinc-700 text-[9px]">NO IMAGE</span>
                )}
              </div>

              <label className="mt-3 block">
                <span
                  className={`inline-block w-[140px] text-center border border-cyan-400/30 bg-cyan-400/[0.05] text-cyan-400 rounded-xl py-2.5 text-[10px] font-black cursor-pointer hover:bg-cyan-400/10 transition ${
                    uploadingImage ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {uploadingImage ? "UPLOADING..." : "UPLOAD IMAGE"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadImage(file);
                  }}
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="ชื่อสินค้า"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
              />
              <input
                type="text"
                placeholder="หมวดหมู่ (เช่น เสื้อ, หมวก)"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
              />
              <input
                type="number"
                min="0"
                placeholder="ราคา (THB)"
                value={form.price_thb}
                onChange={(event) => setForm((current) => ({ ...current, price_thb: event.target.value }))}
                className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
              />
              <input
                type="text"
                placeholder="ไซซ์ คั่นด้วย , เช่น S,M,L (เว้นว่างถ้าไม่มีไซซ์)"
                value={form.available_sizes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, available_sizes: event.target.value }))
                }
                className="border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400"
              />
              <textarea
                placeholder="คำอธิบายสินค้า (ไม่บังคับ)"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                className="sm:col-span-2 border border-zinc-800 bg-black/50 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-400 min-h-[80px]"
              />
              <button
                onClick={createItem}
                disabled={saving}
                className="sm:col-span-2 border border-purple-400/30 bg-purple-400/[0.05] text-purple-400 rounded-xl px-6 py-3 text-xs font-black hover:bg-purple-400/10 disabled:opacity-50 transition"
              >
                {saving ? "ADDING..." : "+ ADD SHOP ITEM"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
