import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM
   ADMIN SEASON HERO 3D MODEL SIGNED UPLOAD

   Mirrors app/api/admin/characters/upload-model/route.ts.

   POST  - prepare a signed upload URL
   PATCH - verify the uploaded file exists, save model_url/model_path

   BUCKET: season-hero-models
   MAX: 50 MB
========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "season-hero-models";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const VALID_CONTENT_TYPES = ["model/gltf-binary", "application/octet-stream"];

type AdminAuthResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

type SeasonRow = {
  id: number;
  season_code: string;
  hero_model_url: string | null;
  hero_model_path: string | null;
};

function errorResponse(error: string, status = 400, code = "SEASON_MODEL_ERROR") {
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

function safeFileBaseName(value: string) {
  const withoutExtension = value.replace(/\.glb$/i, "");
  const safe = withoutExtension
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "season-hero";
}

function resolveContentType(value: unknown) {
  const type = cleanText(value).toLowerCase();
  if (VALID_CONTENT_TYPES.includes(type)) return type;
  if (!type) return "model/gltf-binary";
  return null;
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

async function loadSeason(seasonId: number) {
  const { data, error } = await supabaseAdmin
    .from("season_settings")
    .select("id, season_code, hero_model_url, hero_model_path")
    .eq("id", seasonId)
    .maybeSingle();

  if (error) throw error;
  return data as SeasonRow | null;
}

function getSeasonModelPrefix(season: SeasonRow) {
  const safeCode = safeSegment(season.season_code);
  return ["seasons", String(season.id), safeCode, "hero-models"].join("/");
}

async function storageFileExists(path: string) {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash <= 0 || lastSlash === path.length - 1) return false;

  const directory = path.slice(0, lastSlash);
  const fileName = path.slice(lastSlash + 1);

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(directory, { limit: 100, search: fileName });

  if (error) {
    console.error("SEASON HERO MODEL STORAGE VERIFY ERROR:", error);
    throw error;
  }

  return (data ?? []).some((file) => file.name === fileName);
}

/* =========================================================
   POST - PREPARE SIGNED UPLOAD
========================================================= */

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, "INVALID_JSON");
    }

    const seasonId = parsePositiveInteger(body.season_id);
    if (!seasonId) {
      return errorResponse("Invalid season_id", 400, "INVALID_SEASON_ID");
    }

    let season: SeasonRow | null;
    try {
      season = await loadSeason(seasonId);
    } catch (error) {
      console.error("SEASON HERO MODEL LOAD ERROR:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Unable to load Season",
        500,
        "SEASON_QUERY_FAILED"
      );
    }

    if (!season) {
      return errorResponse("Season not found", 404, "SEASON_NOT_FOUND");
    }

    const fileName = cleanText(body.file_name);
    if (!fileName) {
      return errorResponse("GLB file name is required", 400, "FILE_NAME_REQUIRED");
    }

    if (!fileName.toLowerCase().endsWith(".glb")) {
      return errorResponse("Only .glb models are supported", 400, "INVALID_FILE_EXTENSION");
    }

    const fileSize = Number(body.file_size);
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return errorResponse("Invalid GLB file size", 400, "INVALID_FILE_SIZE");
    }

    if (fileSize > MAX_FILE_SIZE) {
      return errorResponse("Hero model must not exceed 50 MB", 400, "FILE_TOO_LARGE");
    }

    const contentType = resolveContentType(body.file_type);
    if (!contentType) {
      return errorResponse("Unsupported GLB content type", 400, "INVALID_CONTENT_TYPE");
    }

    const prefix = getSeasonModelPrefix(season);
    const baseName = safeFileBaseName(fileName);
    const storagePath = [prefix, `${Date.now()}-${randomUUID()}-${baseName}.glb`].join("/");

    const { data: signedUpload, error: signedUploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (signedUploadError || !signedUpload) {
      console.error("SEASON HERO MODEL SIGNED UPLOAD ERROR:", signedUploadError);
      return errorResponse(
        signedUploadError?.message ?? "Unable to create Signed Upload URL",
        500,
        "SIGNED_UPLOAD_FAILED"
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = cleanText(publicUrlData.publicUrl);

    if (!publicUrl) {
      return errorResponse("Unable to generate hero model public URL", 500, "PUBLIC_URL_FAILED");
    }

    return successResponse({
      season: { id: season.id, season_code: season.season_code },
      upload: {
        bucket: BUCKET,
        path: storagePath,
        token: signedUpload.token,
        signed_url: signedUpload.signedUrl,
        public_url: publicUrl,
        original_filename: fileName,
        size: fileSize,
        content_type: contentType,
      },
      message: "Hero model upload prepared.",
    });
  } catch (error) {
    console.error("SEASON HERO MODEL PREPARE INTERNAL ERROR:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to prepare hero model upload",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}

/* =========================================================
   PATCH - FINALIZE MODEL UPLOAD
========================================================= */

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400, "INVALID_JSON");
    }

    const seasonId = parsePositiveInteger(body.season_id);
    if (!seasonId) {
      return errorResponse("Invalid season_id", 400, "INVALID_SEASON_ID");
    }

    const modelPath = cleanText(body.model_path);
    if (!modelPath) {
      return errorResponse("model_path is required", 400, "MODEL_PATH_REQUIRED");
    }

    if (!modelPath.toLowerCase().endsWith(".glb")) {
      return errorResponse("Only .glb models are supported", 400, "INVALID_MODEL_PATH");
    }

    let season: SeasonRow | null;
    try {
      season = await loadSeason(seasonId);
    } catch (error) {
      console.error("SEASON HERO MODEL FINALIZE LOAD ERROR:", error);
      return errorResponse(
        error instanceof Error ? error.message : "Unable to load Season",
        500,
        "SEASON_QUERY_FAILED"
      );
    }

    if (!season) {
      return errorResponse("Season not found", 404, "SEASON_NOT_FOUND");
    }

    const expectedPrefix = `${getSeasonModelPrefix(season)}/`;

    if (!modelPath.startsWith(expectedPrefix)) {
      return errorResponse(
        "Model path does not belong to this Season",
        403,
        "MODEL_PATH_MISMATCH"
      );
    }

    let exists: boolean;
    try {
      exists = await storageFileExists(modelPath);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Unable to verify uploaded model",
        500,
        "STORAGE_VERIFY_FAILED"
      );
    }

    if (!exists) {
      return errorResponse(
        "Uploaded hero model was not found in Storage",
        409,
        "MODEL_UPLOAD_NOT_FOUND"
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(modelPath);
    const publicUrl = cleanText(publicUrlData.publicUrl);

    if (!publicUrl) {
      return errorResponse("Unable to create hero model public URL", 500, "PUBLIC_URL_FAILED");
    }

    const previousModelUrl = season.hero_model_url;
    const previousModelPath = season.hero_model_path;

    const { data: updatedSeason, error: updateError } = await supabaseAdmin
      .from("season_settings")
      .update({
        hero_model_url: publicUrl,
        hero_model_path: modelPath,
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
      console.error("SEASON HERO MODEL DB UPDATE ERROR:", updateError);
      return errorResponse(updateError.message, 500, "SEASON_UPDATE_FAILED");
    }

    /*
      Immutable-asset rule: we deliberately do NOT delete
      previousModelPath. Same reasoning as the Character GLB route.
    */

    return successResponse({
      season: updatedSeason,
      upload: { bucket: BUCKET, path: modelPath, public_url: publicUrl },
      previous_version: {
        hero_model_url: previousModelUrl,
        hero_model_path: previousModelPath,
        preserved: Boolean(previousModelPath),
      },
      message: "Season hero model imported successfully.",
    });
  } catch (error) {
    console.error("SEASON HERO MODEL FINALIZE INTERNAL ERROR:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to finalize hero model upload",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}
