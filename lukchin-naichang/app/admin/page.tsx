import type { Metadata } from "next";
import { AccessDenied } from "@/components/access-denied";
import { StaffShell } from "@/components/staff-shell";
import { Card, PageTitle, UnavailableBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { STORE } from "@/lib/store-config";

export const metadata: Metadata = { title: "ผู้ดูแลระบบ" };

const SECTIONS = [
  { title: "ข้อมูลร้าน", detail: `พิกัดร้าน: ${STORE.coordinates ? "ตั้งค่าแล้ว" : "ยังไม่ได้ระบุ"}` },
  { title: "เมนูและราคา", detail: "ยังไม่มีรายการอาหาร" },
  { title: "พื้นที่จัดส่ง", detail: `รัศมีสูงสุด ${STORE.deliveryRadiusKm} กม. (ต้องระบุพิกัดร้านก่อน)` },
  { title: "PromptPay", detail: "ยังไม่ได้ตั้งค่าบัญชีรับเงิน" },
  { title: "พนักงานและไรเดอร์", detail: "จัดการสิทธิ์ผู้ใช้" },
];

export default async function AdminPage() {
  const auth = await requireRole(["admin"]);
  return (
    <div>
      <PageTitle title="ผู้ดูแลระบบ" subtitle={`จัดการร้าน${STORE.name}`} />
      {!auth.ok ? (
        <AccessDenied reason={auth.reason} />
      ) : (
        <StaffShell ctx={auth.ctx}>
          <div className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <Card key={s.title}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{s.title}</h2>
                  <UnavailableBadge />
                </div>
                <p className="mt-2 text-sm text-stone-500">{s.detail}</p>
              </Card>
            ))}
          </div>
        </StaffShell>
      )}
    </div>
  );
}
