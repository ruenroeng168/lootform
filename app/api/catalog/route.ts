import {
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

/* =========================================================
   RUNTIME
========================================================= */

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

/* =========================================================
   TYPES
========================================================= */

type Grade =
  | "COMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY";

type ActiveSeason = {
  id: number;

  season_code: string;
  season_name: string;

  /*
    Legacy fields.

    Product identity / price now belongs to Product Catalog.
  */
  product_name: string;
  craft_cost: number;

  common_rate: number;
  rare_rate: number;
  epic_rate: number;
  legendary_rate: number;

  is_active: boolean;

  start_at: string | null;
  end_at: string | null;
};

type RecentPullRow = {
  grade: Grade;
  product: string;
  created_at: string;
};

type CatalogProductRow = {
  id: number;

  code: string;
  name: string;

  category: string;
  equip_slot: string;

  season: string;

  description:
    | string
    | null;

  is_active: boolean;
};

type CatalogDesignRow = {
  id: number;

  product_id: number;

  design_code: string;
  name: string;

  craft_cost_lt: number;

  thumbnail_url:
    | string
    | null;

  model_url:
    | string
    | null;

  available_sizes:
    | string[]
    | null;

  sort_order: number;

  is_active: boolean;
};

type GradeAssetRow = {
  id: number;

  design_id: number;

  grade: Grade;

  thumbnail_url:
    | string
    | null;

  model_url:
    | string
    | null;
};

/* =========================================================
   CONFIG
========================================================= */

const GRADES: Grade[] = [
  "COMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
];

/* =========================================================
   RESPONSE
========================================================= */

function jsonError(
  message: string,
  status = 500,
  code = "CATALOG_ERROR"
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
   SIZE
========================================================= */

function normalizeSizes(
  value:
    | string[]
    | null
    | undefined
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (size) =>
            String(
              size
            )
              .trim()
              .toUpperCase()
        )
        .filter(Boolean)
    )
  );
}

/* =========================================================
   ODDS
========================================================= */

function getOdds(
  season: ActiveSeason
) {
  return {
    COMMON:
      Number(
        season.common_rate
      ),

    RARE:
      Number(
        season.rare_rate
      ),

    EPIC:
      Number(
        season.epic_rate
      ),

    LEGENDARY:
      Number(
        season.legendary_rate
      ),
  };
}

/* =========================================================
   REQUIRED GRADES

   Only Grades whose probability is greater than 0
   require an Image before Craft is allowed.
========================================================= */

function getRequiredGrades(
  season: ActiveSeason
): Grade[] {
  const odds =
    getOdds(
      season
    );

  return GRADES.filter(
    (grade) =>
      odds[
        grade
      ] > 0
  );
}

/* =========================================================
   VALIDATE SEASON ODDS
========================================================= */

function validateOdds(
  season: ActiveSeason
) {
  const odds =
    getOdds(
      season
    );

  const values =
    GRADES.map(
      (grade) =>
        odds[
          grade
        ]
    );

  const invalid =
    values.some(
      (value) =>
        !Number.isFinite(
          value
        ) ||
        value < 0 ||
        value > 100
    );

  if (
    invalid
  ) {
    return {
      ok: false,

      total:
        values.reduce(
          (
            sum,
            value
          ) =>
            sum +
            (
              Number.isFinite(
                value
              )
                ? value
                : 0
            ),
          0
        ),
    };
  }

  const total =
    values.reduce(
      (
        sum,
        value
      ) =>
        sum +
        value,
      0
    );

  return {
    ok:
      Math.abs(
        total -
        100
      ) <
      0.0001,

    total,
  };
}

/* =========================================================
   GET /api/catalog
========================================================= */

export async function GET() {
  try {
    /* =====================================================
       1. ACTIVE SEASON
    ===================================================== */

    const {
      data:
        seasonData,

      error:
        seasonError,
    } =
      await supabaseAdmin
        .from(
          "season_settings"
        )
        .select(
          `
          id,
          season_code,
          season_name,
          product_name,
          craft_cost,
          common_rate,
          rare_rate,
          epic_rate,
          legendary_rate,
          is_active,
          start_at,
          end_at
          `
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "id",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();

    if (
      seasonError
    ) {
      console.error(
        "CATALOG SEASON ERROR:",
        seasonError
      );

      return jsonError(
        "Unable to load active Season.",
        500,
        "SEASON_LOAD_FAILED"
      );
    }

    /* =====================================================
       2. DROP CLOSED

       This is not an API error.
    ===================================================== */

    if (
      !seasonData
    ) {
      return NextResponse.json(
        {
          success:
            true,

          drop_open:
            false,

          season:
            null,

          catalog:
            [],
        },
        {
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const season =
      seasonData as
        ActiveSeason;

    /* =====================================================
       3. ODDS VALIDATION
    ===================================================== */

    const oddsValidation =
      validateOdds(
        season
      );

    if (
      !oddsValidation.ok
    ) {
      return jsonError(
        `Season Grade Odds are invalid. Total: ${oddsValidation.total}%`,
        500,
        "INVALID_SEASON_ODDS"
      );
    }

    const odds =
      getOdds(
        season
      );

    const requiredGrades =
      getRequiredGrades(
        season
      );

    /* =====================================================
       3B. RECENT PULLS

       Guest-facing activity ticker. Intentionally excludes
       owner_id / serial so no player identity or exact print
       number is exposed to unauthenticated visitors.
    ===================================================== */

    const {
      data:
        recentPullData,
    } =
      await supabaseAdmin
        .from(
          "items"
        )
        .select(
          "grade, product, created_at"
        )
        .order(
          "id",
          {
            ascending:
              false,
          }
        )
        .limit(8);

    const recentPulls =
      (
        recentPullData ??
        []
      ) as RecentPullRow[];

    /* =====================================================
       4. ACTIVE PRODUCTS IN CURRENT SEASON
    ===================================================== */

    const {
      data:
        productData,

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
          name,
          category,
          equip_slot,
          season,
          description,
          is_active
          `
        )
        .eq(
          "is_active",
          true
        )
        .eq(
          "season",
          season.season_code
        )
        .order(
          "id",
          {
            ascending:
              true,
          }
        );

    if (
      productError
    ) {
      console.error(
        "CATALOG PRODUCT ERROR:",
        productError
      );

      return jsonError(
        "Unable to load Products.",
        500,
        "PRODUCT_LOAD_FAILED"
      );
    }

    const products =
      (
        productData ??
        []
      ) as CatalogProductRow[];

    /* =====================================================
       5. NO ACTIVE PRODUCT

       Still a valid Catalog response.
    ===================================================== */

    if (
      products.length ===
      0
    ) {
      return NextResponse.json(
        {
          success:
            true,

          drop_open:
            true,

          season: {
            id:
              season.id,

            code:
              season.season_code,

            name:
              season.season_name,

            odds,

            start_at:
              season.start_at,

            end_at:
              season.end_at,
          },

          required_grades:
            requiredGrades,

          catalog:
            [],

          recent_pulls:
            recentPulls,
        },
        {
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const productIds =
      products.map(
        (product) =>
          product.id
      );

    /* =====================================================
       6. ACTIVE DESIGNS
    ===================================================== */

    const {
      data:
        designData,

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
          name,
          craft_cost_lt,
          thumbnail_url,
          model_url,
          available_sizes,
          sort_order,
          is_active
          `
        )
        .in(
          "product_id",
          productIds
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        )
        .order(
          "id",
          {
            ascending:
              true,
          }
        );

    if (
      designError
    ) {
      console.error(
        "CATALOG DESIGN ERROR:",
        designError
      );

      return jsonError(
        "Unable to load Designs.",
        500,
        "DESIGN_LOAD_FAILED"
      );
    }

    const designs =
      (
        designData ??
        []
      ) as CatalogDesignRow[];

    /* =====================================================
       7. LOAD GRADE ASSETS

       We only expose readiness to Player Catalog.

       Storage paths are NOT exposed.
    ===================================================== */

    const designIds =
      designs.map(
        (design) =>
          design.id
      );

    let gradeAssets:
      GradeAssetRow[] =
        [];

    if (
      designIds.length >
      0
    ) {
      const {
        data:
          gradeAssetData,

        error:
          gradeAssetError,
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
            model_url
            `
          )
          .in(
            "design_id",
            designIds
          );

      if (
        gradeAssetError
      ) {
        console.error(
          "CATALOG GRADE ASSET ERROR:",
          gradeAssetError
        );

        return jsonError(
          "Unable to load Grade Assets.",
          500,
          "GRADE_ASSET_LOAD_FAILED"
        );
      }

      gradeAssets =
        (
          gradeAssetData ??
          []
        ) as GradeAssetRow[];
    }

    /* =====================================================
       8. INDEX GRADE ASSETS

       Map:
       design_id
         ↓
       grade
         ↓
       asset
    ===================================================== */

    const assetsByDesign =
      new Map<
        number,
        Map<
          Grade,
          GradeAssetRow
        >
      >();

    for (
      const asset of
      gradeAssets
    ) {
      if (
        !GRADES.includes(
          asset.grade
        )
      ) {
        continue;
      }

      let designMap =
        assetsByDesign.get(
          asset.design_id
        );

      if (
        !designMap
      ) {
        designMap =
          new Map<
            Grade,
            GradeAssetRow
          >();

        assetsByDesign.set(
          asset.design_id,
          designMap
        );
      }

      designMap.set(
        asset.grade,
        asset
      );
    }

    /* =====================================================
       9. BUILD DESIGN READINESS
    ===================================================== */

    const designsByProduct =
      new Map<
        number,
        Array<{
          id: number;

          design_code: string;
          name: string;

          craft_cost_lt: number;

          available_sizes: string[];

          thumbnail_url:
            | string
            | null;

          model_url:
            | string
            | null;

          has_image: boolean;
          has_3d_model: boolean;

          sort_order: number;

          craft_ready: boolean;

          required_grades: Grade[];

          missing_grade_images: Grade[];

          grade_asset_status: Array<{
            grade: Grade;

            probability: number;

            required: boolean;

            image_ready: boolean;

            model_ready: boolean;
          }>;
        }>
      >();

    for (
      const design of
      designs
    ) {
      const designAssets =
        assetsByDesign.get(
          design.id
        ) ??
        new Map<
          Grade,
          GradeAssetRow
        >();

      /* ---------------------------------------------------
         Missing REQUIRED grade images
      --------------------------------------------------- */

      const missingGradeImages =
        requiredGrades.filter(
          (grade) => {
            const asset =
              designAssets.get(
                grade
              );

            return (
              !asset ||
              !String(
                asset.thumbnail_url ??
                ""
              ).trim()
            );
          }
        );

      const gradeAssetStatus =
        GRADES.map(
          (grade) => {
            const asset =
              designAssets.get(
                grade
              );

            return {
              grade,

              probability:
                odds[
                  grade
                ],

              required:
                requiredGrades.includes(
                  grade
                ),

              image_ready:
                Boolean(
                  String(
                    asset
                      ?.thumbnail_url ??
                      ""
                  ).trim()
                ),

              /*
                GLB is optional for Craft readiness.
              */

              model_ready:
                Boolean(
                  String(
                    asset
                      ?.model_url ??
                      ""
                  ).trim()
                ),
            };
          }
        );

      const craftReady =
        missingGradeImages.length ===
        0;

      const publicDesign = {
        id:
          design.id,

        design_code:
          design.design_code,

        name:
          design.name,

        craft_cost_lt:
          Number(
            design.craft_cost_lt
          ),

        available_sizes:
          normalizeSizes(
            design.available_sizes
          ),

        /*
          These remain Design Preview assets.
        */

        thumbnail_url:
          design.thumbnail_url,

        model_url:
          design.model_url,

        has_image:
          Boolean(
            design.thumbnail_url
          ),

        has_3d_model:
          Boolean(
            design.model_url
          ),

        sort_order:
          Number(
            design.sort_order
          ),

        /* -----------------------------------------------
           NEW READINESS
        ----------------------------------------------- */

        craft_ready:
          craftReady,

        required_grades:
          requiredGrades,

        missing_grade_images:
          missingGradeImages,

        grade_asset_status:
          gradeAssetStatus,
      };

      const current =
        designsByProduct.get(
          design.product_id
        ) ??
        [];

      current.push(
        publicDesign
      );

      designsByProduct.set(
        design.product_id,
        current
      );
    }

    /* =====================================================
       10. BUILD PUBLIC CATALOG

       Important:
       Product remains visible even when Design assets
       are incomplete.

       Player UI can therefore display:
       NOT READY / missing assets.
    ===================================================== */

    const catalog =
      products
        .map(
          (product) => {
            const productDesigns =
              designsByProduct.get(
                product.id
              ) ??
              [];

            const readyDesignCount =
              productDesigns.filter(
                (design) =>
                  design.craft_ready
              ).length;

            return {
              id:
                product.id,

              code:
                product.code,

              name:
                product.name,

              category:
                product.category,

              equip_slot:
                product.equip_slot,

              season:
                product.season,

              description:
                product.description,

              designs:
                productDesigns,

              /* -----------------------------------------
                 NEW PRODUCT READINESS
              ----------------------------------------- */

              craft_ready:
                readyDesignCount >
                0,

              ready_design_count:
                readyDesignCount,

              total_design_count:
                productDesigns.length,
            };
          }
        )
        /*
          Product with no active Design should not be
          presented as a Player Craft Product.
        */
        .filter(
          (product) =>
            product.designs.length >
            0
        );

    /* =====================================================
       11. SUCCESS
    ===================================================== */

    return NextResponse.json(
      {
        success:
          true,

        drop_open:
          true,

        season: {
          id:
            season.id,

          code:
            season.season_code,

          name:
            season.season_name,

          odds,

          start_at:
            season.start_at,

          end_at:
            season.end_at,
        },

        /*
          Top-level copy is useful to UI.
        */

        required_grades:
          requiredGrades,

        catalog,

        recent_pulls:
          recentPulls,
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
      "PUBLIC CATALOG API ERROR:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load Catalog.",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}