import Link from "next/link";
import { STORE } from "@/lib/store-config";

const NAV = [
  { href: "/", label: "หน้าแรก" },
  { href: "/menu", label: "เมนู" },
  { href: "/cart", label: "ตะกร้า" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-brand-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-600 text-lg font-bold text-white"
          >
            นช
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-base font-bold text-brand-700">
              {STORE.name}
            </span>
            <span className="hidden truncate text-[11px] tracking-wide text-stone-500 min-[400px]:block">
              {STORE.nameEn}
            </span>
          </span>
        </Link>
        <nav aria-label="เมนูหลัก" className="flex shrink-0 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-2 py-2 font-medium text-stone-700 sm:px-3 hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
