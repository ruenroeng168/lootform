import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

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
      userId: string;
      email: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

/* =========================================================
   CONSTANTS
========================================================= */

const VALID_GRADES: Grade[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

/* =========================================================
   HELPERS
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

function cleanOptionalText(
  value: unknown
) {
  const text =
    cleanText(value);

  return text
    ? text
    : null;
}

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
      ok: false,

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
      ok: false,

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
      ok: false,

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
      .map((item) =>
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
      ok: false,

      response:
        jsonError(
          "Admin access required",
          403
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
   ENSURE FOUR GRADE ROWS

   Normally database trigger already creates these.

   This is a secondary safety layer for legacy designs.
========================================================= */

async function ensureGradeRows(
  designId: number
) {
  const rows =
    VALID_GRADES.map(
      (grade) => ({
        design_id:
          designId,
        grade,
      })
    );

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        "product_design_grade_assets"
      )
      .upsert(
        rows,
        {
          onConflict:
            "design_id,grade",

          ignoreDuplicates:
            true,
        }
      );

  if (error) {
    throw new Error(
      error.message
    );
  }
}

/* =========================================================
   GET

   /api/admin/products/grade-assets?design_id=1
========================================================= */

export async function GET(
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

    const designId =
      Number(
        request.nextUrl
          .searchParams
          .get(
            "design_id"
          )
      );

    if (
      !Number.isInteger(
        designId
      ) ||
      designId <= 0
    ) {
      return jsonError(
        "Invalid design_id"
      );
    }

    /* -----------------------------------------------------
       DESIGN EXISTS
    ----------------------------------------------------- */

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
        .maybeSingle();

    if (
      designError
    ) {
      console.error(
        "GRADE ASSET DESIGN ERROR:",
        designError
      );

      return jsonError(
        designError.message,
        500
      );
    }

    if (!design) {
      return jsonError(
        "Design not found",
        404
      );
    }

    /* -----------------------------------------------------
       ENSURE FOUR ROWS
    ----------------------------------------------------- */

    try {
      await ensureGradeRows(
        designId
      );
    } catch (
      ensureError
    ) {
      console.error(
        "ENSURE GRADE ROWS ERROR:",
        ensureError
      );

      return jsonError(
        ensureError instanceof Error
          ? ensureError.message
          : "Cannot prepare Grade Assets",
        500
      );
    }

    /* -----------------------------------------------------
       LOAD ASSETS
    ----------------------------------------------------- */

    const {
      data:
        assets,

      error:
        assetsError,
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
          thumbnail_url,
          thumbnail_path,
          model_url,
          model_path,
          created_at,
          updated_at
          `
        )
        .eq(
          "design_id",
          designId
        );

    if (
      assetsError
    ) {
      console.error(
        "LOAD GRADE ASSETS ERROR:",
        assetsError
      );

      return jsonError(
        assetsError.message,
        500
      );
    }

    /* -----------------------------------------------------
       SORT COMMON -> LEGENDARY
    ----------------------------------------------------- */

    const gradeOrder =
      new Map(
        VALID_GRADES.map(
          (
            grade,
            index
          ) => [
            grade,
            index,
          ]
        )
      );

    const sortedAssets =
      (
        assets ??
        []
      )
        .map(
          (asset) => ({
            ...asset,

            image_ready:
              Boolean(
                asset.thumbnail_url
              ),

            model_ready:
              Boolean(
                asset.model_url
              ),
          })
        )
        .sort(
          (
            left,
            right
          ) => {
            const leftOrder =
              gradeOrder.get(
                left.grade as Grade
              ) ??
              999;

            const rightOrder =
              gradeOrder.get(
                right.grade as Grade
              ) ??
              999;

            return (
              leftOrder -
              rightOrder
            );
          }
        );

    return NextResponse.json({
      ok: true,

      design: {
        id:
          design.id,

        product_id:
          design.product_id,

        design_code:
          design.design_code,

        name:
          design.name,
      },

      assets:
        sortedAssets,
    });
  } catch (error) {
    console.error(
      "GRADE ASSET GET ERROR:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Internal server error",
      500
    );
  }
}

/* =========================================================
   PATCH

   Update URLs / Storage paths for ONE Grade.

   Example:

   {
     "design_id": 1,
     "grade": "EPIC",
     "thumbnail_url": "...",
     "thumbnail_path": "...",
     "model_url": "...",
     "model_path": "..."
   }
========================================================= */

export async function PATCH(
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

    const body =
      await request.json();

    const designId =
      Number(
        body?.design_id
      );

    const grade =
      normalizeGrade(
        body?.grade
      );

    if (
      !Number.isInteger(
        designId
      ) ||
      designId <= 0
    ) {
      return jsonError(
        "Invalid design_id"
      );
    }

    if (!grade) {
      return jsonError(
        "Invalid grade"
      );
    }

    /* -----------------------------------------------------
       DESIGN EXISTS
    ----------------------------------------------------- */

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
        .maybeSingle();

    if (
      designError
    ) {
      return jsonError(
        designError.message,
        500
      );
    }

    if (!design) {
      return jsonError(
        "Design not found",
        404
      );
    }

    /* -----------------------------------------------------
       PREPARE UPDATE

       undefined = do not touch
       ""        = clear
       string    = save
    ----------------------------------------------------- */

    const updateData: Record<
      string,
      string | null
    > = {};

    if (
      body?.thumbnail_url !==
      undefined
    ) {
      updateData.thumbnail_url =
        cleanOptionalText(
          body.thumbnail_url
        );
    }

    if (
      body?.thumbnail_path !==
      undefined
    ) {
      updateData.thumbnail_path =
        cleanOptionalText(
          body.thumbnail_path
        );
    }

    if (
      body?.model_url !==
      undefined
    ) {
      updateData.model_url =
        cleanOptionalText(
          body.model_url
        );
    }

    if (
      body?.model_path !==
      undefined
    ) {
      updateData.model_path =
        cleanOptionalText(
          body.model_path
        );
    }

    if (
      Object.keys(
        updateData
      ).length ===
      0
    ) {
      return jsonError(
        "Nothing to update"
      );
    }

    /* -----------------------------------------------------
       UPSERT

       One row only for:
       design_id + grade
    ----------------------------------------------------- */

    const {
      data:
        asset,

      error:
        assetError,
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

            ...updateData,
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
      assetError
    ) {
      console.error(
        "UPDATE GRADE ASSET ERROR:",
        assetError
      );

      return jsonError(
        assetError.message,
        500
      );
    }

    return NextResponse.json({
      ok: true,

      design: {
        id:
          design.id,

        product_id:
          design.product_id,

        design_code:
          design.design_code,

        name:
          design.name,
      },

      asset: {
        ...asset,

        image_ready:
          Boolean(
            asset.thumbnail_url
          ),

        model_ready:
          Boolean(
            asset.model_url
          ),
      },
    });
  } catch (error) {
    console.error(
      "GRADE ASSET PATCH ERROR:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Internal server error",
      500
    );
  }
}