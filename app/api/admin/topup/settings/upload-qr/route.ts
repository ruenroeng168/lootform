import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM ADMIN TOP-UP QR UPLOAD

   Mirrors app/api/admin/season/upload-image/route.ts.

   BUCKET: topup-qr (public)
   MAX: 5 MB
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "topup-qr";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function errorResponse(error: string, status = 400, code = "TOPUP_QR_ERROR") {
  return NextResponse.json(
    { ok: false, code, error },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFileExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "webp";
}

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return { ok: false as const, response: errorResponse("Unauthorized", 401, "UNAUTHORIZED") };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return { ok: false as const, response: errorResponse("Unauthorized", 401, "UNAUTHORIZED") };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false as const,
      response: errorResponse("Invalid or expired session", 401, "INVALID_SESSION"),
    };
  }

  const email = (data.user.email ?? "").trim().toLowerCase();

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !adminEmails.includes(email)) {
    return {
      ok: false as const,
      response: errorResponse("Admin access required", 403, "ADMIN_REQUIRED"),
    };
  }

  return { ok: true as const, userId: data.user.id, email };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return errorResponse("QR image is required", 400, "FILE_REQUIRED");
    }

    const file = fileValue;

    if (file.size <= 0) {
      return errorResponse("Image file is empty", 400, "EMPTY_FILE");
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("QR image must not exceed 5 MB", 400, "FILE_TOO_LARGE");
    }

    if (!VALID_MIME_TYPES.includes(file.type)) {
      return errorResponse(
        "Only JPEG, PNG and WEBP images are supported",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from("topup_settings")
      .select("id, qr_image_url, qr_image_path")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError) {
      console.error("TOPUP QR SETTINGS LOAD ERROR:", settingsError);
      return errorResponse(settingsError.message, 500, "SETTINGS_QUERY_FAILED");
    }

    if (!settingsData) {
      return errorResponse("Top-up settings not found", 404, "SETTINGS_NOT_FOUND");
    }

    const extension = getFileExtension(file);
    const storagePath = `qr/${Date.now()}-${randomUUID()}.${extension}`;

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
      console.error("TOPUP QR STORAGE ERROR:", uploadError);
      return errorResponse(uploadError.message, 500, "STORAGE_UPLOAD_FAILED");
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = cleanText(publicUrlData.publicUrl);

    if (!publicUrl) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return errorResponse("Unable to create QR image URL", 500, "PUBLIC_URL_FAILED");
    }

    const { data: updatedSettings, error: updateError } = await supabaseAdmin
      .from("topup_settings")
      .update({
        qr_image_url: publicUrl,
        qr_image_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1)
      .select(
        "id, bank_name, bank_account_name, bank_account_number, qr_image_url, qr_image_path, rate_lt_per_thb, updated_at"
      )
      .single();

    if (updateError) {
      console.error("TOPUP QR DB UPDATE ERROR:", updateError);

      const { error: cleanupError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        console.error("TOPUP QR CLEANUP ERROR:", cleanupError);
      }

      return errorResponse(updateError.message, 500, "SETTINGS_UPDATE_FAILED");
    }

    return NextResponse.json(
      {
        ok: true,
        settings: updatedSettings,
        message: "QR image uploaded successfully.",
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("TOPUP QR API INTERNAL ERROR:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to upload QR image",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}
