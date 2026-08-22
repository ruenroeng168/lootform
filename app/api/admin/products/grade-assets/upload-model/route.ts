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
   RUNTIME
========================================================= */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type AdminAuthResult =
  | {
      ok: true;

      email: string;

      userId: string;
    }
  | {
      ok: false;

      response: NextResponse;
    };

/* =========================================================
   CONFIG
========================================================= */

const BUCKET =
  "product-models";

const MAX_FILE_SIZE =
  50 * 1024 * 1024;

const VALID_GRADES: Grade[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

const VALID_MIME_TYPES = [
  "model/gltf-binary",
  "application/octet-stream",
];

/* =========================================================
   RESPONSE
========================================================= */

function jsonError(
  message: string,
  status = 400,
  code = "GRADE_MODEL_ERROR"
) {
  return NextResponse.json(
    {
      success: false,

      code,

      message,
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
   GRADE
========================================================= */

function normalizeGrade(
  value: unknown
): Grade | null {
  const grade =
    cleanText(value)
      .toUpperCase() as Grade;

  if (
    !VALID_GRADES.includes(
      grade
    )
  ) {
    return null;
  }

  return grade;
}

/* =========================================================
   SAFE STORAGE SEGMENT
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
        jsonError(
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
        jsonError(
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
    await supabaseAdmin.auth.getUser(
      token
    );

  if (
    error ||
    !data.user
  ) {
    return {
      ok: false,

      response:
        jsonError(
          "Invalid session",
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
        jsonError(
          "Admin access required",
          403,
          "ADMIN_REQUIRED"
        ),
    };
  }

  return {
    ok: true,

    email,

    userId:
      data.user.id,
  };
}

/* =========================================================
   LOAD + VERIFY PRODUCT / DESIGN
========================================================= */

async function loadCatalogIdentity(
  productId: number,
  designId: number
) {
  const {
    data:
      product,

    error:
      productError,
  } =
    await supabaseAdmin
      .from(
        "products"
      )
      .select(
        `
        id,
        code,
        name
        `
      )
      .eq(
        "id",
        productId
      )
      .maybeSingle();

  if (
    productError
  ) {
    throw new Error(
      productError.message
    );
  }

  if (!product) {
    return {
      product:
        null,

      design:
        null,
    };
  }

  const {
    data:
      design,

    error:
      designError,
  } =
    await supabaseAdmin
      .from(
        "product_designs"
      )
      .select(
        `
        id,
        product_id,
        design_code,
        name
        `
      )
      .eq(
        "id",
        designId
      )
      .eq(
        "product_id",
        productId
      )
      .maybeSingle();

  if (
    designError
  ) {
    throw new Error(
      designError.message
    );
  }

  return {
    product,

    design:
      design ??
      null,
  };
}

/* =========================================================
   POST
   PREPARE SIGNED UPLOAD

   Client sends JSON:

   {
     product_id: 1,
     design_id: 1,
     grade: "EPIC",
     file_name: "epic.glb",
     file_size: 24155584,
     file_type: "model/gltf-binary"
   }

   Server returns:

   {
     path,
     token,
     signed_url,
     public_url
   }

   Browser then calls:

   supabase.storage
     .from("product-models")
     .uploadToSignedUrl(
       path,
       token,
       file
     )
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

    const body =
      await request.json();

    const productId =
      Number(
        body?.product_id
      );

    const designId =
      Number(
        body?.design_id
      );

    const grade =
      normalizeGrade(
        body?.grade
      );

    const fileName =
      cleanText(
        body?.file_name
      );

    const fileType =
      cleanText(
        body?.file_type
      );

    const fileSize =
      Number(
        body?.file_size
      );

    /* =====================================================
       3. IDS
    ===================================================== */

    if (
      !Number.isInteger(
        productId
      ) ||
      productId <= 0
    ) {
      return jsonError(
        "Invalid product_id",
        400,
        "INVALID_PRODUCT_ID"
      );
    }

    if (
      !Number.isInteger(
        designId
      ) ||
      designId <= 0
    ) {
      return jsonError(
        "Invalid design_id",
        400,
        "INVALID_DESIGN_ID"
      );
    }

    if (!grade) {
      return jsonError(
        "Invalid grade",
        400,
        "INVALID_GRADE"
      );
    }

    /* =====================================================
       4. FILE
    ===================================================== */

    if (!fileName) {
      return jsonError(
        "file_name is required",
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
      return jsonError(
        "Only .glb files are supported",
        400,
        "INVALID_FILE_EXTENSION"
      );
    }

    if (
      !Number.isFinite(
        fileSize
      ) ||
      fileSize <= 0
    ) {
      return jsonError(
        "Invalid file_size",
        400,
        "INVALID_FILE_SIZE"
      );
    }

    if (
      fileSize >
      MAX_FILE_SIZE
    ) {
      return jsonError(
        "GLB must not exceed 50 MB",
        400,
        "FILE_TOO_LARGE"
      );
    }

    /*
      Some browsers can return an empty MIME type for GLB.
      We allow:
      - model/gltf-binary
      - application/octet-stream
      - empty MIME
    */

    if (
      fileType &&
      !VALID_MIME_TYPES.includes(
        fileType
      )
    ) {
      return jsonError(
        "Invalid GLB content type",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    /* =====================================================
       5. PRODUCT / DESIGN
    ===================================================== */

    const {
      product,
      design,
    } =
      await loadCatalogIdentity(
        productId,
        designId
      );

    if (!product) {
      return jsonError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND"
      );
    }

    if (!design) {
      return jsonError(
        "Design not found or does not belong to Product",
        404,
        "DESIGN_NOT_FOUND"
      );
    }

    /* =====================================================
       6. ENSURE GRADE ASSET ROW
    ===================================================== */

    const {
      error:
        ensureError,
    } =
      await supabaseAdmin
        .from(
          "product_design_grade_assets"
        )
        .upsert(
          {
            design_id:
              designId,

            grade,
          },
          {
            onConflict:
              "design_id,grade",

            ignoreDuplicates:
              true,
          }
        );

    if (
      ensureError
    ) {
      console.error(
        "GRADE MODEL ENSURE ROW ERROR:",
        ensureError
      );

      return jsonError(
        ensureError.message,
        500,
        "GRADE_ASSET_PREPARE_FAILED"
      );
    }

    /* =====================================================
       7. STORAGE PATH

       product-models/
       products/
       {productId}/
       {designCode}/
       grades/
       {GRADE}/
       timestamp-uuid.glb
    ===================================================== */

    const designCode =
      safeSegment(
        design.design_code
      );

    const storagePath =
      [
        "products",
        String(
          productId
        ),
        designCode,
        "grades",
        grade,
        `${Date.now()}-${randomUUID()}.glb`,
      ].join("/");

    /* =====================================================
       8. SIGNED UPLOAD
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
          storagePath
        );

    if (
      signedUploadError ||
      !signedUpload
    ) {
      console.error(
        "GRADE MODEL SIGNED UPLOAD ERROR:",
        signedUploadError
      );

      return jsonError(
        signedUploadError
          ?.message ??
          "Unable to create signed upload",
        500,
        "SIGNED_UPLOAD_FAILED"
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
      publicUrlData
        .publicUrl;

    if (!publicUrl) {
      return jsonError(
        "Unable to create public model URL",
        500,
        "PUBLIC_URL_FAILED"
      );
    }

    /* =====================================================
       10. CURRENT ASSET

       Do NOT delete old GLB yet.

       At this point the new GLB has not actually been
       uploaded by browser yet.
    ===================================================== */

    const {
      data:
        currentAsset,

      error:
        currentAssetError,
    } =
      await supabaseAdmin
        .from(
          "product_design_grade_assets"
        )
        .select(
          `
          id,
          design_id,
          grade,
          model_url,
          model_path
          `
        )
        .eq(
          "design_id",
          designId
        )
        .eq(
          "grade",
          grade
        )
        .maybeSingle();

    if (
      currentAssetError
    ) {
      return jsonError(
        currentAssetError.message,
        500,
        "GRADE_ASSET_QUERY_FAILED"
      );
    }

    /* =====================================================
       11. SUCCESS
    ===================================================== */

    return NextResponse.json(
      {
        success:
          true,

        admin: {
          email:
            auth.email,
        },

        product: {
          id:
            product.id,

          code:
            product.code,

          name:
            product.name,
        },

        design: {
          id:
            design.id,

          design_code:
            design.design_code,

          name:
            design.name,
        },

        grade,

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

          max_size:
            MAX_FILE_SIZE,

          requested_size:
            fileSize,
        },

        previous: {
          model_url:
            currentAsset
              ?.model_url ??
            null,

          model_path:
            currentAsset
              ?.model_path ??
            null,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "GRADE MODEL PREPARE API ERROR:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to prepare Grade model upload",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}

/* =========================================================
   PATCH
   FINALIZE GLB UPLOAD

   Browser calls this AFTER uploadToSignedUrl succeeds.

   Client sends:

   {
     product_id: 1,
     design_id: 1,
     grade: "EPIC",
     model_url: "...",
     model_path: "products/1/D01/grades/EPIC/xxx.glb"
   }

   Server:
   1. verifies Product + Design
   2. verifies expected Storage path
   3. updates Grade Asset
   4. removes previous GLB
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

    const body =
      await request.json();

    const productId =
      Number(
        body?.product_id
      );

    const designId =
      Number(
        body?.design_id
      );

    const grade =
      normalizeGrade(
        body?.grade
      );

    const modelUrl =
      cleanText(
        body?.model_url
      );

    const modelPath =
      cleanText(
        body?.model_path
      );

    /* =====================================================
       3. VALIDATION
    ===================================================== */

    if (
      !Number.isInteger(
        productId
      ) ||
      productId <= 0
    ) {
      return jsonError(
        "Invalid product_id",
        400,
        "INVALID_PRODUCT_ID"
      );
    }

    if (
      !Number.isInteger(
        designId
      ) ||
      designId <= 0
    ) {
      return jsonError(
        "Invalid design_id",
        400,
        "INVALID_DESIGN_ID"
      );
    }

    if (!grade) {
      return jsonError(
        "Invalid grade",
        400,
        "INVALID_GRADE"
      );
    }

    if (!modelUrl) {
      return jsonError(
        "model_url is required",
        400,
        "MODEL_URL_REQUIRED"
      );
    }

    if (!modelPath) {
      return jsonError(
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
      return jsonError(
        "Invalid model_path",
        400,
        "INVALID_MODEL_PATH"
      );
    }

    /* =====================================================
       4. PRODUCT / DESIGN
    ===================================================== */

    const {
      product,
      design,
    } =
      await loadCatalogIdentity(
        productId,
        designId
      );

    if (!product) {
      return jsonError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND"
      );
    }

    if (!design) {
      return jsonError(
        "Design not found or does not belong to Product",
        404,
        "DESIGN_NOT_FOUND"
      );
    }

    /* =====================================================
       5. VERIFY STORAGE PATH

       Prevent Admin client from writing some unrelated GLB
       URL/path into this Grade Asset.
    ===================================================== */

    const designCode =
      safeSegment(
        design.design_code
      );

    const expectedPrefix =
      [
        "products",
        String(
          productId
        ),
        designCode,
        "grades",
        grade,
      ].join("/") +
      "/";

    if (
      !modelPath.startsWith(
        expectedPrefix
      )
    ) {
      return jsonError(
        "Model path does not match Product / Design / Grade",
        400,
        "MODEL_PATH_MISMATCH"
      );
    }

    /* =====================================================
       6. CURRENT ROW
    ===================================================== */

    const {
      data:
        previousAsset,

      error:
        previousAssetError,
    } =
      await supabaseAdmin
        .from(
          "product_design_grade_assets"
        )
        .select(
          `
          id,
          model_url,
          model_path
          `
        )
        .eq(
          "design_id",
          designId
        )
        .eq(
          "grade",
          grade
        )
        .maybeSingle();

    if (
      previousAssetError
    ) {
      return jsonError(
        previousAssetError.message,
        500,
        "GRADE_ASSET_QUERY_FAILED"
      );
    }

    /* =====================================================
       7. UPSERT DB
    ===================================================== */

    const {
      data:
        updatedAsset,

      error:
        updateError,
    } =
      await supabaseAdmin
        .from(
          "product_design_grade_assets"
        )
        .upsert(
          {
            design_id:
              designId,

            grade,

            model_url:
              modelUrl,

            model_path:
              modelPath,
          },
          {
            onConflict:
              "design_id,grade",
          }
        )
        .select(
          `
          id,
          design_id,
          grade,
          thumbnail_url,
          thumbnail_path,
          model_url,
          model_path,
          created_at,
          updated_at
          `
        )
        .single();

    if (
      updateError
    ) {
      console.error(
        "GRADE MODEL DB UPDATE ERROR:",
        updateError
      );

      /*
        DB failed after browser uploaded new model.

        Remove the newly uploaded object so it does not
        become orphaned.
      */

      const {
        error:
          cleanupNewError,
      } =
        await supabaseAdmin
          .storage
          .from(
            BUCKET
          )
          .remove([
            modelPath,
          ]);

      if (
        cleanupNewError
      ) {
        console.error(
          "GRADE MODEL NEW FILE CLEANUP ERROR:",
          cleanupNewError
        );
      }

      return jsonError(
        updateError.message,
        500,
        "GRADE_ASSET_UPDATE_FAILED"
      );
    }

    /* =====================================================
       8. REMOVE OLD GLB

       Only after DB points at the new model.
    ===================================================== */

    const previousPath =
      cleanText(
        previousAsset
          ?.model_path
      );

    if (
      previousPath &&
      previousPath !==
        modelPath
    ) {
      const {
        error:
          removeOldError,
      } =
        await supabaseAdmin
          .storage
          .from(
            BUCKET
          )
          .remove([
            previousPath,
          ]);

      if (
        removeOldError
      ) {
        /*
          Do not fail the operation.

          New GLB is already correctly connected.
        */

        console.error(
          "GRADE MODEL OLD FILE CLEANUP ERROR:",
          removeOldError
        );
      }
    }

    /* =====================================================
       9. SUCCESS
    ===================================================== */

    return NextResponse.json(
      {
        success:
          true,

        admin: {
          email:
            auth.email,
        },

        product: {
          id:
            product.id,

          code:
            product.code,

          name:
            product.name,
        },

        design: {
          id:
            design.id,

          design_code:
            design.design_code,

          name:
            design.name,
        },

        asset: {
          ...updatedAsset,

          image_ready:
            Boolean(
              updatedAsset
                .thumbnail_url
            ),

          model_ready:
            Boolean(
              updatedAsset
                .model_url
            ),
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "GRADE MODEL FINALIZE API ERROR:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to finalize Grade model upload",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}