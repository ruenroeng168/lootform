import Link from "next/link";
import { Notice } from "./ui";

export function AccessDenied({
  reason,
}: {
  reason: "not_configured" | "forbidden";
}) {
  if (reason === "not_configured") {
    return (
      <Notice tone="warning" title="ระบบยืนยันตัวตนยังไม่ได้เชื่อมต่อ">
        หน้านี้สำหรับพนักงานเท่านั้น และจะใช้งานได้เมื่อเชื่อมต่อฐานข้อมูล Supabase แล้ว
      </Notice>
    );
  }
  return (
    <Notice tone="warning" title="ไม่มีสิทธิ์เข้าถึงหน้านี้">
      บัญชีของคุณไม่มีสิทธิ์สำหรับหน้านี้ หากคิดว่าไม่ถูกต้องโปรดติดต่อผู้ดูแลระบบ{" "}
      <Link href="/staff/login" className="font-semibold underline">
        กลับไปหน้าเข้าสู่ระบบ
      </Link>
    </Notice>
  );
}
