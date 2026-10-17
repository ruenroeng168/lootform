"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cartSubtotal, clearCart, reconcileCart, replaceCart, useCart } from "@/lib/cart";
import { formatTHB, shippingFeeFor, type ShopProduct } from "@/lib/shop";
import { THAI_PROVINCES } from "@/lib/thai-provinces";

type PaymentInfo = {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  qr_image_url: string | null;
};

type SavedAddress = {
  id: number;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string | null;
  district: string | null;
  province: string;
  postal_code: string;
  is_default: boolean;
};

type AddressForm = {
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
};

const EMPTY_ADDRESS: AddressForm = {
  recipient_name: "",
  phone: "",
  address_line: "",
  subdistrict: "",
  district: "",
  province: "",
  postal_code: "",
};

const MAX_SLIP_SIZE = 5 * 1024 * 1024;

function toForm(address: SavedAddress): AddressForm {
  return {
    recipient_name: address.recipient_name,
    phone: address.phone,
    address_line: address.address_line,
    subdistrict: address.subdistrict ?? "",
    district: address.district ?? "",
    province: address.province,
    postal_code: address.postal_code,
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart();

  const [authState, setAuthState] = useState<"loading" | "guest" | "ready">("loading");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [address, setAddress] = useState<AddressForm>(EMPTY_ADDRESS);
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [slip, setSlip] = useState<File | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [copied, setCopied] = useState(false);

  // One id per checkout attempt — a retried submit cannot create a second order.
  const [requestId] = useState(() => crypto.randomUUID());

  const slipPreview = useMemo(() => (slip ? URL.createObjectURL(slip) : null), [slip]);
  useEffect(() => () => {
    if (slipPreview) URL.revokeObjectURL(slipPreview);
  }, [slipPreview]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        setAuthState("guest");
        return;
      }

      const [addressResult, paymentResult, productResult] = await Promise.all([
        supabase
          .from("shipping_addresses")
          .select("id, recipient_name, phone, address_line, subdistrict, district, province, postal_code, is_default")
          .eq("user_id", data.session.user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),
        fetch("/api/shop/payment-info", { cache: "no-store" }).then((response) => response.json()),
        fetch("/api/shop/products", { cache: "no-store" }).then((response) => response.json()),
      ]);

      if (cancelled) return;

      const addresses = (addressResult.data ?? []) as SavedAddress[];
      setSavedAddresses(addresses);
      if (addresses[0]) setAddress(toForm(addresses[0]));

      if (paymentResult?.success) setPayment(paymentResult.payment as PaymentInfo);

      if (productResult?.success) {
        // Read the cart at load time; the dependency list stays empty on purpose.
        const reconciled = reconcileCart(lines, productResult.products as ShopProduct[]);
        if (reconciled.changed) {
          setNotices(reconciled.notices);
          replaceCart(reconciled.lines);
        }
      }

      setAuthState("ready");
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = cartSubtotal(lines);
  const shipping = shippingFeeFor(subtotal);
  const total = subtotal + shipping;

  function update<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setAddress((current) => ({ ...current, [key]: value }));
  }

  function pickSlip(file: File | undefined) {
    setError("");
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("สลิปต้องเป็นไฟล์ JPEG, PNG หรือ WEBP");
      return;
    }
    if (file.size > MAX_SLIP_SIZE) {
      setError("สลิปต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    setSlip(file);
  }

  function validate() {
    if (!address.recipient_name.trim()) return "กรุณากรอกชื่อผู้รับ";
    if (!/^\+?\d{9,15}$/.test(address.phone.replace(/[\s-]/g, ""))) return "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง";
    if (!address.address_line.trim()) return "กรุณากรอกที่อยู่";
    if (!address.province) return "กรุณาเลือกจังหวัด";
    if (!/^\d{5}$/.test(address.postal_code)) return "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก";
    if (!slip) return "กรุณาแนบสลิปการโอนเงิน";
    return "";
  }

  async function submit() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push("/login?next=/checkout");
        return;
      }

      const formData = new FormData();
      formData.append(
        "payload",
        JSON.stringify({
          request_id: requestId,
          items: lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
          address: { ...address, phone: address.phone.replace(/[\s-]/g, "") },
          note,
        })
      );
      formData.append("file", slip as File);

      const response = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        body: formData,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "ไม่สามารถสร้างคำสั่งซื้อได้");
      }

      setPlaced(true);
      clearCart();
      router.push(`/orders?placed=${encodeURIComponent(result.reference)}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ไม่สามารถสร้างคำสั่งซื้อได้");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyAccount() {
    if (!payment?.bank_account_number) return;
    try {
      await navigator.clipboard.writeText(payment.bank_account_number.replace(/\D/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the number is visible to copy manually.
    }
  }

  if (authState === "loading" || placed) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs tracking-[0.3em] text-[var(--muted)] animate-pulse">
          {placed ? "กำลังไปที่คำสั่งซื้อ..." : "LOADING CHECKOUT..."}
        </p>
      </main>
    );
  }

  if (authState === "guest") {
    return (
      <main className="mx-auto max-w-md px-6 py-28 text-center">
        <h1 className="text-2xl font-bold">เข้าสู่ระบบเพื่อชำระเงิน</h1>
        <p className="mt-3 text-[var(--muted)]">
          สินค้าในตะกร้าจะยังอยู่ครบ เข้าสู่ระบบหรือสมัครสมาชิกเพื่อติดตามสถานะคำสั่งซื้อได้
        </p>
        <Link
          href="/login?next=/checkout"
          className="mt-8 inline-block rounded-[var(--radius-md)] bg-[var(--foreground)] px-8 py-3.5 text-sm font-semibold text-black hover:opacity-90"
        >
          เข้าสู่ระบบ / สมัครสมาชิก
        </Link>
        <Link href="/cart" className="mt-4 block text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
          ← กลับไปที่ตะกร้า
        </Link>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-md px-6 py-28 text-center">
        <h1 className="text-2xl font-bold">ไม่มีสินค้าในตะกร้า</h1>
        {notices.length > 0 && (
          <div className="mt-4 text-sm text-[var(--grade-legendary)]">
            {notices.map((notice) => <p key={notice}>{notice}</p>)}
          </div>
        )}
        <Link
          href="/shop"
          className="mt-8 inline-block rounded-[var(--radius-md)] bg-[var(--foreground)] px-8 py-3.5 text-sm font-semibold text-black"
        >
          เลือกซื้อสินค้า
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold">ชำระเงิน</h1>
      <ol className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] tracking-[0.15em] text-[var(--muted)]">
        <li>01 ที่อยู่จัดส่ง</li>
        <li>02 โอนเงิน</li>
        <li>03 แนบสลิป</li>
      </ol>

      {notices.length > 0 && (
        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--grade-legendary)]/40 bg-[var(--grade-legendary)]/[0.06] p-4 text-sm text-[var(--grade-legendary)]">
          {notices.map((notice) => <p key={notice}>• {notice}</p>)}
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          {/* ================= ADDRESS ================= */}
          <Section step="01" title="ที่อยู่จัดส่ง">
            {savedAddresses.length > 0 && (
              <div className="mb-5">
                <label className="text-xs text-[var(--muted)]">ที่อยู่ที่บันทึกไว้</label>
                <select
                  onChange={(event) => {
                    const picked = savedAddresses.find((item) => item.id === Number(event.target.value));
                    setAddress(picked ? toForm(picked) : EMPTY_ADDRESS);
                  }}
                  defaultValue={savedAddresses[0]?.id}
                  className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)]"
                >
                  {savedAddresses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.recipient_name} · {item.address_line}, {item.province}
                      {item.is_default ? " (ค่าเริ่มต้น)" : ""}
                    </option>
                  ))}
                  <option value="0">+ กรอกที่อยู่ใหม่</option>
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ชื่อ-นามสกุลผู้รับ" value={address.recipient_name} onChange={(v) => update("recipient_name", v)} autoComplete="name" />
              <Field label="เบอร์โทรศัพท์" value={address.phone} onChange={(v) => update("phone", v)} inputMode="tel" autoComplete="tel" placeholder="08x-xxx-xxxx" />
              <div className="sm:col-span-2">
                <Field label="ที่อยู่ (บ้านเลขที่ ถนน ซอย)" value={address.address_line} onChange={(v) => update("address_line", v)} autoComplete="street-address" />
              </div>
              <Field label="แขวง / ตำบล" value={address.subdistrict} onChange={(v) => update("subdistrict", v)} />
              <Field label="เขต / อำเภอ" value={address.district} onChange={(v) => update("district", v)} />
              <div>
                <label className="text-xs text-[var(--muted)]">จังหวัด</label>
                <select
                  value={address.province}
                  onChange={(event) => update("province", event.target.value)}
                  className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)]"
                >
                  <option value="">เลือกจังหวัด</option>
                  {THAI_PROVINCES.map((province) => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                  {address.province && !THAI_PROVINCES.includes(address.province) && (
                    <option value={address.province}>{address.province}</option>
                  )}
                </select>
              </div>
              <Field
                label="รหัสไปรษณีย์"
                value={address.postal_code}
                onChange={(v) => update("postal_code", v.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                autoComplete="postal-code"
              />
              <div className="sm:col-span-2">
                <label className="text-xs text-[var(--muted)]">หมายเหตุถึงร้าน (ไม่บังคับ)</label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 500))}
                  rows={2}
                  className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg)] px-4 py-3 text-sm outline-none focus:border-[var(--foreground)]"
                />
              </div>
            </div>
          </Section>

          {/* ================= PAYMENT ================= */}
          <Section step="02" title="โอนเงินเข้าบัญชี">
            {payment && (payment.bank_account_number || payment.qr_image_url) ? (
              <div className={`grid gap-6 sm:items-center ${payment.qr_image_url ? "sm:grid-cols-[180px_1fr]" : ""}`}>
                {payment.qr_image_url ? (
                  <img
                    src={payment.qr_image_url}
                    alt="QR สำหรับชำระเงิน"
                    className="w-full max-w-[180px] rounded-[var(--radius-md)] bg-white p-2"
                  />
                ) : null}
                <div className="space-y-3">
                  <PaymentRow label="ธนาคาร" value={payment.bank_name || "-"} />
                  <PaymentRow label="ชื่อบัญชี" value={payment.bank_account_name || "-"} />
                  <div className="flex items-end justify-between gap-3">
                    <PaymentRow label="เลขที่บัญชี" value={payment.bank_account_number || "-"} mono />
                    {payment.bank_account_number && (
                      <button
                        type="button"
                        onClick={copyAccount}
                        className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] px-3 py-1.5 text-xs hover:border-[var(--foreground)]"
                      >
                        {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
                      </button>
                    )}
                  </div>
                  <div className="rounded-[var(--radius-md)] border border-[var(--grade-rare)]/40 bg-[var(--grade-rare)]/[0.06] px-4 py-3">
                    <p className="text-xs text-[var(--muted)]">ยอดที่ต้องโอน</p>
                    <p className="font-mono text-2xl text-[var(--grade-rare)]">{formatTHB(total)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--grade-legendary)]">
                ร้านยังไม่ได้ตั้งค่าบัญชีรับเงิน กรุณาติดต่อทีมงาน
              </p>
            )}
          </Section>

          {/* ================= SLIP ================= */}
          <Section step="03" title="แนบสลิปการโอนเงิน">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-6 py-8 text-center transition hover:border-[var(--foreground)]">
              {slipPreview ? (
                <img src={slipPreview} alt="สลิปที่แนบ" className="max-h-64 rounded-[var(--radius-sm)] object-contain" />
              ) : (
                <>
                  <span className="text-3xl text-[var(--muted)]">↑</span>
                  <span className="text-sm">คลิกเพื่อเลือกรูปสลิป</span>
                </>
              )}
              <span className="text-xs text-[var(--muted)]">
                {slip ? `${slip.name} · เปลี่ยนรูป` : "JPEG / PNG / WEBP ไม่เกิน 5 MB"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  pickSlip(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </Section>
        </div>

        {/* ================= SUMMARY ================= */}
        <aside className="h-fit rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 lg:sticky lg:top-40">
          <p className="font-display text-lg font-bold">สรุปคำสั่งซื้อ</p>
          <ul className="mt-3 max-h-[320px] space-y-4 overflow-y-auto pr-1 pt-2">
            {lines.map((line) => (
              <li key={line.variantId} className="flex gap-3">
                <div className="relative shrink-0 ml-1">
                  <img
                    src={line.image ?? "/logo.png"}
                    alt=""
                    className="h-20 w-16 rounded-[var(--radius-sm)] border border-[var(--border)] object-cover"
                  />
                  <span className="absolute -right-2 -top-2 h-5 min-w-5 rounded-full bg-[var(--muted)] px-1 text-center font-mono text-[11px] leading-5 text-black">
                    {line.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{line.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {[line.colorName, line.size].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="font-mono text-sm">{formatTHB(line.priceThb * line.quantity)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-3 border-t border-[var(--border)] pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">ยอดรวมสินค้า</dt>
              <dd className="font-mono">{formatTHB(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">ค่าจัดส่ง</dt>
              <dd className="font-mono">{shipping === 0 ? "ฟรี" : formatTHB(shipping)}</dd>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-4 text-base">
              <dt className="font-semibold">ยอดชำระทั้งหมด</dt>
              <dd className="font-mono font-semibold">{formatTHB(total)}</dd>
            </div>
          </dl>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-6 w-full rounded-[var(--radius-md)] bg-[var(--foreground)] py-4 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "กำลังส่งคำสั่งซื้อ..." : `ยืนยันคำสั่งซื้อ · ${formatTHB(total)}`}
          </button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--muted-dim)]">
            ทีมงานจะตรวจสอบสลิปและยืนยันคำสั่งซื้อภายใน 24 ชม. ยอดชำระจริงคำนวณจากราคาและสต็อก ณ เวลาสั่งซื้อ
          </p>
        </aside>
      </div>
    </main>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] p-6">
      <p className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-[var(--grade-rare)]">{step}</span>
        <span className="font-display text-lg font-bold">{title}</span>
      </p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  ...input
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div>
      <label className="text-xs text-[var(--muted)]">{label}</label>
      <input
        {...input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg)] px-4 py-3 text-sm outline-none transition focus:border-[var(--foreground)]"
      />
    </div>
  );
}

function PaymentRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 ${mono ? "font-mono text-lg tracking-wider" : "text-sm font-semibold"}`}>{value}</p>
    </div>
  );
}
