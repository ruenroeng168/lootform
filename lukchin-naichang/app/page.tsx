import Link from "next/link";
import { OpenStatus } from "@/components/open-status";
import { Card, Notice, UnavailableBadge } from "@/components/ui";
import { ORDERING_DISABLED_MESSAGE, STORE } from "@/lib/store-config";

export default function HomePage() {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-8 text-white shadow-md">
        <p className="text-sm text-brand-100">{STORE.tagline} · จ.{STORE.city}</p>
        <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{STORE.name}</h1>
        <p className="mt-1 text-xs tracking-[0.2em] text-brand-100">{STORE.nameEn}</p>
        <div className="mt-4">
          <OpenStatus />
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/menu"
            className="rounded-full bg-white px-5 py-3 text-center font-semibold text-brand-700 shadow hover:bg-brand-50"
          >
            ดูเมนู
          </Link>
          <span
            aria-disabled="true"
            className="cursor-not-allowed rounded-full border border-white/40 px-5 py-3 text-center font-semibold text-white/80"
          >
            สั่งอาหารออนไลน์ (เร็ว ๆ นี้)
          </span>
        </div>
      </section>

      <Notice tone="warning" title="ตัวอย่างเว็บไซต์ (Preview)">
        {ORDERING_DISABLED_MESSAGE}
      </Notice>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold text-stone-900">เวลาทำการ</h2>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            {STORE.openTime}–{STORE.closeTime} น.
          </p>
          <p className="text-sm text-stone-600">ทุกวัน (เวลาประเทศไทย)</p>
        </Card>
        <Card>
          <h2 className="font-semibold text-stone-900">พื้นที่จัดส่ง</h2>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            รัศมี {STORE.deliveryRadiusKm} กม.
          </p>
          <p className="text-sm text-stone-600">จัดส่งโดยพนักงานของร้าน</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-stone-900">วิธีรับอาหาร</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          <li className="rounded-xl bg-brand-50 p-3">
            <p className="font-semibold text-brand-900">🛍️ รับเองที่ร้าน</p>
            <p className="text-sm text-stone-600">สั่งล่วงหน้าแล้วมารับที่หน้าร้าน</p>
          </li>
          <li className="rounded-xl bg-brand-50 p-3">
            <p className="font-semibold text-brand-900">🛵 จัดส่งถึงบ้าน</p>
            <p className="text-sm text-stone-600">
              ภายในรัศมี {STORE.deliveryRadiusKm} กม. จากร้าน
            </p>
          </li>
        </ul>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-stone-900">การชำระเงิน</h2>
          <UnavailableBadge />
        </div>
        <p className="mt-2 text-sm text-stone-700">
          ร้านจะรับชำระผ่าน <strong>{STORE.paymentMethod}</strong>{" "}
          เมื่อเปิดระบบสั่งอาหารออนไลน์ ขณะนี้ยังไม่มีการเรียกเก็บเงินผ่านเว็บไซต์
        </p>
      </Card>
    </div>
  );
}
