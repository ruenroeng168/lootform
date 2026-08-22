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
  "product-images";

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const VALID_GRADES: Grade[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

const VALID_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/* =========================================================
   RESPONSE
========================================================= */

function jsonError(
  message: string,
  status = 400,
  code?: string
) {
  return NextResponse.json(
    {
      success: false,
      code:
        code ??
        "GRADE_IMAGE_UPLOAD_ERROR",
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
   EXTENSION
========================================================= */

function getExtension(
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

  if (
    file.type ===
    "image/webp"
  ) {
    return "webp";
  }

  return null;
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

    userId:
      data.user.id,

    email,
  };
}

/* =========================================================
   POST

   multipart/form-data

   file
   product_id
   design_id
   grade
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
       2. FORM DATA
    ===================================================== */

    const formData =
      await request.formData();

    const fileValue =
      formData.get(
        "file"
      );

    const productId =
      Number(
        formData.get(
          "product_id"
        )
      );

    const designId =
      Number(
        formData.get(
          "design_id"
        )
      );

    const grade =
      normalizeGrade(
        formData.get(
          "grade"
        )
      );

    /* =====================================================
       3. VALIDATE IDS
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
       4. VALIDATE FILE
    ===================================================== */

    if (
      !(fileValue instanceof File)
    ) {
      return jsonError(
        "Image file is required",
        400,
        "FILE_REQUIRED"
      );
    }

    const file =
      fileValue;

    if (
      file.size <= 0
    ) {
      return jsonError(
        "Image file is empty",
        400,
        "EMPTY_FILE"
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return jsonError(
        "Image must not exceed 5 MB",
        400,
        "FILE_TOO_LARGE"
      );
    }

    if (
      !VALID_MIME_TYPES.includes(
        file.type
      )
    ) {
      return jsonError(
        "Only JPEG, PNG and WEBP are supported",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    const extension =
      getExtension(
        file
      );

    if (!extension) {
      return jsonError(
        "Unable to determine image format",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    /* =====================================================
       5. LOAD PRODUCT
    ===================================================== */

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
      console.error(
        "GRADE IMAGE PRODUCT ERROR:",
        productError
      );

      return jsonError(
        productError.message,
        500,
        "PRODUCT_QUERY_FAILED"
      );
    }

    if (!product) {
      return jsonError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND"
      );
    }

    /* =====================================================
       6. LOAD DESIGN

       Design must belong to Product.
    ===================================================== */

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
      console.error(
        "GRADE IMAGE DESIGN ERROR:",
        designError
      );

      return jsonError(
        designError.message,
        500,
        "DESIGN_QUERY_FAILED"
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
       7. ENSURE GRADE ASSET ROW
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
        "GRADE IMAGE ENSURE ROW ERROR:",
        ensureError
      );

      return jsonError(
        ensureError.message,
        500,
        "GRADE_ASSET_PREPARE_FAILED"
      );
    }

    /* =====================================================
       8. STORAGE PATH

       product-images
       /
       products
       /1
       /D01
       /grades
       /EPIC
       /timestamp-uuid.png
    ===================================================== */

    const designCode =
      safeSegment(
        design.design_code
      );

    const timestamp =
      Date.now();

    const filename =
      `${timestamp}-${randomUUID()}.${extension}`;

    const storagePath =
      [
        "products",
        String(
          productId
        ),
        designCode,
        "grades",
        grade,
        filename,
      ].join("/");

    /* =====================================================
       9. FILE BUFFER
    ===================================================== */

    const arrayBuffer =
      await file
        .arrayBuffer();

    const buffer =
      Buffer.from(
        arrayBuffer
      );

    /* =====================================================
       10. UPLOAD
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
          buffer,
          {
            contentType:
              file.type,

            cacheControl:
              "3600",

            upsert:
              false,
          }
        );

    if (
      uploadError
    ) {
      console.error(
        "GRADE IMAGE STORAGE ERROR:",
        uploadError
      );

      return jsonError(
        uploadError.message,
        500,
        "STORAGE_UPLOAD_FAILED"
      );
    }

    /* =====================================================
       11. PUBLIC URL
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
      /* Cleanup orphan storage file */

      await supabaseAdmin
        .storage
        .from(
          BUCKET
        )
        .remove([
          storagePath,
        ]);

      return jsonError(
        "Unable to create public image URL",
        500,
        "PUBLIC_URL_FAILED"
      );
    }

    /* =====================================================
       12. CURRENT GRADE ASSET

       Used to identify old file for cleanup
       AFTER database update succeeds.
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
          thumbnail_url,
          thumbnail_path
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
      console.error(
        "GRADE IMAGE PREVIOUS ASSET ERROR:",
        previousAssetError
      );

      await supabaseAdmin
        .storage
        .from(
          BUCKET
        )
        .remove([
          storagePath,
        ]);

      return jsonError(
        previousAssetError.message,
        500,
        "GRADE_ASSET_QUERY_FAILED"
      );
    }

    /* =====================================================
       13. SAVE DB
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
        .update({
          thumbnail_url:
            publicUrl,

          thumbnail_path:
            storagePath,
        })
        .eq(
          "design_id",
          designId
        )
        .eq(
          "grade",
          grade
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
        "GRADE IMAGE DATABASE ERROR:",
        updateError
      );

      /*
        New file was uploaded but database could not save it.
        Remove new file so Storage does not contain orphan data.
      */

      await supabaseAdmin
        .storage
        .from(
          BUCKET
        )
        .remove([
          storagePath,
        ]);

      return jsonError(
        updateError.message,
        500,
        "GRADE_ASSET_UPDATE_FAILED"
      );
    }

    /* =====================================================
       14. DELETE OLD IMAGE

       Only delete when:
       - old path exists
       - old path != new path

       DB already points to new image at this stage.
    ===================================================== */

    const previousPath =
      cleanText(
        previousAsset
          ?.thumbnail_path
      );

    if (
      previousPath &&
      previousPath !==
        storagePath
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
          Do not fail request.

          The new image is already correctly saved.
          Old storage cleanup can be handled later.
        */

        console.error(
          "GRADE IMAGE OLD FILE CLEANUP ERROR:",
          removeOldError
        );
      }
    }

    /* =====================================================
       15. SUCCESS
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
            true,

          model_ready:
            Boolean(
              updatedAsset
                .model_url
            ),
        },

        upload: {
          bucket:
            BUCKET,

          path:
            storagePath,

          public_url:
            publicUrl,

          size:
            file.size,

          content_type:
            file.type,
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
      "GRADE IMAGE UPLOAD API ERROR:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to upload Grade image",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}