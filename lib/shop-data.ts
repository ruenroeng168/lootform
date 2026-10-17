import { supabaseAdmin } from "@/lib/supabase-admin";
import { sortVariants, type ShopProduct } from "@/lib/shop";

/* =========================================================
   LOOTFORM SHOP — server-side reads

   Uses the secret key, so import ONLY from Server Components
   and route handlers. store_* tables are service_role-only.
========================================================= */

export const PRODUCT_SELECT = `
  id, slug, name, category, description, price_thb, compare_at_price_thb,
  images, color_name, material, fit, care, is_featured, is_new, sort_order,
  variants:store_product_variants ( id, size, stock )
`;

type ProductRow = Omit<ShopProduct, "variants"> & {
  sort_order: number;
  variants: { id: number; size: string; stock: number }[] | null;
};

export function normalizeProduct(row: ProductRow): ShopProduct {
  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description ?? "",
    price_thb: Number(row.price_thb),
    compare_at_price_thb:
      row.compare_at_price_thb == null ? null : Number(row.compare_at_price_thb),
    images: row.images ?? [],
    color_name: row.color_name,
    material: row.material,
    fit: row.fit,
    care: row.care,
    is_featured: Boolean(row.is_featured),
    is_new: Boolean(row.is_new),
    variants: sortVariants(
      (row.variants ?? []).map((variant) => ({
        id: Number(variant.id),
        size: variant.size,
        stock: Number(variant.stock),
      }))
    ),
  };
}

export async function getActiveProducts(): Promise<ShopProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("store_products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("SHOP PRODUCTS LOAD ERROR:", error);
    throw new Error("Unable to load products");
  }

  return ((data ?? []) as unknown as ProductRow[]).map(normalizeProduct);
}

export async function getActiveProductBySlug(slug: string): Promise<ShopProduct | null> {
  const { data, error } = await supabaseAdmin
    .from("store_products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("SHOP PRODUCT LOAD ERROR:", error);
    throw new Error("Unable to load product");
  }

  return data ? normalizeProduct(data as unknown as ProductRow) : null;
}

/* Bearer-token auth shared by shop route handlers. */
export async function getRequestUser(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

export async function requireShopAdmin(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }

  const email = (user.email ?? "").trim().toLowerCase();

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !adminEmails.includes(email)) {
    return { ok: false as const, status: 403, message: "Admin access required" };
  }

  return { ok: true as const, userId: user.id, email };
}
