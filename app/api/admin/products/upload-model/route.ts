import { randomUUID } from "node:crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   CONFIG
========================================================= */

export const runtime = "nodejs";

const BUCKET_NAME =
  "product-models";

const MAX_FILE_SIZE =
  50 * 1024 * 1024;

/* =========================================================
   RESPONSE
========================================================= */

function jsonError(
  message: string,
  status = 400
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
    }
  );
}

/* =========================================================
   HELPERS
========================================================= */

function cleanText(
  value: unknown
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value.trim();
}

function safePathPart(
  value: string
) {
  return value
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9_-]/g,
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
}

function safeFileName(
  value: string
) {
  const withoutExtension =
    value.replace(
      /\.glb$/i,
      ""
    );

  const cleaned =
    withoutExtension
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9_-]/g,
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

  return cleaned ||
    "lootform-model";
}

/* =========================================================
   ADMIN AUTH
========================================================= */

async function requireAdmin(
  request: NextRequest
) {
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
      ok: false as const,

      response:
        jsonError(
          "Unauthorized",
          401
        ),
    };
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    return {
      ok: false as const,

      response:
        jsonError(
          "Unauthorized",
          401
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
      ok: false as const,

      response:
        jsonError(
          "Invalid session",
          401
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

  if (!email) {
    return {
      ok: false as const,

      response:
        jsonError(
          "Admin email not found",
          403
        ),
    };
  }

  const adminEmails =
    (
      process.env.ADMIN_EMAILS ??
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
    !adminEmails.includes(
      email
    )
  ) {
    return {
      ok: false as const,

      response:
        jsonError(
          "Admin access required",
          403
        ),
    };
  }

  return {
    ok: true as const,

    userId:
      data.user.id,

    email,
  };
}

/* =========================================================
   POST
   CREATE SIGNED GLB UPLOAD
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    /* -----------------------------------------------------
       ADMIN CHECK
    ----------------------------------------------------- */

    const auth =
      await requireAdmin(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    /* -----------------------------------------------------
       BODY
    ----------------------------------------------------- */

    let body: unknown;

    try {
      body =
        await request.json();
    } catch {
      return jsonError(
        "Invalid JSON body"
      );
    }

    const payload =
      body as Record<
        string,
        unknown
      >;

    /* -----------------------------------------------------
       PRODUCT
    ----------------------------------------------------- */

    const productId =
      Number(
        payload?.product_id
      );

    if (
      !Number.isInteger(
        productId
      ) ||
      productId <= 0
    ) {
      return jsonError(
        "Invalid product_id"
      );
    }

    /* -----------------------------------------------------
       DESIGN CODE
    ----------------------------------------------------- */

    const rawDesignCode =
      cleanText(
        payload?.design_code
      );

    if (!rawDesignCode) {
      return jsonError(
        "Design code is required"
      );
    }

    const designCode =
      safePathPart(
        rawDesignCode
      );

    if (!designCode) {
      return jsonError(
        "Invalid design code"
      );
    }

    /* -----------------------------------------------------
       FILE NAME
    ----------------------------------------------------- */

    const originalFilename =
      cleanText(
        payload?.filename
      );

    if (!originalFilename) {
      return jsonError(
        "Filename is required"
      );
    }

    if (
      !originalFilename
        .toLowerCase()
        .endsWith(
          ".glb"
        )
    ) {
      return jsonError(
        "Only .glb files are allowed"
      );
    }

    /* -----------------------------------------------------
       FILE SIZE
    ----------------------------------------------------- */

    const fileSize =
      Number(
        payload?.size
      );

    if (
      !Number.isFinite(
        fileSize
      ) ||
      fileSize <= 0
    ) {
      return jsonError(
        "Invalid file size"
      );
    }

    if (
      fileSize >
      MAX_FILE_SIZE
    ) {
      return jsonError(
        "GLB file must be 50MB or smaller"
      );
    }

    /* -----------------------------------------------------
       CONTENT TYPE

       Windows / Browser บางตัว
       อาจส่ง GLB เป็น:
       - model/gltf-binary
       - application/octet-stream
       - empty string

       ถ้าว่าง เราจะใช้ model/gltf-binary
    ----------------------------------------------------- */

    const rawContentType =
      cleanText(
        payload?.content_type
      );

    let contentType =
      rawContentType ||
      "model/gltf-binary";

    const allowedContentTypes = [
      "model/gltf-binary",
      "application/octet-stream",
    ];

    if (
      !allowedContentTypes.includes(
        contentType
      )
    ) {
      /*
        นามสกุล .glb ผ่านแล้ว
        แต่ Browser รายงาน MIME แปลก

        Normalize เป็น GLB MIME
      */

      contentType =
        "model/gltf-binary";
    }

    /* -----------------------------------------------------
       CHECK PRODUCT EXISTS
    ----------------------------------------------------- */

    const {
      data:
        existingProduct,

      error:
        productError,
    } =
      await supabaseAdmin
        .from(
          "products"
        )
        .select(
          "id, code, name"
        )
        .eq(
          "id",
          productId
        )
        .maybeSingle();

    if (productError) {
      console.error(
        "MODEL PRODUCT CHECK ERROR:",
        productError
      );

      return jsonError(
        productError.message,
        500
      );
    }

    if (!existingProduct) {
      return jsonError(
        "Product not found",
        404
      );
    }

    /* -----------------------------------------------------
       BUILD STORAGE PATH

       เราไม่ overwrite model เก่า

       เช่น:
       products/
       └─ 2/
          └─ D01/
             └─ 1724300000000-uuid-void-hoodie.glb

       ข้อดี:
       - เปลี่ยน GLB ได้
       - Asset เก่ายังอยู่
       - ลดปัญหา CDN cache
       - Item เก่าในอนาคตสามารถอ้าง model เดิมได้
    ----------------------------------------------------- */

    const baseFilename =
      safeFileName(
        originalFilename
      );

    const uniqueFilename =
      [
        Date.now(),
        randomUUID(),
        baseFilename,
      ].join(
        "-"
      ) +
      ".glb";

    const storagePath =
      [
        "products",
        String(
          productId
        ),
        designCode,
        uniqueFilename,
      ].join("/");

    /* -----------------------------------------------------
       CREATE SIGNED UPLOAD TOKEN
    ----------------------------------------------------- */

    const {
      data:
        signedData,

      error:
        signedError,
    } =
      await supabaseAdmin.storage
        .from(
          BUCKET_NAME
        )
        .createSignedUploadUrl(
          storagePath,
          {
            upsert:
              false,
          }
        );

    if (
      signedError ||
      !signedData
    ) {
      console.error(
        "CREATE MODEL SIGNED URL ERROR:",
        signedError
      );

      return jsonError(
        signedError?.message ||
          "Cannot create model upload URL",
        500
      );
    }

    /* -----------------------------------------------------
       PUBLIC MODEL URL

       Bucket product-models เป็น Public
       URL นี้จะใช้เก็บลง product_designs.model_url
    ----------------------------------------------------- */

    const {
      data:
        publicUrlData,
    } =
      supabaseAdmin.storage
        .from(
          BUCKET_NAME
        )
        .getPublicUrl(
          storagePath
        );

    /* -----------------------------------------------------
       RESPONSE

       หมายเหตุ:
       API นี้ไม่ได้รับไฟล์ GLB จริง

       Browser จะเอา:
       path + token

       ไป uploadToSignedUrl()
       ตรงเข้า Supabase
    ----------------------------------------------------- */

    return NextResponse.json({
      ok: true,

      bucket:
        BUCKET_NAME,

      path:
        storagePath,

      token:
        signedData.token,

      signed_url:
        signedData.signedUrl,

      public_url:
        publicUrlData.publicUrl,

      content_type:
        contentType,

      original_filename:
        originalFilename,

      size:
        fileSize,

      product: {
        id:
          existingProduct.id,

        code:
          existingProduct.code,

        name:
          existingProduct.name,
      },

      design_code:
        designCode,
    });
  } catch (error) {
    console.error(
      "ADMIN MODEL UPLOAD PREPARE ERROR:",
      error
    );

    return jsonError(
      "Internal server error",
      500
    );
  }
}