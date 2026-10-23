import Link from "next/link";
import { STORE } from "@/lib/store-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-100 bg-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-6 text-sm text-stone-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-stone-800">{STORE.name}</p>
          <p>
            จ.{STORE.city} · เปิด {STORE.openTime}–{STORE.closeTime} น. ทุกวัน
          </p>
        </div>
        <nav aria-label="สำหรับพนักงาน" className="flex gap-4 text-xs">
          <Link href="/staff/login" className="hover:text-brand-700">
            เข้าสู่ระบบพนักงาน
          </Link>
        </nav>
      </div>
    </footer>
  );
}
