import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

const BUCKET_NAME = "product-images";

const MAX_FILE_SIZE =
  5 * 1024 * 1024;

const MIME_EXTENSIONS: Record<
  string,
  string
> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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

function cleanText(
  value: FormDataEntryValue | null
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
    !email ||
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

export async function POST(
  request: NextRequest
) {
  try {
    const auth =
      await requireAdmin(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    const formData =
      await request.formData();

    const fileValue =
      formData.get(
        "file"
      );

    if (
      !(fileValue instanceof File)
    ) {
      return jsonError(
        "Image file is required"
      );
    }

    const file =
      fileValue;

    if (
      !MIME_EXTENSIONS[
        file.type
      ]
    ) {
      return jsonError(
        "Only JPG, PNG and WEBP images are allowed"
      );
    }

    if (
      file.size <= 0
    ) {
      return jsonError(
        "Image file is empty"
      );
    }

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return jsonError(
        "Image must be 5MB or smaller"
      );
    }

    const productId =
      safePathPart(
        cleanText(
          formData.get(
            "product_id"
          )
        ) ||
          "UNKNOWN"
      );

    const designCode =
      safePathPart(
        cleanText(
          formData.get(
            "design_code"
          )
        ) ||
          "DESIGN"
      );

    const extension =
      MIME_EXTENSIONS[
        file.type
      ];

    const filename =
      `${Date.now()}-${randomUUID()}.${extension}`;

    const storagePath =
      `products/${productId}/${designCode}/${filename}`;

    const bytes =
      Buffer.from(
        await file.arrayBuffer()
      );

    const {
      error: uploadError,
    } =
      await supabaseAdmin.storage
        .from(
          BUCKET_NAME
        )
        .upload(
          storagePath,
          bytes,
          {
            contentType:
              file.type,

            cacheControl:
              "3600",

            upsert:
              false,
          }
        );

    if (uploadError) {
      console.error(
        "PRODUCT IMAGE UPLOAD ERROR:",
        uploadError
      );

      return jsonError(
        uploadError.message,
        500
      );
    }

    const {
      data: publicUrlData,
    } =
      supabaseAdmin.storage
        .from(
          BUCKET_NAME
        )
        .getPublicUrl(
          storagePath
        );

    return NextResponse.json({
      ok: true,

      url:
        publicUrlData.publicUrl,

      path:
        storagePath,

      filename:
        file.name,

      size:
        file.size,

      content_type:
        file.type,
    });
  } catch (error) {
    console.error(
      "ADMIN PRODUCT IMAGE UPLOAD ERROR:",
      error
    );

    return jsonError(
      "Internal server error",
      500
    );
  }
}