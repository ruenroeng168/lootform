import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM PLAIN SHOP ORDER REQUEST

   Logged-in user picks a shop_items row directly (no grade roll)
   and uploads a payment slip. This ONLY creates a PENDING order +
   stores the slip -- nothing ships until an Admin approves via
   shop_order_review_atomic() (see /api/admin/shop/orders/review).

   BUCKET: shop-order-slips (PRIVATE)
   MAX: 5 MB
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "shop-order-slips";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function errorResponse(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function getFileExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "webp";
}

function generateReference() {
  const now = new Date();

  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, "");

  const randomPart = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

  return `SH-${datePart}-${timePart}-${randomPart}`;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const token = authorization.slice(7).trim();
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return errorResponse("Invalid or expired session", 401);
    }

    const user = userData.user;

    const formData = await request.formData();
    const shopItemId = Number(formData.get("shop_item_id"));
    const size = formData.get("size");
    const quantity = Number(formData.get("quantity") ?? 1);
    const shippingAddressId = Number(formData.get("shipping_address_id"));
    const fileValue = formData.get("file");

    if (!Number.isInteger(shopItemId) || shopItemId <= 0) {
      return errorResponse("กรุณาเลือกสินค้า");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return errorResponse("จำนวนสินค้าไม่ถูกต้อง");
    }

    if (!Number.isInteger(shippingAddressId) || shippingAddressId <= 0) {
      return errorResponse("กรุณาเลือกที่อยู่จัดส่ง");
    }

    if (!(fileValue instanceof File)) {
      return errorResponse("กรุณาแนบสลิปการโอนเงิน");
    }

    const file = fileValue;

    if (file.size <= 0) {
      return errorResponse("ไฟล์สลิปว่างเปล่า");
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("สลิปต้องมีขนาดไม่เกิน 5 MB");
    }

    if (!VALID_MIME_TYPES.includes(file.type)) {
      return errorResponse("รองรับเฉพาะไฟล์ JPEG, PNG และ WEBP");
    }

    const [{ data: item, error: itemError }, { data: address, error: addressError }] = await Promise.all([
      supabaseAdmin
        .from("shop_items")
        .select("id, name, price_thb, available_sizes, is_active")
        .eq("id", shopItemId)
        .maybeSingle(),
      supabaseAdmin
        .from("shipping_addresses")
        .select("id, user_id")
        .eq("id", shippingAddressId)
        .maybeSingle(),
    ]);

    if (itemError) {
      console.error("SHOP ORDER ITEM LOAD ERROR:", itemError);
      return errorResponse("Unable to load product", 500);
    }

    if (!item || !item.is_active) {
      return errorResponse("สินค้านี้ไม่พร้อมจำหน่าย");
    }

    const sizeValue = typeof size === "string" && size.trim() ? size.trim() : null;
    const availableSizes: string[] = Array.isArray(item.available_sizes) ? item.available_sizes : [];

    if (availableSizes.length > 0 && (!sizeValue || !availableSizes.includes(sizeValue))) {
      return errorResponse("กรุณาเลือกไซซ์ให้ถูกต้อง");
    }

    if (addressError) {
      console.error("SHOP ORDER ADDRESS LOAD ERROR:", addressError);
      return errorResponse("Unable to load shipping address", 500);
    }

    if (!address || address.user_id !== user.id) {
      return errorResponse("ที่อยู่จัดส่งไม่ถูกต้อง");
    }

    const priceThb = Number(item.price_thb);
    const totalThb = priceThb * quantity;

    const extension = getFileExtension(file);
    const storagePath = `${user.id}/${Date.now()}-${randomUUID()}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        cacheControl: "0",
        upsert: false,
      });

    if (uploadError) {
      console.error("SHOP ORDER SLIP STORAGE ERROR:", uploadError);
      return errorResponse("ไม่สามารถอัปโหลดสลิปได้", 500);
    }

    const reference = generateReference();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("shop_orders")
      .insert({
        reference,
        user_id: user.id,
        shop_item_id: item.id,
        item_name_snapshot: item.name,
        price_thb_snapshot: priceThb,
        size: sizeValue,
        quantity,
        total_thb: totalThb,
        shipping_address_id: address.id,
        status: "PENDING",
        slip_image_path: storagePath,
      })
      .select("id, reference, item_name_snapshot, total_thb, status, created_at")
      .single();

    if (orderError) {
      console.error("SHOP ORDER INSERT ERROR:", orderError);

      const { error: cleanupError } = await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);

      if (cleanupError) {
        console.error("SHOP ORDER SLIP CLEANUP ERROR:", cleanupError);
      }

      return errorResponse("Unable to create order", 500);
    }

    return NextResponse.json(
      { success: true, order },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("SHOP ORDER REQUEST API INTERNAL ERROR:", error);
    return errorResponse(error instanceof Error ? error.message : "Unable to submit order", 500);
  }
}
