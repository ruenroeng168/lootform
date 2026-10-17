import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductCard from "@/components/shop/ProductCard";
import ProductDetail from "@/components/shop/ProductDetail";
import { getActiveProductBySlug, getActiveProducts } from "@/lib/shop-data";
import { formatTHB } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug).catch(() => null);

  if (!product) return { title: "ไม่พบสินค้า — LOOTFORM STORE" };

  return {
    title: `${product.name}${product.color_name ? ` · ${product.color_name}` : ""} — LOOTFORM STORE`,
    description: `${formatTHB(product.price_thb)} · ${product.description.slice(0, 140)}`,
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.images[0]?.startsWith("https://") ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);

  if (!product) notFound();

  const related = (await getActiveProducts())
    .filter((item) => item.id !== product.id)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category))
    .slice(0, 4);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <ProductDetail product={product} />

      {related.length > 0 && (
        <section className="mt-24">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--grade-rare)]">YOU MAY ALSO LIKE</p>
          <h2 className="mt-2 text-2xl font-bold">สินค้าที่คุณอาจชอบ</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
