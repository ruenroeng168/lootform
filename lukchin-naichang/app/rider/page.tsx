import type { Metadata } from "next";
import { AccessDenied } from "@/components/access-denied";
import { StaffShell } from "@/components/staff-shell";
import { Card, PageTitle, UnavailableBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "งานจัดส่ง" };

export default async function RiderPage() {
  const auth = await requireRole(["rider", "admin"]);
  return (
    <div>
      <PageTitle title="งานจัดส่ง" subtitle="แดชบอร์ดสำหรับไรเดอร์ของร้าน" />
      {!auth.ok ? (
        <AccessDenied reason={auth.reason} />
      ) : (
        <StaffShell ctx={auth.ctx}>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">งานที่ได้รับมอบหมาย</h2>
              <UnavailableBadge />
            </div>
            <p className="mt-2 text-sm text-stone-500">
              ยังไม่มีงานจัดส่ง ไรเดอร์จะเห็นเฉพาะคำสั่งซื้อที่ได้รับมอบหมายเท่านั้น
            </p>
          </Card>
        </StaffShell>
      )}
    </div>
  );
}
