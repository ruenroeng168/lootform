import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRequestUser } from "@/lib/shop-data";
import {
  FREE_SHIPPING_MIN_THB,
  MAX_CART_LINES,
  MAX_QTY_PER_LINE,
  SHIPPING_FEE_THB,
} from "@/lib/shop";

/* =========================================================
   LOOTFORM SHOP ORDERS

   POST  multipart/form-data
         payload: JSON { request_id, items:[{variant_id, quantity}],
                         address:{...}, note }
         file:    payment slip (JPEG/PNG/WEBP, max 5 MB)
         Creates a PENDING order through store_place_order_atomic(),
         which prices the cart from the database and reserves stock.
         Nothing is marked paid here — an Admin reviews the slip.

   GET   The signed-in customer's orders, newest first.

   BUCKET: store-slips (PRIVATE)
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "store-slips";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RPC_ERRORS: Record<string, string> = {
  LOOTFORM_SHOP_EMPTY_CART: "ตะกร้าสินค้าว่าง",
  LOOTFORM_SHOP_TOO_MANY_LINES: "สินค้าในตะกร้ามากเกินไป",
  LOOTFORM_SHOP_INVALID_QUANTITY: "จำนวนสินค้าไม่ถูกต้อง",
  LOOTFORM_SHOP_PRODUCT_UNAVAILABLE: "มีสินค้าบางรายการไม่พร้อมจำหน่ายแล้ว กรุณาตรวจสอบตะกร้า",
  LOOTFORM_SHOP_OUT_OF_STOCK: "มีสินค้าบางไซซ์สต็อกไม่พอ กรุณาตรวจสอบตะกร้า",
  LOOTFORM_SHOP_REQUEST_CONFLICT: "คำสั่งซื้อซ้ำ กรุณาลองใหม่",
};

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
  const datePart = now.toISOString().slice(2, 10).replace(/-/g, "");
  const randomPart = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `LF-${datePart}-${randomPart}`;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

type OrderPayload = {
  request_id?: unknown;
  items?: unknown;
  address?: Record<string, unknown>;
  note?: unknown;
};

export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;

  try {
    const user = await getRequestUser(request);
    if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนสั่งซื้อ", 401);

    const formData = await request.formData();
    const payloadValue = formData.get("payload");
    const fileValue = formData.get("file");

    let payload: OrderPayload;
    try {
      payload = JSON.parse(typeof payloadValue === "string" ? payloadValue : "");
    } catch {
      return errorResponse("ข้อมูลคำสั่งซื้อไม่ถูกต้อง");
    }

    const requestId = typeof payload.request_id === "string" ? payload.request_id : "";
    if (!UUID_PATTERN.test(requestId)) {
      return errorResponse("ข้อมูลคำสั่งซื้อไม่ถูกต้อง");
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return errorResponse("ตะกร้าสินค้าว่าง");
    }

    if (payload.items.length > MAX_CART_LINES) {
      return errorResponse("สินค้าในตะกร้ามากเกินไป");
    }

    const items = payload.items.map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      return { variant_id: Number(item.variant_id), quantity: Number(item.quantity) };
    });

    const invalidItem = items.some(
      (item) =>
        !Number.isInteger(item.variant_id) ||
        item.variant_id <= 0 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_QTY_PER_LINE
    );

    if (invalidItem) return errorResponse("จำนวนสินค้าไม่ถูกต้อง");

    const address = payload.address ?? {};
    const recipientName = cleanText(address.recipient_name, 120);
    const phone = cleanText(address.phone, 20).replace(/[^\d+]/g, "");
    const addressLine = cleanText(address.address_line, 300);
    const subdistrict = cleanText(address.subdistrict, 100);
    const district = cleanText(address.district, 100);
    const province = cleanText(address.province, 100);
    const postalCode = cleanText(address.postal_code, 10);
    const note = cleanText(payload.note, 500);

    if (!recipientName || !addressLine || !province) {
      return errorResponse("กรุณากรอกชื่อผู้รับและที่อยู่ให้ครบถ้วน");
    }

    if (!/^\+?\d{9,15}$/.test(phone)) {
      return errorResponse("เบอร์โทรศัพท์ไม่ถูกต้อง");
    }

    if (!/^\d{5}$/.test(postalCode)) {
      return errorResponse("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก");
    }

    if (!(fileValue instanceof File) || fileValue.size <= 0) {
      return errorResponse("กรุณาแนบสลิปการโอนเงิน");
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return errorResponse("สลิปต้องมีขนาดไม่เกิน 5 MB");
    }

    if (!VALID_MIME_TYPES.includes(fileValue.type)) {
      return errorResponse("รองรับเฉพาะไฟล์ JPEG, PNG และ WEBP");
    }

    const storagePath = `${user.id}/${Date.now()}-${randomUUID()}.${getFileExtension(fileValue)}`;
    const fileBytes = new Uint8Array(await fileValue.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: fileValue.type,
        cacheControl: "0",
        upsert: false,
      });

    if (uploadError) {
      console.error("SHOP SLIP STORAGE ERROR:", uploadError);
      return errorResponse("ไม่สามารถอัปโหลดสลิปได้", 500);
    }

    uploadedPath = storagePath;

    const { data, error } = await supabaseAdmin.rpc("store_place_order_atomic", {
      p_user_id: user.id,
      p_request_id: requestId,
      p_reference: generateReference(),
      p_items: items,
      p_recipient_name: recipientName,
      p_phone: phone,
      p_address_line: addressLine,
      p_subdistrict: subdistrict || null,
      p_district: district || null,
      p_province: province,
      p_postal_code: postalCode,
      p_note: note || null,
      p_slip_image_path: storagePath,
      p_shipping_fee_thb: SHIPPING_FEE_THB,
      p_free_shipping_min_thb: FREE_SHIPPING_MIN_THB,
    });

    if (error) {
      const code = Object.keys(RPC_ERRORS).find((key) => error.message?.includes(key));

      if (!code) console.error("SHOP PLACE ORDER RPC ERROR:", error);

      await removeSlip(storagePath);
      uploadedPath = null;

      return errorResponse(code ? RPC_ERRORS[code] : "ไม่สามารถสร้างคำสั่งซื้อได้", code ? 409 : 500);
    }

    const result = data as { order: { reference: string; slip_image_path: string | null }; replayed: boolean };

    // A retried request returns the original order — drop the duplicate slip.
    if (result.replayed && result.order.slip_image_path !== storagePath) {
      await removeSlip(storagePath);
    }

    uploadedPath = null;

    return NextResponse.json(
      { success: true, reference: result.order.reference },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("SHOP ORDER API INTERNAL ERROR:", error);
    if (uploadedPath) await removeSlip(uploadedPath);
    return errorResponse("ไม่สามารถสร้างคำสั่งซื้อได้", 500);
  }
}

async function removeSlip(path: string) {
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) console.error("SHOP SLIP CLEANUP ERROR:", error);
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return errorResponse("Unauthorized", 401);

  const { data, error } = await supabaseAdmin
    .from("store_orders")
    .select(
      `id, reference, status, subtotal_thb, shipping_fee_thb, total_thb,
       recipient_name, phone, address_line, subdistrict, district, province,
       postal_code, note, tracking_carrier, tracking_number, cancel_reason,
       created_at, paid_at, shipped_at, delivered_at,
       items:store_order_items ( id, product_name, product_slug, size, image_url,
                                unit_price_thb, quantity, line_total_thb )`
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("SHOP ORDERS GET ERROR:", error);
    return errorResponse("Unable to load orders", 500);
  }

  return NextResponse.json(
    { success: true, orders: data ?? [] },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
