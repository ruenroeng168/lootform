import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireShopAdmin } from "@/lib/shop-data";

/* =========================================================
   LOOTFORM ADMIN SHOP PRODUCT IMAGE UPLOAD

   BUCKET: store-products (PUBLIC)
   MAX: 5 MB, JPEG/PNG/WEBP
   Returns the public URL; the product form adds it to images[].
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "store-products";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const auth = await requireShopAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ success: false, message: "กรุณาเลือกไฟล์รูปภาพ" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ success: false, message: "รูปต้องไม่เกิน 5 MB" }, { status: 400 });
  }

  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json(
      { success: false, message: "รองรับเฉพาะ JPEG, PNG และ WEBP" },
      { status: 400 }
    );
  }

  const path = `products/${Date.now()}-${randomUUID()}.${extension}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    console.error("ADMIN SHOP IMAGE UPLOAD ERROR:", error);
    return NextResponse.json({ success: false, message: "อัปโหลดรูปไม่สำเร็จ" }, { status: 500 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

  return NextResponse.json({ success: true, url: data.publicUrl });
}
