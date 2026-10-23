import type { Metadata } from "next";
import { Card, Notice, PageTitle, UnavailableBadge } from "@/components/ui";
import { ORDERING_DISABLED_MESSAGE, ORDERING_ENABLED, STORE } from "@/lib/store-config";

export const metadata: Metadata = { title: "ชำระเงิน" };

// Placeholder only: there is no <form>, no server action and no API route that
// accepts an order. All controls are disabled.
export default function CheckoutPage() {
  return (
    <div className="space-y-4">
      <PageTitle title="ชำระเงิน" subtitle="ตัวอย่างขั้นตอนการสั่งอาหาร" />
      <Notice tone="warning" title="ยังไม่เปิดรับคำสั่งซื้อ">
        {ORDERING_DISABLED_MESSAGE}
      </Notice>

      <Card>
        <h2 className="font-semibold text-stone-900">1. เลือกวิธีรับอาหาร</h2>
        <fieldset disabled className="mt-3 grid gap-2 sm:grid-cols-2">
          <legend className="sr-only">วิธีรับอาหาร</legend>
          <label className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-stone-200 p-3 opacity-70">
            <input type="radio" name="fulfillment" className="mt-1" />
            <span>
              <span className="block font-medium">รับเองที่ร้าน</span>
              <span className="block text-sm text-stone-500">ไม่มีค่าจัดส่ง</span>
            </span>
          </label>
          <label className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-stone-200 p-3 opacity-70">
            <input type="radio" name="fulfillment" className="mt-1" />
            <span>
              <span className="block font-medium">จัดส่งถึงบ้าน</span>
              <span className="block text-sm text-stone-500">
                ภายใน {STORE.deliveryRadiusKm} กม. · ค่าจัดส่งจะแจ้งภายหลัง
              </span>
            </span>
          </label>
        </fieldset>
      </Card>

      <Card>
        <h2 className="font-semibold text-stone-900">2. ข้อมูลผู้สั่ง</h2>
        <p className="mt-2 text-sm text-stone-500">
          ระบบยังไม่เก็บข้อมูลชื่อ เบอร์โทร หรือที่อยู่ของลูกค้า
        </p>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-stone-900">3. ชำระเงินผ่าน {STORE.paymentMethod}</h2>
          <UnavailableBadge />
        </div>
        <p className="mt-2 text-sm text-stone-600">
          เมื่อเปิดระบบ ลูกค้าจะสแกน QR PromptPay ของร้านและแนบหลักฐานการโอน
          ขณะนี้ยังไม่มี QR สำหรับชำระเงิน โปรดอย่าโอนเงินผ่านช่องทางนี้
        </p>
      </Card>

      <button
        type="button"
        disabled={!ORDERING_ENABLED}
        className="w-full cursor-not-allowed rounded-full bg-stone-300 px-5 py-4 text-base font-semibold text-stone-600"
      >
        ยืนยันคำสั่งซื้อ (ยังไม่เปิดใช้งาน)
      </button>
    </div>
  );
}
