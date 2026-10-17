import { SIZE_GUIDE } from "@/lib/shop";

export default function SizeTable({ kind = "TOPS" }: { kind?: keyof typeof SIZE_GUIDE }) {
  const rows = SIZE_GUIDE[kind];
  const isPants = kind === "PANTS";

  return (
    <div className="mt-5 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface)] text-left text-xs text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3 font-medium">ไซซ์</th>
            <th className="px-4 py-3 font-medium">{isPants ? "รอบเอว" : "รอบอก"}</th>
            <th className="px-4 py-3 font-medium">ความยาว</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] font-mono">
          {rows.map((row) => (
            <tr key={row.size}>
              <td className="px-4 py-2.5 font-semibold">{row.size}</td>
              <td className="px-4 py-2.5">{row.chest}</td>
              <td className="px-4 py-2.5">{row.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
