import type { ReactNode } from "react";

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-stone-600">{subtitle}</p> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function UnavailableBadge({ label = "ยังไม่เปิดใช้งาน" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-700">
      {label}
    </span>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning";
  title: string;
  children?: ReactNode;
}) {
  const styles =
    tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-brand-200 bg-brand-50 text-brand-900";
  return (
    <div role="status" className={`rounded-xl border p-4 text-sm ${styles}`}>
      <p className="font-semibold">{title}</p>
      {children ? <div className="mt-1">{children}</div> : null}
    </div>
  );
}
