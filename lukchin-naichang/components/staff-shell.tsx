import type { ReactNode } from "react";
import { signOut } from "@/app/staff/actions";
import type { StaffContext } from "@/lib/auth";

const ROLE_LABEL = { admin: "ผู้ดูแลระบบ", staff: "พนักงานร้าน", rider: "ไรเดอร์" } as const;

export function StaffShell({ ctx, children }: { ctx: StaffContext; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          {ctx.displayName ?? ctx.email ?? "ผู้ใช้"} · <strong>{ROLE_LABEL[ctx.role]}</strong>
        </span>
        <form action={signOut}>
          <button type="submit" className="rounded-full px-3 py-1 font-medium text-brand-700 hover:bg-white">
            ออกจากระบบ
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
