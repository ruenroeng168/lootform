import type { Metadata } from "next";
import Link from "next/link";
import { Card, Notice, PageTitle } from "@/components/ui";
import { ORDERING_DISABLED_MESSAGE } from "@/lib/store-config";

export const metadata: Metadata = { title: "ตะกร้าสินค้า" };

export default function CartPage() {
  return (
    <div className="space-y-4">
      <PageTitle title="ตะกร้าสินค้า" />
      <Notice tone="warning" title="ยังไม่เปิดให้สั่งอาหาร">
        {ORDERING_DISABLED_MESSAGE}
      </Notice>
      <Card className="text-center">
        <p className="text-4xl" aria-hidden>
          🧺
        </p>
        <p className="mt-2 font-medium text-stone-800">ตะกร้าของคุณว่างอยู่</p>
        <p className="text-sm text-stone-500">ระบบตะกร้าสินค้าจะเปิดใช้งานพร้อมเมนูจริง</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/menu"
            className="rounded-full bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
          >
            ดูเมนู
          </Link>
          <Link
            href="/checkout"
            className="rounded-full border border-stone-300 px-5 py-3 font-semibold text-stone-700 hover:bg-stone-50"
          >
            ดูขั้นตอนชำระเงิน
          </Link>
        </div>
      </Card>
    </div>
  );
}
