import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

/* =========================================================
   LOOTFORM ADMIN SHOP ITEMS (plain, non-random catalog)

   GET    - list all items (active + inactive)
   POST   - create an item
   PATCH  - update an item
   DELETE - remove an item (?id=)

   Mirrors app/api/admin/topup/packages/route.ts's CRUD shape.
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT =
  "id, name, category, description, price_thb, available_sizes, image_url, sort_order, is_active, created_at, updated_at";

function unauthorizedResponse(authError: "UNAUTHORIZED" | "FORBIDDEN") {
  if (authError === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Admin access required" }, { status: 403 });
  }
  return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request);
  if (!user) return unauthorizedResponse(authError!);

  const { data, error } = await supabaseAdmin
    .from("shop_items")
    .select(SELECT)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    console.error("ADMIN SHOP ITEMS GET ERROR:", error);
    return NextResponse.json({ success: false, message: "Unable to load shop items" }, { status: 500 });
  }

  return NextResponse.json({ success: true, items: data ?? [] });
}

function normalizeSizes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((size) => String(size).trim().toUpperCase()).filter(Boolean))
  );
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request);
  if (!user) return unauthorizedResponse(authError!);

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "").trim();
  const description = String(body.description ?? "").trim();
  const priceThb = Number(body.price_thb);
  const availableSizes = normalizeSizes(body.available_sizes);
  const imageUrl = String(body.image_url ?? "").trim();
  const sortOrder = Number.isInteger(Number(body.sort_order)) ? Number(body.sort_order) : 0;

  if (!name) {
    return NextResponse.json({ success: false, message: "กรุณาระบุชื่อสินค้า" }, { status: 400 });
  }

  if (!category) {
    return NextResponse.json({ success: false, message: "กรุณาระบุหมวดหมู่สินค้า" }, { status: 400 });
  }

  if (!Number.isFinite(priceThb) || priceThb <= 0) {
    return NextResponse.json({ success: false, message: "ราคาต้องมากกว่า 0" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("shop_items")
    .insert({
      name,
      category,
      description: description || null,
      price_thb: priceThb,
      available_sizes: availableSizes,
      image_url: imageUrl || null,
      sort_order: sortOrder,
      is_active: true,
    })
    .select(SELECT)
    .single();

  if (error) {
    console.error("ADMIN SHOP ITEMS POST ERROR:", error);
    return NextResponse.json({ success: false, message: "Unable to create shop item" }, { status: 500 });
  }

  return NextResponse.json({ success: true, item: data });
}

export async function PATCH(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request);
  if (!user) return unauthorizedResponse(authError!);

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, message: "Item ID ไม่ถูกต้อง" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) {
      return NextResponse.json({ success: false, message: "กรุณาระบุชื่อสินค้า" }, { status: 400 });
    }
    update.name = name;
  }

  if (body.category !== undefined) {
    const category = String(body.category ?? "").trim();
    if (!category) {
      return NextResponse.json({ success: false, message: "กรุณาระบุหมวดหมู่สินค้า" }, { status: 400 });
    }
    update.category = category;
  }

  if (body.description !== undefined) {
    const description = String(body.description ?? "").trim();
    update.description = description || null;
  }

  if (body.price_thb !== undefined) {
    const priceThb = Number(body.price_thb);
    if (!Number.isFinite(priceThb) || priceThb <= 0) {
      return NextResponse.json({ success: false, message: "ราคาต้องมากกว่า 0" }, { status: 400 });
    }
    update.price_thb = priceThb;
  }

  if (body.available_sizes !== undefined) {
    update.available_sizes = normalizeSizes(body.available_sizes);
  }

  if (body.image_url !== undefined) {
    const imageUrl = String(body.image_url ?? "").trim();
    update.image_url = imageUrl || null;
  }

  if (body.sort_order !== undefined) {
    const sortOrder = Number(body.sort_order);
    update.sort_order = Number.isInteger(sortOrder) ? sortOrder : 0;
  }

  if (body.is_active !== undefined) {
    update.is_active = body.is_active === true;
  }

  const { data, error } = await supabaseAdmin
    .from("shop_items")
    .update(update)
    .eq("id", id)
    .select(SELECT)
    .single();

  if (error) {
    console.error("ADMIN SHOP ITEMS PATCH ERROR:", error);
    return NextResponse.json({ success: false, message: "Unable to update shop item" }, { status: 500 });
  }

  return NextResponse.json({ success: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const { user, error: authError } = await requireAdmin(request);
  if (!user) return unauthorizedResponse(authError!);

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ success: false, message: "Item ID ไม่ถูกต้อง" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("shop_items").delete().eq("id", id);

  if (error) {
    console.error("ADMIN SHOP ITEMS DELETE ERROR:", error);
    return NextResponse.json({ success: false, message: "Unable to delete shop item" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
