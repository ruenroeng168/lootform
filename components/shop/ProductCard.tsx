import Link from "next/link";
import {
  categoryLabel,
  discountPercent,
  formatTHB,
  totalStock,
  type ShopProduct,
} from "@/lib/shop";

export default function ProductCard({ product }: { product: ShopProduct }) {
  const soldOut = totalStock(product) === 0;
  const discount = discountPercent(product);
  const [primary, secondary] = product.images;

  return (
    <Link href={`/shop/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
        <img
          src={primary ?? "/logo.png"}
          alt={product.name}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${
            secondary ? "group-hover:opacity-0" : ""
          } ${soldOut ? "opacity-50" : ""}`}
        />
        {secondary && (
          <img
            src={secondary}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100"
          />
        )}

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {soldOut && <Badge tone="muted">สินค้าหมด</Badge>}
          {!soldOut && discount > 0 && <Badge tone="sale">-{discount}%</Badge>}
          {!soldOut && product.is_new && <Badge tone="new">NEW</Badge>}
        </div>

        <div className="absolute inset-x-3 bottom-3 translate-y-2 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
          <div className="rounded-[var(--radius-sm)] bg-[var(--foreground)] py-2.5 text-center text-xs font-semibold text-black">
            {soldOut ? "ดูรายละเอียด" : "เลือกไซซ์"}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[11px] tracking-[0.12em] text-[var(--muted-dim)]">
          {categoryLabel(product.category)}
          {product.color_name ? ` · ${product.color_name}` : ""}
        </p>
        <p className="font-display text-sm font-semibold leading-snug group-hover:text-[var(--grade-rare)] transition">
          {product.name}
        </p>
        <p className="flex items-baseline gap-2 font-mono text-sm">
          <span className={discount > 0 ? "text-[var(--grade-legendary)]" : ""}>
            {formatTHB(product.price_thb)}
          </span>
          {discount > 0 && product.compare_at_price_thb && (
            <span className="text-xs text-[var(--muted-dim)] line-through">
              {formatTHB(product.compare_at_price_thb)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

function Badge({ tone, children }: { tone: "new" | "sale" | "muted"; children: React.ReactNode }) {
  const styles = {
    new: "bg-[var(--grade-rare)] text-black",
    sale: "bg-[var(--grade-legendary)] text-black",
    muted: "bg-[var(--surface-raised)] text-[var(--muted)] border border-[var(--border-strong)]",
  }[tone];

  return (
    <span className={`rounded-[var(--radius-sm)] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.1em] ${styles}`}>
      {children}
    </span>
  );
}
