import type { Metadata } from "next";
import { Card, Notice, PageTitle, UnavailableBadge } from "@/components/ui";

export const metadata: Metadata = { title: "เมนู" };

// Category names only. Items and prices will come from the database once the
// owner supplies the real menu; nothing here is a real price.
const CATEGORIES = [
  { name: "ลูกชิ้น", note: "ลูกชิ้นหมู ลูกชิ้นเนื้อ และอื่น ๆ" },
  { name: "อาหารปรุงสุก", note: "เมนูพร้อมทาน" },
  { name: "เครื่องดื่ม", note: "" },
];

export default function MenuPage() {
  return (
    <div>
      <PageTitle title="เมนูอาหาร" subtitle="รายการอาหารและราคาจะประกาศเมื่อเปิดระบบ" />
      <Notice title="ยังไม่มีข้อมูลเมนูและราคา">
        ร้านกำลังจัดเตรียมรายการอาหารและราคาจริง ข้อมูลในหน้านี้เป็นเพียงโครงหน้าเว็บ
      </Notice>
      <div className="mt-4 space-y-3">
        {CATEGORIES.map((c) => (
          <Card key={c.name}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-stone-900">{c.name}</h2>
              <UnavailableBadge label="เร็ว ๆ นี้" />
            </div>
            {c.note ? <p className="mt-1 text-sm text-stone-600">{c.note}</p> : null}
            <p className="mt-3 rounded-lg bg-stone-50 p-3 text-center text-sm text-stone-500">
              ยังไม่มีรายการอาหาร
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
