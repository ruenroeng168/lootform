import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import ShopBar from "@/components/shop/ShopBar";
import ShopFooter from "@/components/shop/ShopFooter";

/* =========================================================
   STORE LAYOUT — /shop, /shop/[slug], /cart, /checkout, /orders

   Route group only; URLs are unchanged. ShopBar reads search
   params, so it sits behind a Suspense boundary.
========================================================= */

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <Navbar />
      <Suspense fallback={<div className="h-[89px] border-b border-[var(--border)]" />}>
        <ShopBar />
      </Suspense>
      <div className="flex-1">{children}</div>
      <ShopFooter />
    </div>
  );
}
