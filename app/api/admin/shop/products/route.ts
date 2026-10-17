import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { normalizeProduct, PRODUCT_SELECT, requireShopAdmin } from "@/lib/shop-data";
import { SHOP_CATEGORIES } from "@/lib/shop";

/* =========================================================
   LOOTFORM ADMIN SHOP PRODUCTS

   GET     all products (active + hidden) with variants
   POST    create   { ...product, variants:[{size, stock}] }
   PATCH   update   { id, ...product, variants:[{size, stock}] }
           Sizes missing from the list are removed; order history
           keeps its own name/size/price snapshot.
   DELETE  ?id=     permanently remove (prefer hiding via is_active)
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORY_CODES: string[] = SHOP_CATEGORIES.map((category) => category.code);

function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || null;
}

type VariantInput = { size: string; stock: number };

function parseProduct(body: Record<string, unknown>) {
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const category = typeof body.category === "string" ? body.category : "";
  const price = Number(body.price_thb);
  const compareRaw = body.compare_at_price_thb;
  const compare =
    compareRaw === null || compareRaw === undefined || compareRaw === "" ? null : Number(compareRaw);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Slug ต้องเป็น a-z, 0-9 และขีดกลาง เช่น core-tee-black" };
  }
  if (!name) return { error: "กรุณากรอกชื่อสินค้า" };
  if (!CATEGORY_CODES.includes(category)) return { error: "หมวดหมู่ไม่ถูกต้อง" };
  if (!Number.isInteger(price) || price <= 0) return { error: "ราคาต้องเป็นจำนวนเต็มมากกว่า 0" };
  if (compare !== null && (!Number.isInteger(compare) || compare <= price)) {
    return { error: "ราคาก่อนลดต้องมากกว่าราคาขาย (หรือเว้นว่าง)" };
  }

  const images = Array.isArray(body.images)
    ? body.images
        .filter((url): url is string => typeof url === "string")
        .map((url) => url.trim())
        .filter((url) => url.startsWith("/") || url.startsWith("https://"))
        .slice(0, 8)
    : [];

  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    return { error: "กรุณาเพิ่มอย่างน้อย 1 ไซซ์" };
  }

  const variants: VariantInput[] = [];
  const seen = new Set<string>();

  for (const raw of body.variants) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const size = typeof item.size === "string" ? item.size.trim().toUpperCase().slice(0, 12) : "";
    const stock = Number(item.stock);

    if (!size) return { error: "ไซซ์ห้ามว่าง" };
    if (seen.has(size)) return { error: `ไซซ์ ${size} ซ้ำ` };
    if (!Number.isInteger(stock) || stock < 0) return { error: `สต็อกไซซ์ ${size} ไม่ถูกต้อง` };

    seen.add(size);
    variants.push({ size, stock });
  }

  return {
    product: {
      slug,
      name,
      category,
      description: typeof body.description === "string" ? body.description.trim().slice(0, 3000) : "",
      price_thb: price,
      compare_at_price_thb: compare,
      images,
      color_name: optionalText(body.color_name, 60),
      material: optionalText(body.material, 200),
      fit: optionalText(body.fit, 200),
      care: optionalText(body.care, 300),
      is_active: body.is_active !== false,
      is_featured: body.is_featured === true,
      is_new: body.is_new === true,
      sort_order: Number.isInteger(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    },
    variants,
  };
}

async function syncVariants(productId: number, variants: VariantInput[]) {
  const { data: existing, error: loadError } = await supabaseAdmin
    .from("shop_product_variants")
    .select("id, size")
    .eq("product_id", productId);

  if (loadError) throw loadError;

  const keep = new Set(variants.map((variant) => variant.size));
  const removeIds = (existing ?? []).filter((row) => !keep.has(row.size)).map((row) => row.id);

  if (removeIds.length > 0) {
    const { error } = await supabaseAdmin.from("shop_product_variants").delete().in("id", removeIds);
    if (error) throw error;
  }

  const { error: upsertError } = await supabaseAdmin.from("shop_product_variants").upsert(
    variants.map((variant) => ({
      product_id: productId,
      size: variant.size,
      stock: variant.stock,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "product_id,size" }
  );

  if (upsertError) throw upsertError;
}

async function loadProduct(id: number) {
  const { data, error } = await supabaseAdmin
    .from("shop_products")
    .select(`${PRODUCT_SELECT}, is_active`)
    .eq("id", id)
    .single();

  if (error) throw error;

  return {
    ...normalizeProduct(data as unknown as Parameters<typeof normalizeProduct>[0]),
    is_active: Boolean((data as { is_active: boolean }).is_active),
    sort_order: Number((data as { sort_order: number }).sort_order),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireShopAdmin(request);
  if (!auth.ok) return fail(auth.message, auth.status);

  const { data, error } = await supabaseAdmin
    .from("shop_products")
    .select(`${PRODUCT_SELECT}, is_active`)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("ADMIN SHOP PRODUCTS GET ERROR:", error);
    return fail("Unable to load products", 500);
  }

  const products = (data ?? []).map((row) => ({
    ...normalizeProduct(row as unknown as Parameters<typeof normalizeProduct>[0]),
    is_active: Boolean((row as { is_active: boolean }).is_active),
    sort_order: Number((row as { sort_order: number }).sort_order),
  }));

  return NextResponse.json({ success: true, products });
}

export async function POST(request: NextRequest) {
  const auth = await requireShopAdmin(request);
  if (!auth.ok) return fail(auth.message, auth.status);

  const parsed = parseProduct(await request.json());
  if ("error" in parsed) return fail(parsed.error as string);

  const { data, error } = await supabaseAdmin
    .from("shop_products")
    .insert(parsed.product)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return fail("Slug นี้ถูกใช้แล้ว");
    console.error("ADMIN SHOP PRODUCT CREATE ERROR:", error);
    return fail("Unable to create product", 500);
  }

  try {
    await syncVariants(data.id, parsed.variants);
    return NextResponse.json({ success: true, product: await loadProduct(data.id) });
  } catch (variantError) {
    console.error("ADMIN SHOP VARIANT SYNC ERROR:", variantError);
    return fail("สร้างสินค้าแล้ว แต่บันทึกไซซ์ไม่สำเร็จ กรุณาแก้ไขอีกครั้ง", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireShopAdmin(request);
  if (!auth.ok) return fail(auth.message, auth.status);

  const body = await request.json();
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid product id");

  const parsed = parseProduct(body);
  if ("error" in parsed) return fail(parsed.error as string);

  const { error } = await supabaseAdmin
    .from("shop_products")
    .update({ ...parsed.product, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return fail("Slug นี้ถูกใช้แล้ว");
    console.error("ADMIN SHOP PRODUCT UPDATE ERROR:", error);
    return fail("Unable to update product", 500);
  }

  try {
    await syncVariants(id, parsed.variants);
    return NextResponse.json({ success: true, product: await loadProduct(id) });
  } catch (variantError) {
    console.error("ADMIN SHOP VARIANT SYNC ERROR:", variantError);
    return fail("บันทึกไซซ์ไม่สำเร็จ", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireShopAdmin(request);
  if (!auth.ok) return fail(auth.message, auth.status);

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return fail("Invalid product id");

  const { error } = await supabaseAdmin.from("shop_products").delete().eq("id", id);

  if (error) {
    console.error("ADMIN SHOP PRODUCT DELETE ERROR:", error);
    return fail("Unable to delete product", 500);
  }

  return NextResponse.json({ success: true });
}
