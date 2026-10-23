import type { Metadata } from "next";
import { AccessDenied } from "@/components/access-denied";
import { StaffShell } from "@/components/staff-shell";
import { Card, PageTitle, UnavailableBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "รายการคำสั่งซื้อ" };

const COLUMNS = ["รอชำระเงิน", "กำลังเตรียม", "พร้อมรับ / กำลังจัดส่ง", "เสร็จสิ้น"];

export default async function StaffOrdersPage() {
  const auth = await requireRole(["staff", "admin"]);
  return (
    <div>
      <PageTitle title="รายการคำสั่งซื้อ" subtitle="แดชบอร์ดสำหรับพนักงานร้าน" />
      {!auth.ok ? (
        <AccessDenied reason={auth.reason} />
      ) : (
        <StaffShell ctx={auth.ctx}>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLUMNS.map((col) => (
              <Card key={col}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{col}</h2>
                  <UnavailableBadge />
                </div>
                <p className="mt-2 text-sm text-stone-500">ยังไม่มีคำสั่งซื้อ (ระบบสั่งอาหารยังไม่เปิด)</p>
              </Card>
            ))}
          </div>
        </StaffShell>
      )}
    </div>
  );
}
