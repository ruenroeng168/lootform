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
   STEP 10D-2D
   ADMIN CHARACTER GLB SIGNED UPLOAD

   POST
   - Validate Admin
   - Validate Character
   - Validate GLB metadata
   - Create unique immutable Storage path
   - Create Signed Upload Token

   Browser
   - uploadToSignedUrl(...)

   PATCH
   - Validate Admin
   - Validate Character
   - Validate Storage path
   - Confirm uploaded file exists
   - Save model_url + model_path

   BUCKET:
   character-models

   MAX:
   100 MB
========================================================= */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   CONFIG
========================================================= */

const BUCKET =
  "character-models";

const MAX_FILE_SIZE =
  100 * 1024 * 1024;

const VALID_CONTENT_TYPES = [
  "model/gltf-binary",
  "application/octet-stream",
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

  model_url:
    | string
    | null;

  model_path:
    | string
    | null;
};

/* =========================================================
   RESPONSE
========================================================= */

function errorResponse(
  error: string,
  status = 400,
  code = "CHARACTER_MODEL_ERROR"
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
   NUMBER
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
   SAFE PATH
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
   FILE NAME
========================================================= */

function safeFileBaseName(
  value: string
) {
  const withoutExtension =
    value.replace(
      /\.glb$/i,
      ""
    );

  const safe =
    withoutExtension
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return safe ||
    "character";
}

/* =========================================================
   MIME
========================================================= */

function resolveContentType(
  value: unknown
) {
  const type =
    cleanText(value)
      .toLowerCase();

  if (
    VALID_CONTENT_TYPES.includes(
      type
    )
  ) {
    return type;
  }

  /*
    Some browsers report GLB as an empty MIME type.

    We know the file extension must be .glb,
    so use the standard GLB MIME type.
  */

  if (!type) {
    return "model/gltf-binary";
  }

  return null;
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
   LOAD CHARACTER
========================================================= */

async function loadCharacter(
  characterId: number
) {
  const {
    data,
    error,
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
        model_url,
        model_path
      `)
      .eq(
        "id",
        characterId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data as
      | CharacterRow
      | null
  );
}

/* =========================================================
   EXPECTED CHARACTER PATH PREFIX
========================================================= */

function getCharacterModelPrefix(
  character:
    CharacterRow
) {
  const safeCode =
    safeSegment(
      character.code
    );

  return [
    "characters",

    String(
      character.id
    ),

    safeCode,

    `v${character.version}`,

    "models",
  ].join("/");
}

/* =========================================================
   STORAGE FILE EXISTS
========================================================= */

async function storageFileExists(
  path: string
) {
  const lastSlash =
    path.lastIndexOf(
      "/"
    );

  if (
    lastSlash <= 0 ||
    lastSlash ===
      path.length - 1
  ) {
    return false;
  }

  const directory =
    path.slice(
      0,
      lastSlash
    );

  const fileName =
    path.slice(
      lastSlash + 1
    );

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .storage
      .from(
        BUCKET
      )
      .list(
        directory,
        {
          limit:
            100,

          search:
            fileName,
        }
      );

  if (error) {
    console.error(
      "CHARACTER MODEL STORAGE VERIFY ERROR:",
      error
    );

    throw error;
  }

  return (
    data ?? []
  ).some(
    (file) =>
      file.name ===
      fileName
  );
}

/* =========================================================
   POST
   PREPARE SIGNED UPLOAD
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    /* =====================================================
       1. ADMIN
    ===================================================== */

    const auth =
      await requireAdmin(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    /* =====================================================
       2. BODY
    ===================================================== */

    let body:
      Record<string, unknown>;

    try {
      body =
        await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON body",
        400,
        "INVALID_JSON"
      );
    }

    /* =====================================================
       3. CHARACTER
    ===================================================== */

    const characterId =
      parsePositiveInteger(
        body.character_id
      );

    if (!characterId) {
      return errorResponse(
        "Invalid character_id",
        400,
        "INVALID_CHARACTER_ID"
      );
    }

    let character:
      CharacterRow | null;

    try {
      character =
        await loadCharacter(
          characterId
        );
    } catch (
      error
    ) {
      console.error(
        "CHARACTER MODEL LOAD ERROR:",
        error
      );

      return errorResponse(
        error instanceof Error
          ? error.message
          : "Unable to load Character",
        500,
        "CHARACTER_QUERY_FAILED"
      );
    }

    if (!character) {
      return errorResponse(
        "Character not found",
        404,
        "CHARACTER_NOT_FOUND"
      );
    }

    /* =====================================================
       4. FILE NAME
    ===================================================== */

    const fileName =
      cleanText(
        body.file_name
      );

    if (!fileName) {
      return errorResponse(
        "GLB file name is required",
        400,
        "FILE_NAME_REQUIRED"
      );
    }

    if (
      !fileName
        .toLowerCase()
        .endsWith(
          ".glb"
        )
    ) {
      return errorResponse(
        "Only .glb Character models are supported",
        400,
        "INVALID_FILE_EXTENSION"
      );
    }

    /* =====================================================
       5. FILE SIZE
    ===================================================== */

    const fileSize =
      Number(
        body.file_size
      );

    if (
      !Number.isFinite(
        fileSize
      ) ||
      fileSize <= 0
    ) {
      return errorResponse(
        "Invalid GLB file size",
        400,
        "INVALID_FILE_SIZE"
      );
    }

    if (
      fileSize >
      MAX_FILE_SIZE
    ) {
      return errorResponse(
        "Character GLB must not exceed 100 MB",
        400,
        "FILE_TOO_LARGE"
      );
    }

    /* =====================================================
       6. CONTENT TYPE
    ===================================================== */

    const contentType =
      resolveContentType(
        body.file_type
      );

    if (!contentType) {
      return errorResponse(
        "Unsupported GLB content type",
        400,
        "INVALID_CONTENT_TYPE"
      );
    }

    /* =====================================================
       7. VERSION-SAFE IMMUTABLE STORAGE PATH

       Example:

       characters/1/LF-BASE-001/v1/models/
       1780000000000-uuid-lootform-base.glb
    ===================================================== */

    const prefix =
      getCharacterModelPrefix(
        character
      );

    const baseName =
      safeFileBaseName(
        fileName
      );

    const storagePath =
      [
        prefix,

        `${Date.now()}-${randomUUID()}-${baseName}.glb`,
      ].join("/");

    /* =====================================================
       8. SIGNED UPLOAD TOKEN
    ===================================================== */

    const {
      data:
        signedUpload,

      error:
        signedUploadError,
    } =
      await supabaseAdmin
        .storage
        .from(
          BUCKET
        )
        .createSignedUploadUrl(
          storagePath,
          {
            upsert:
              false,
          }
        );

    if (
      signedUploadError ||
      !signedUpload
    ) {
      console.error(
        "CHARACTER SIGNED UPLOAD ERROR:",
        signedUploadError
      );

      return errorResponse(
        signedUploadError
          ?.message ??
          "Unable to create Signed Upload URL",
        500,
        "SIGNED_UPLOAD_FAILED"
      );
    }

    /* =====================================================
       9. PUBLIC URL

       The bucket is PUBLIC.

       We can calculate the final public URL now.
       The database is NOT updated yet.

       PATCH will finalize only after Browser upload.
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
      return errorResponse(
        "Unable to generate Character model public URL",
        500,
        "PUBLIC_URL_FAILED"
      );
    }

    /* =====================================================
       10. SUCCESS
    ===================================================== */

    return successResponse({
      character: {
        id:
          character.id,

        code:
          character.code,

        name:
          character.name,

        version:
          character.version,
      },

      upload: {
        bucket:
          BUCKET,

        path:
          storagePath,

        token:
          signedUpload.token,

        signed_url:
          signedUpload.signedUrl,

        public_url:
          publicUrl,

        original_filename:
          fileName,

        size:
          fileSize,

        content_type:
          contentType,
      },

      message:
        "Character GLB upload prepared.",
    });
  } catch (
    error
  ) {
    console.error(
      "CHARACTER MODEL PREPARE INTERNAL ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to prepare Character GLB upload",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}

/* =========================================================
   PATCH
   FINALIZE MODEL UPLOAD
========================================================= */

export async function PATCH(
  request: NextRequest
) {
  try {
    /* =====================================================
       1. ADMIN
    ===================================================== */

    const auth =
      await requireAdmin(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    /* =====================================================
       2. BODY
    ===================================================== */

    let body:
      Record<string, unknown>;

    try {
      body =
        await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON body",
        400,
        "INVALID_JSON"
      );
    }

    /* =====================================================
       3. CHARACTER ID
    ===================================================== */

    const characterId =
      parsePositiveInteger(
        body.character_id
      );

    if (!characterId) {
      return errorResponse(
        "Invalid character_id",
        400,
        "INVALID_CHARACTER_ID"
      );
    }

    /* =====================================================
       4. MODEL PATH
    ===================================================== */

    const modelPath =
      cleanText(
        body.model_path
      );

    if (!modelPath) {
      return errorResponse(
        "model_path is required",
        400,
        "MODEL_PATH_REQUIRED"
      );
    }

    if (
      !modelPath
        .toLowerCase()
        .endsWith(
          ".glb"
        )
    ) {
      return errorResponse(
        "Only .glb Character models are supported",
        400,
        "INVALID_MODEL_PATH"
      );
    }

    /* =====================================================
       5. LOAD CHARACTER
    ===================================================== */

    let character:
      CharacterRow | null;

    try {
      character =
        await loadCharacter(
          characterId
        );
    } catch (
      error
    ) {
      console.error(
        "CHARACTER FINALIZE LOAD ERROR:",
        error
      );

      return errorResponse(
        error instanceof Error
          ? error.message
          : "Unable to load Character",
        500,
        "CHARACTER_QUERY_FAILED"
      );
    }

    if (!character) {
      return errorResponse(
        "Character not found",
        404,
        "CHARACTER_NOT_FOUND"
      );
    }

    /* =====================================================
       6. PATH OWNERSHIP

       Client cannot finalize a model belonging to
       another Character / Version.
    ===================================================== */

    const expectedPrefix =
      `${getCharacterModelPrefix(
        character
      )}/`;

    if (
      !modelPath.startsWith(
        expectedPrefix
      )
    ) {
      return errorResponse(
        "Model path does not belong to this Character version",
        403,
        "MODEL_PATH_MISMATCH"
      );
    }

    /* =====================================================
       7. VERIFY FILE EXISTS IN STORAGE
    ===================================================== */

    let exists:
      boolean;

    try {
      exists =
        await storageFileExists(
          modelPath
        );
    } catch (
      error
    ) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "Unable to verify uploaded Character GLB",
        500,
        "STORAGE_VERIFY_FAILED"
      );
    }

    if (!exists) {
      return errorResponse(
        "Uploaded Character GLB was not found in Storage",
        409,
        "MODEL_UPLOAD_NOT_FOUND"
      );
    }

    /* =====================================================
       8. GENERATE TRUSTED PUBLIC URL

       Do NOT trust model_url supplied by Browser.

       Server derives the URL from the verified model_path.
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
          modelPath
        );

    const publicUrl =
      cleanText(
        publicUrlData
          .publicUrl
      );

    if (!publicUrl) {
      return errorResponse(
        "Unable to create Character model public URL",
        500,
        "PUBLIC_URL_FAILED"
      );
    }

    /* =====================================================
       9. SAVE DATABASE
    ===================================================== */

    const previousModelUrl =
      character.model_url;

    const previousModelPath =
      character.model_path;

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
          model_url:
            publicUrl,

          model_path:
            modelPath,
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
        "CHARACTER MODEL DB UPDATE ERROR:",
        updateError
      );

      /*
        IMPORTANT:

        We do NOT automatically delete the newly uploaded
        GLB here.

        The upload succeeded and the file is valid.

        If the DB temporarily fails, keeping the GLB is
        safer than deleting potentially recoverable data.
      */

      return errorResponse(
        updateError.message,
        500,
        "CHARACTER_MODEL_UPDATE_FAILED"
      );
    }

    /* =====================================================
       10. IMMUTABLE ASSET RULE

       We deliberately DO NOT delete previousModelPath.

       Example:

       Character v1
       model-A.glb
            ↓
       Admin imports new GLB
            ↓
       Character v1
       model-B.glb

       Storage keeps:
       model-A.glb
       model-B.glb

       This avoids breaking:
       - cached clients
       - old references
       - future historical snapshots

       Cleanup should be a separate intentional Admin tool.
    ===================================================== */

    /* =====================================================
       11. SUCCESS
    ===================================================== */

    return successResponse({
      character:
        updatedCharacter,

      upload: {
        bucket:
          BUCKET,

        path:
          modelPath,

        public_url:
          publicUrl,
      },

      previous_version: {
        model_url:
          previousModelUrl,

        model_path:
          previousModelPath,

        preserved:
          Boolean(
            previousModelPath
          ),
      },

      message:
        `${character.name} GLB imported successfully.`,
    });
  } catch (
    error
  ) {
    console.error(
      "CHARACTER MODEL FINALIZE INTERNAL ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to finalize Character GLB upload",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}