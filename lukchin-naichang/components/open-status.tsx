"use client";

import { useEffect, useState } from "react";
import { isOpenAt } from "@/lib/business-hours";
import { STORE } from "@/lib/store-config";

// Computed in the browser so a statically rendered page never shows a stale
// open/closed state. Renders a neutral label until mounted.
export function OpenStatus() {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () =>
      setOpen(isOpenAt(new Date(), STORE.openTime, STORE.closeTime, STORE.timezone));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  if (open === null) {
    return (
      <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
        เวลาทำการ {STORE.openTime}–{STORE.closeTime} น.
      </span>
    );
  }
  return open ? (
    <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
      ● ขณะนี้อยู่ในเวลาทำการ
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
      ● ขณะนี้นอกเวลาทำการ
    </span>
  );
}
