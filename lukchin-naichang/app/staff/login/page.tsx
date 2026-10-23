import type { Metadata } from "next";
import { Card, Notice, PageTitle } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบพนักงาน" };

export default function StaffLoginPage() {
  const configured = isSupabaseConfigured();
  return (
    <div className="mx-auto max-w-sm">
      <PageTitle title="เข้าสู่ระบบพนักงาน" subtitle="สำหรับพนักงานร้าน ไรเดอร์ และผู้ดูแลระบบ" />
      {!configured ? (
        <div className="mb-4">
          <Notice tone="warning" title="ระบบยืนยันตัวตนยังไม่ได้เชื่อมต่อ">
            ยังไม่ได้ตั้งค่าฐานข้อมูล Supabase จึงยังเข้าสู่ระบบไม่ได้
          </Notice>
        </div>
      ) : null}
      <Card>
        <LoginForm disabled={!configured} />
      </Card>
      <p className="mt-4 text-center text-xs text-stone-500">
        บัญชีพนักงานสร้างโดยผู้ดูแลระบบเท่านั้น ไม่มีการสมัครสมาชิกด้วยตนเอง
      </p>
    </div>
  );
}
