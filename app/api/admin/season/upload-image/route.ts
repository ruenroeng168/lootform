import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM
   ADMIN SEASON HERO IMAGE UPLOAD

   Mirrors app/api/admin/characters/upload-image/route.ts.

   BUCKET: season-hero-images
   MAX: 5 MB
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "season-hero-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

type AdminAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

type SeasonRow = {
  id: number;
  season_code: string;
  hero_image_url: string | null;
  hero_image_path: string | null;
};

function errorResponse(error: string, status = 400, code = "SEASON_IMAGE_ERROR") {
  return NextResponse.json(
    { ok: false, code, error },
    { status, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function successResponse(data: Record<string, unknown>) {
  return NextResponse.json(
    { ok: true, ...data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInteger(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function safeSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
}

function getFileExtension(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "webp";
}

async function requireAdmin(request: NextRequest): Promise<AdminAuthResult> {
  const authorization = request.headers.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return { ok: false, response: errorResponse("Unauthorized", 401, "UNAUTHORIZED") };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return { ok: false, response: errorResponse("Unauthorized", 401, "UNAUTHORIZED") };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
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
      ok: false,
      response: errorResponse("Admin access required", 403, "ADMIN_REQUIRED"),
    };
  }

  return { ok: true, userId: data.user.id, email };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const fileValue = formData.get("file");
    const seasonId = parsePositiveInteger(formData.get("season_id"));

    if (!seasonId) {
      return errorResponse("Invalid season_id", 400, "INVALID_SEASON_ID");
    }

    if (!(fileValue instanceof File)) {
      return errorResponse("Hero image is required", 400, "FILE_REQUIRED");
    }

    const file = fileValue;

    if (file.size <= 0) {
      return errorResponse("Image file is empty", 400, "EMPTY_FILE");
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse("Hero image must not exceed 5 MB", 400, "FILE_TOO_LARGE");
    }

    if (!VALID_MIME_TYPES.includes(file.type)) {
      return errorResponse(
        "Only JPEG, PNG and WEBP images are supported",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    const { data: seasonData, error: seasonError } = await supabaseAdmin
      .from("season_settings")
      .select("id, season_code, hero_image_url, hero_image_path")
      .eq("id", seasonId)
      .maybeSingle();

    if (seasonError) {
      console.error("SEASON HERO IMAGE LOAD ERROR:", seasonError);
      return errorResponse(seasonError.message, 500, "SEASON_QUERY_FAILED");
    }

    if (!seasonData) {
      return errorResponse("Season not found", 404, "SEASON_NOT_FOUND");
    }

    const season = seasonData as SeasonRow;

    const extension = getFileExtension(file);
    const safeCode = safeSegment(season.season_code);

    const storagePath = [
      "seasons",
      String(season.id),
      safeCode,
      "hero",
      `${Date.now()}-${randomUUID()}.${extension}`,
    ].join("/");

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
      console.error("SEASON HERO IMAGE STORAGE ERROR:", uploadError);
      return errorResponse(uploadError.message, 500, "STORAGE_UPLOAD_FAILED");
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = cleanText(publicUrlData.publicUrl);

    if (!publicUrl) {
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
      return errorResponse("Unable to create hero image URL", 500, "PUBLIC_URL_FAILED");
    }

    const { data: updatedSeason, error: updateError } = await supabaseAdmin
      .from("season_settings")
      .update({
        hero_image_url: publicUrl,
        hero_image_path: storagePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", season.id)
      .select(
        `
        id, season_code, season_name, product_name, craft_cost,
        common_rate, rare_rate, epic_rate, legendary_rate, is_active,
        start_at, end_at, hero_image_url, hero_image_path,
        hero_model_url, hero_model_path, created_at, updated_at
        `
      )
      .single();

    if (updateError) {
      console.error("SEASON HERO IMAGE DB UPDATE ERROR:", updateError);

      const { error: cleanupError } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([storagePath]);

      if (cleanupError) {
        console.error("SEASON HERO IMAGE CLEANUP ERROR:", cleanupError);
      }

      return errorResponse(updateError.message, 500, "SEASON_UPDATE_FAILED");
    }

    /*
      We deliberately do NOT delete the previous hero_image_path here —
      same immutable-asset rule as the Character image upload route.
    */

    return successResponse({
      season: updatedSeason,
      upload: {
        bucket: BUCKET,
        path: storagePath,
        public_url: publicUrl,
        original_filename: file.name,
        size: file.size,
        content_type: file.type,
      },
      previous_version: {
        hero_image_url: season.hero_image_url,
        hero_image_path: season.hero_image_path,
        preserved: Boolean(season.hero_image_path),
      },
      message: "Season hero image uploaded successfully.",
    });
  } catch (error) {
    console.error("SEASON HERO IMAGE API INTERNAL ERROR:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to upload hero image",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}
