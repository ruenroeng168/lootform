import Link from "next/link";
import { FREE_SHIPPING_MIN_THB, SHOP_CATEGORIES, formatTHB } from "@/lib/shop";

export function TrustBar() {
  const items = [
    { title: "ส่งฟรีทั่วไทย", body: `เมื่อช้อปครบ ${formatTHB(FREE_SHIPPING_MIN_THB)} · จัดส่ง 2–4 วันทำการ` },
    { title: "เปลี่ยนไซซ์ได้ 7 วัน", body: "สินค้ายังไม่ผ่านการใช้งานและป้ายยังอยู่ครบ" },
    { title: "ชำระเงินปลอดภัย", body: "โอนผ่านธนาคาร / QR พร้อมเพย์ ตรวจสอบสลิปทุกรายการ" },
    { title: "ของแท้จาก LOOTFORM", body: "ผลิตและควบคุมคุณภาพโดยทีม LOOTFORM โดยตรง" },
  ];

  return (
    <section className="border-y border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border)]">
        {items.map((item) => (
          <div key={item.title} className="bg-[var(--surface)] px-5 py-6 sm:px-8">
            <p className="font-display text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ShopFooter() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg)]">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="font-display text-lg font-bold tracking-[0.2em]">LOOTFORM</p>
          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
            Streetwear จากโลกดิจิทัลสู่ของจริง ออกแบบในกรุงเทพฯ ผลิตจำนวนจำกัดทุกคอลเลกชัน
          </p>
        </div>

        <FooterColumn title="ช้อป">
          {SHOP_CATEGORIES.map((category) => (
            <FooterLink key={category.code} href={`/shop?category=${category.code}`}>
              {category.label}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title="ช่วยเหลือ">
          <FooterLink href="/orders">ติดตามคำสั่งซื้อ</FooterLink>
          <FooterLink href="/shop#size-guide">ตารางไซซ์</FooterLink>
          <FooterLink href="/shop#faq">คำถามที่พบบ่อย</FooterLink>
        </FooterColumn>

        <FooterColumn title="LOOTFORM">
          <FooterLink href="/catalog">Drop Catalog</FooterLink>
          <FooterLink href="/craft">Craft</FooterLink>
          <FooterLink href="/">หน้าแรก</FooterLink>
        </FooterColumn>
      </div>

      <div className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-[var(--muted-dim)] sm:px-6">
          <p>© {new Date().getFullYear()} LOOTFORM. All rights reserved.</p>
          <p className="font-mono tracking-[0.15em]">DIGITAL LOOT · PHYSICAL FORM</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.2em] text-[var(--muted-dim)]">{title}</p>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-[var(--muted)] transition hover:text-[var(--foreground)]">
        {children}
      </Link>
    </li>
  );
}
