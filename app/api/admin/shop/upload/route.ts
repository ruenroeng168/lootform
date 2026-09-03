import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/require-admin";

/* =========================================================
   LOOTFORM ADMIN SHOP IMAGE UPLOAD

   Uploads a shop item photo and returns its public URL -- the
   caller (app/admin/shop/page.tsx) then saves that URL onto the
   shop_items row via PATCH /api/admin/shop/items. Mirrors the
   upload half of app/api/admin/topup/settings/upload-qr/route.ts,
   without that route's settings-row side effect.

   BUCKET: shop-images (public)
   MAX: 5 MB
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "shop-images";
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

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request);

    if (!user) {
      return errorResponse(
        authError === "FORBIDDEN" ? "Admin access required" : "Unauthorized",
        authError === "FORBIDDEN" ? 403 : 401
      );
    }

    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return errorResponse("กรุณาแนบไฟล์รูปภาพ");
    }

    const file = fileValue;

    if (file.size <= 0) {
      return errorResponse("ไฟล์รูปภาพว่างเปล่า");
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("รูปภาพต้องมีขนาดไม่เกิน 5 MB");
    }

    if (!VALID_MIME_TYPES.includes(file.type)) {
      return errorResponse("รองรับเฉพาะไฟล์ JPEG, PNG และ WEBP");
    }

    const extension = getFileExtension(file);
    const storagePath = `${Date.now()}-${randomUUID()}.${extension}`;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: file.type,
        cacheControl: "31536000",
        upsert: false,
      });

    if (uploadError) {
      console.error("SHOP IMAGE STORAGE ERROR:", uploadError);
      return errorResponse("ไม่สามารถอัปโหลดรูปภาพได้", 500);
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;

    if (!publicUrl) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return errorResponse("Unable to create image URL", 500);
    }

    return NextResponse.json(
      { success: true, image_url: publicUrl },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("SHOP IMAGE UPLOAD API INTERNAL ERROR:", error);
    return errorResponse(error instanceof Error ? error.message : "Unable to upload image", 500);
  }
}
