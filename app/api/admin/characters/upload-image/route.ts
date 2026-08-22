import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  randomUUID,
} from "crypto";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM
   STEP 10D-2C
   ADMIN CHARACTER PREVIEW IMAGE UPLOAD

   FLOW

   Admin
   ↓
   Upload JPEG / PNG / WEBP
   ↓
   Validate Character
   ↓
   Upload to character-images
   ↓
   Save thumbnail_url + thumbnail_path
   ↓
   character_models

   BUCKET:
   character-images

   MAX:
   5 MB
========================================================= */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   CONFIG
========================================================= */

const BUCKET =
  "character-images";

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const VALID_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/* =========================================================
   TYPES
========================================================= */

type AdminAuthSuccess = {
  ok: true;

  userId: string;

  email: string;
};

type AdminAuthFailure = {
  ok: false;

  response: NextResponse;
};

type AdminAuthResult =
  | AdminAuthSuccess
  | AdminAuthFailure;

type CharacterRow = {
  id: number;

  code: string;

  name: string;

  version: number;

  thumbnail_url:
    | string
    | null;

  thumbnail_path:
    | string
    | null;
};

/* =========================================================
   RESPONSE
========================================================= */

function errorResponse(
  error: string,
  status = 400,
  code = "CHARACTER_IMAGE_ERROR"
) {
  return NextResponse.json(
    {
      ok: false,

      code,

      error,
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

function successResponse(
  data: Record<
    string,
    unknown
  >
) {
  return NextResponse.json(
    {
      ok: true,

      ...data,
    },
    {
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

/* =========================================================
   TEXT
========================================================= */

function cleanText(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

/* =========================================================
   ID
========================================================= */

function parsePositiveInteger(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(
      number
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

/* =========================================================
   SAFE PATH SEGMENT
========================================================= */

function safeSegment(
  value: string
) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]/g,
      "-"
    );
}

/* =========================================================
   FILE EXTENSION
========================================================= */

function getFileExtension(
  file: File
) {
  if (
    file.type ===
    "image/jpeg"
  ) {
    return "jpg";
  }

  if (
    file.type ===
    "image/png"
  ) {
    return "png";
  }

  return "webp";
}

/* =========================================================
   ADMIN AUTH
========================================================= */

async function requireAdmin(
  request: NextRequest
): Promise<AdminAuthResult> {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return {
      ok: false,

      response:
        errorResponse(
          "Unauthorized",
          401,
          "UNAUTHORIZED"
        ),
    };
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    return {
      ok: false,

      response:
        errorResponse(
          "Unauthorized",
          401,
          "UNAUTHORIZED"
        ),
    };
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .auth
      .getUser(
        token
      );

  if (
    error ||
    !data.user
  ) {
    return {
      ok: false,

      response:
        errorResponse(
          "Invalid or expired session",
          401,
          "INVALID_SESSION"
        ),
    };
  }

  const email =
    (
      data.user.email ??
      ""
    )
      .trim()
      .toLowerCase();

  const adminEmails =
    (
      process.env
        .ADMIN_EMAILS ??
      ""
    )
      .split(",")
      .map(
        (item) =>
          item
            .trim()
            .toLowerCase()
      )
      .filter(Boolean);

  if (
    !email ||
    !adminEmails.includes(
      email
    )
  ) {
    return {
      ok: false,

      response:
        errorResponse(
          "Admin access required",
          403,
          "ADMIN_REQUIRED"
        ),
    };
  }

  return {
    ok: true,

    userId:
      data.user.id,

    email,
  };
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    /* =====================================================
       1. ADMIN AUTH
    ===================================================== */

    const auth =
      await requireAdmin(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    /* =====================================================
       2. FORM DATA
    ===================================================== */

    const formData =
      await request.formData();

    const fileValue =
      formData.get(
        "file"
      );

    const characterId =
      parsePositiveInteger(
        formData.get(
          "character_id"
        )
      );

    /* =====================================================
       3. CHARACTER ID
    ===================================================== */

    if (!characterId) {
      return errorResponse(
        "Invalid character_id",
        400,
        "INVALID_CHARACTER_ID"
      );
    }

    /* =====================================================
       4. FILE
    ===================================================== */

    if (
      !(
        fileValue instanceof
        File
      )
    ) {
      return errorResponse(
        "Character preview image is required",
        400,
        "FILE_REQUIRED"
      );
    }

    const file =
      fileValue;

    if (
      file.size <= 0
    ) {
      return errorResponse(
        "Image file is empty",
        400,
        "EMPTY_FILE"
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return errorResponse(
        "Character preview image must not exceed 5 MB",
        400,
        "FILE_TOO_LARGE"
      );
    }

    if (
      !VALID_MIME_TYPES.includes(
        file.type
      )
    ) {
      return errorResponse(
        "Only JPEG, PNG and WEBP images are supported",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    /* =====================================================
       5. LOAD CHARACTER
    ===================================================== */

    const {
      data:
        characterData,

      error:
        characterError,
    } =
      await supabaseAdmin
        .from(
          "character_models"
        )
        .select(`
          id,
          code,
          name,
          version,
          thumbnail_url,
          thumbnail_path
        `)
        .eq(
          "id",
          characterId
        )
        .maybeSingle();

    if (
      characterError
    ) {
      console.error(
        "CHARACTER IMAGE LOAD ERROR:",
        characterError
      );

      return errorResponse(
        characterError.message,
        500,
        "CHARACTER_QUERY_FAILED"
      );
    }

    if (
      !characterData
    ) {
      return errorResponse(
        "Character not found",
        404,
        "CHARACTER_NOT_FOUND"
      );
    }

    const character =
      characterData as CharacterRow;

    /* =====================================================
       6. STORAGE PATH

       Each upload gets a new unique path.

       Example:

       characters/1/LF-BASE-001/v1/preview/
       1780000000000-uuid.webp
    ===================================================== */

    const extension =
      getFileExtension(
        file
      );

    const safeCode =
      safeSegment(
        character.code
      );

    const storagePath =
      [
        "characters",

        String(
          character.id
        ),

        safeCode,

        `v${character.version}`,

        "preview",

        `${Date.now()}-${randomUUID()}.${extension}`,
      ].join("/");

    /* =====================================================
       7. FILE BYTES
    ===================================================== */

    const arrayBuffer =
      await file.arrayBuffer();

    const fileBytes =
      new Uint8Array(
        arrayBuffer
      );

    /* =====================================================
       8. UPLOAD TO STORAGE
    ===================================================== */

    const {
      error:
        uploadError,
    } =
      await supabaseAdmin
        .storage
        .from(
          BUCKET
        )
        .upload(
          storagePath,
          fileBytes,
          {
            contentType:
              file.type,

            cacheControl:
              "31536000",

            upsert:
              false,
          }
        );

    if (
      uploadError
    ) {
      console.error(
        "CHARACTER IMAGE STORAGE ERROR:",
        uploadError
      );

      return errorResponse(
        uploadError.message,
        500,
        "STORAGE_UPLOAD_FAILED"
      );
    }

    /* =====================================================
       9. PUBLIC URL
    ===================================================== */

    const {
      data:
        publicUrlData,
    } =
      supabaseAdmin
        .storage
        .from(
          BUCKET
        )
        .getPublicUrl(
          storagePath
        );

    const publicUrl =
      cleanText(
        publicUrlData
          .publicUrl
      );

    if (!publicUrl) {
      /*
        Only remove the NEW file.

        No database reference exists yet.
      */

      await supabaseAdmin
        .storage
        .from(
          BUCKET
        )
        .remove([
          storagePath,
        ]);

      return errorResponse(
        "Unable to create Character image URL",
        500,
        "PUBLIC_URL_FAILED"
      );
    }

    /* =====================================================
       10. UPDATE CHARACTER DATABASE
    ===================================================== */

    const {
      data:
        updatedCharacter,

      error:
        updateError,
    } =
      await supabaseAdmin
        .from(
          "character_models"
        )
        .update({
          thumbnail_url:
            publicUrl,

          thumbnail_path:
            storagePath,
        })
        .eq(
          "id",
          character.id
        )
        .select(`
          id,
          code,
          name,
          description,
          version,
          thumbnail_url,
          thumbnail_path,
          model_url,
          model_path,
          is_active,
          is_default,
          sort_order,
          created_at,
          updated_at
        `)
        .single();

    if (
      updateError
    ) {
      console.error(
        "CHARACTER IMAGE DB UPDATE ERROR:",
        updateError
      );

      /*
        DB update failed.

        The newly uploaded file is not referenced,
        so it is safe to remove.
      */

      const {
        error:
          cleanupError,
      } =
        await supabaseAdmin
          .storage
          .from(
            BUCKET
          )
          .remove([
            storagePath,
          ]);

      if (
        cleanupError
      ) {
        console.error(
          "CHARACTER IMAGE CLEANUP ERROR:",
          cleanupError
        );
      }

      return errorResponse(
        updateError.message,
        500,
        "CHARACTER_UPDATE_FAILED"
      );
    }

    /* =====================================================
       11. IMPORTANT

       We deliberately DO NOT delete:

       character.thumbnail_path

       when replacing an image.

       Every upload receives a new version-safe URL.

       This prevents:
       - stale CDN references
       - broken historical links
       - accidental deletion of an asset still in use

       Storage cleanup can be handled later by a dedicated
       Admin cleanup system.
    ===================================================== */

    /* =====================================================
       12. SUCCESS
    ===================================================== */

    return successResponse({
      character:
        updatedCharacter,

      upload: {
        bucket:
          BUCKET,

        path:
          storagePath,

        public_url:
          publicUrl,

        original_filename:
          file.name,

        size:
          file.size,

        content_type:
          file.type,
      },

      previous_version: {
        thumbnail_url:
          character
            .thumbnail_url,

        thumbnail_path:
          character
            .thumbnail_path,

        preserved:
          Boolean(
            character
              .thumbnail_path
          ),
      },

      message:
        `${character.name} preview image uploaded successfully.`,
    });
  } catch (
    error
  ) {
    console.error(
      "CHARACTER IMAGE API INTERNAL ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to upload Character preview image",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}