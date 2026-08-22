import {
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

type EnvironmentMode =
  | "TEST"
  | "LIVE";

type ActiveSeason = {
  id: number;

  season_code: string;
  season_name: string;

  /*
    Legacy compatibility only.

    Product identity / cost now belongs to Product Catalog.
  */
  product_name: string;
  craft_cost: number;

  common_rate: number;
  rare_rate: number;
  epic_rate: number;
  legendary_rate: number;

  is_active: boolean;
};

type CatalogProduct = {
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

type CatalogDesign = {
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

type GradeAsset = {
  id: number;

  design_id: number;

  grade: Grade;

  thumbnail_url:
    | string
    | null;

  thumbnail_path:
    | string
    | null;

  model_url:
    | string
    | null;

  model_path:
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
  status = 400,
  code = "CRAFT_ERROR",
  extra: Record<
    string,
    unknown
  > = {}
) {
  return NextResponse.json(
    {
      success: false,

      code,

      message,

      ...extra,
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
   NORMALIZE SIZE
========================================================= */

function normalizeSize(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value
    .trim()
    .toUpperCase();
}

function normalizeSizes(
  sizes:
    | string[]
    | null
    | undefined
) {
  if (
    !Array.isArray(
      sizes
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      sizes
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
   NUMBER ID
========================================================= */

function normalizeOptionalId(
  value: unknown
) {
  if (
    value ===
      undefined ||
    value ===
      null ||
    value ===
      ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  if (
    !Number.isInteger(
      number
    ) ||
    number <= 0
  ) {
    return NaN;
  }

  return number;
}

/* =========================================================
   ENVIRONMENT
========================================================= */

async function getEnvironmentMode(): Promise<EnvironmentMode> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "system_settings"
      )
      .select("*")
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
    error
  ) {
    console.error(
      "CRAFT SYSTEM SETTINGS ERROR:",
      error
    );

    /*
      Safe default.

      We never silently default to LIVE.
    */

    return "TEST";
  }

  if (!data) {
    return "TEST";
  }

  const rawMode =
    String(
      data.environment_mode ??
      data.environmentMode ??
      data.mode ??
      "TEST"
    )
      .trim()
      .toUpperCase();

  return rawMode ===
    "LIVE"
    ? "LIVE"
    : "TEST";
}

/* =========================================================
   SEASON ODDS
========================================================= */

function getSeasonOdds(
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

function validateSeasonOdds(
  season: ActiveSeason
) {
  const odds =
    getSeasonOdds(
      season
    );

  for (
    const grade of
    GRADES
  ) {
    const value =
      odds[
        grade
      ];

    if (
      !Number.isFinite(
        value
      ) ||
      value < 0 ||
      value > 100
    ) {
      return {
        ok: false,

        message:
          `${grade} probability is invalid.`,
      };
    }
  }

  const total =
    GRADES.reduce(
      (
        sum,
        grade
      ) =>
        sum +
        odds[
          grade
        ],
      0
    );

  if (
    Math.abs(
      total -
      100
    ) >
    0.0001
  ) {
    return {
      ok: false,

      message:
        `Season probability total must equal 100%. Current total: ${total}%`,
    };
  }

  return {
    ok: true,

    message:
      "",
  };
}

/* =========================================================
   GRADE ROLL

   SERVER ONLY
========================================================= */

function rollGrade(
  season: ActiveSeason
): Grade {
  const odds =
    getSeasonOdds(
      season
    );

  const roll =
    Math.random() *
    100;

  let cursor =
    odds.COMMON;

  if (
    roll <
    cursor
  ) {
    return "COMMON";
  }

  cursor +=
    odds.RARE;

  if (
    roll <
    cursor
  ) {
    return "RARE";
  }

  cursor +=
    odds.EPIC;

  if (
    roll <
    cursor
  ) {
    return "EPIC";
  }

  return "LEGENDARY";
}

/* =========================================================
   SERIAL
========================================================= */

function createSerial(
  seasonCode: string,
  number: number
) {
  return `LF-${seasonCode}-${String(
    number
  ).padStart(
    4,
    "0"
  )}`;
}

/* =========================================================
   REQUIRED GRADE ASSETS

   A Grade only needs an IMAGE when its Season probability
   is greater than zero.

   Example:

   LEGENDARY = 0%
   → LEGENDARY artwork may be empty.

   LEGENDARY = 3%
   → LEGENDARY artwork MUST exist before Craft.
========================================================= */

function getRequiredGrades(
  season: ActiveSeason
) {
  const odds =
    getSeasonOdds(
      season
    );

  return GRADES.filter(
    (grade) =>
      odds[
        grade
      ] >
      0
  );
}

/* =========================================================
   POST /api/craft
========================================================= */

export async function POST(
  request: Request
) {
  try {
    /* =====================================================
       1. AUTHORIZATION
    ===================================================== */

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
      return jsonError(
        "กรุณา Login ก่อน Craft",
        401,
        "UNAUTHORIZED"
      );
    }

    const token =
      authorization
        .slice(7)
        .trim();

    if (!token) {
      return jsonError(
        "กรุณา Login ก่อน Craft",
        401,
        "UNAUTHORIZED"
      );
    }

    const {
      data: {
        user,
      },

      error:
        userError,
    } =
      await supabaseAdmin
        .auth
        .getUser(
          token
        );

    if (
      userError ||
      !user
    ) {
      return jsonError(
        "Session หมดอายุ กรุณา Login ใหม่",
        401,
        "INVALID_SESSION"
      );
    }

    /* =====================================================
       2. REQUEST BODY
    ===================================================== */

    const body =
      await request.json();

    const size =
      normalizeSize(
        body?.size
      );

    const requestedProductId =
      normalizeOptionalId(
        body?.product_id
      );

    const requestedDesignId =
      normalizeOptionalId(
        body?.design_id
      );

    if (
      Number.isNaN(
        requestedProductId
      )
    ) {
      return jsonError(
        "product_id ไม่ถูกต้อง",
        400,
        "INVALID_PRODUCT_ID"
      );
    }

    if (
      Number.isNaN(
        requestedDesignId
      )
    ) {
      return jsonError(
        "design_id ไม่ถูกต้อง",
        400,
        "INVALID_DESIGN_ID"
      );
    }

    if (!size) {
      return jsonError(
        "กรุณาเลือก Size",
        400,
        "SIZE_REQUIRED"
      );
    }

    /* =====================================================
       3. ACTIVE SEASON
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
          is_active
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
        "CRAFT SEASON ERROR:",
        seasonError
      );

      return jsonError(
        "ไม่สามารถโหลดข้อมูล Season ได้",
        500,
        "SEASON_LOAD_FAILED"
      );
    }

    if (
      !seasonData
    ) {
      return jsonError(
        "DROP CLOSED — ไม่มี Season ที่เปิดใช้งานอยู่",
        403,
        "DROP_INACTIVE"
      );
    }

    const season =
      seasonData as
        ActiveSeason;

    /* =====================================================
       4. VALIDATE ODDS
    ===================================================== */

    const oddsValidation =
      validateSeasonOdds(
        season
      );

    if (
      !oddsValidation.ok
    ) {
      return jsonError(
        oddsValidation.message,
        500,
        "INVALID_SEASON_ODDS"
      );
    }

    /* =====================================================
       5. ENVIRONMENT
    ===================================================== */

    const environmentMode =
      await getEnvironmentMode();

    /* =====================================================
       6. PRODUCT

       NEW FLOW:
       Client sends product_id.

       LEGACY COMPATIBILITY:
       If product_id is missing,
       resolve Product from active Season product_name.
    ===================================================== */

    let product:
      | CatalogProduct
      | null =
        null;

    if (
      requestedProductId
    ) {
      const {
        data,
        error,
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
            "id",
            requestedProductId
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();

      if (
        error
      ) {
        console.error(
          "CRAFT PRODUCT ERROR:",
          error
        );

        return jsonError(
          "ไม่สามารถโหลด Product ได้",
          500,
          "PRODUCT_LOAD_FAILED"
        );
      }

      product =
        data as
          CatalogProduct | null;
    } else {
      const {
        data,
        error,
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
            "season",
            season.season_code
          )
          .eq(
            "name",
            season.product_name
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();

      if (
        error
      ) {
        console.error(
          "CRAFT LEGACY PRODUCT ERROR:",
          error
        );

        return jsonError(
          "ไม่สามารถหา Product ของ Season ได้",
          500,
          "PRODUCT_LOAD_FAILED"
        );
      }

      product =
        data as
          CatalogProduct | null;
    }

    if (!product) {
      return jsonError(
        "Product นี้ไม่พร้อมสำหรับ Craft",
        404,
        "PRODUCT_NOT_AVAILABLE"
      );
    }

    /* =====================================================
       7. PRODUCT MUST BELONG TO ACTIVE SEASON
    ===================================================== */

    if (
      String(
        product.season
      )
        .trim()
        .toUpperCase() !==
      String(
        season.season_code
      )
        .trim()
        .toUpperCase()
    ) {
      return jsonError(
        "Product ไม่ได้อยู่ใน Season ที่กำลังเปิด",
        400,
        "PRODUCT_SEASON_MISMATCH"
      );
    }

    /* =====================================================
       8. DESIGN

       NEW FLOW:
       Client sends design_id.

       LEGACY COMPATIBILITY:
       If design_id is missing, only allow Craft when
       the Product has exactly ONE active Design.
    ===================================================== */

    let design:
      | CatalogDesign
      | null =
        null;

    if (
      requestedDesignId
    ) {
      const {
        data,
        error,
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
          .eq(
            "id",
            requestedDesignId
          )
          .eq(
            "product_id",
            product.id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();

      if (
        error
      ) {
        console.error(
          "CRAFT DESIGN ERROR:",
          error
        );

        return jsonError(
          "ไม่สามารถโหลด Design ได้",
          500,
          "DESIGN_LOAD_FAILED"
        );
      }

      design =
        data as
          CatalogDesign | null;
    } else {
      const {
        data,
        error,
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
          .eq(
            "product_id",
            product.id
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
          )
          .limit(2);

      if (
        error
      ) {
        console.error(
          "CRAFT DESIGN LIST ERROR:",
          error
        );

        return jsonError(
          "ไม่สามารถโหลด Design ได้",
          500,
          "DESIGN_LOAD_FAILED"
        );
      }

      if (
        !data ||
        data.length ===
          0
      ) {
        return jsonError(
          "Product นี้ยังไม่มี Design ที่เปิด Craft",
          404,
          "NO_ACTIVE_DESIGN"
        );
      }

      if (
        data.length >
        1
      ) {
        return jsonError(
          "กรุณาเลือก Product และ Design ก่อน Craft",
          400,
          "CATALOG_SELECTION_REQUIRED"
        );
      }

      design =
        data[0] as
          CatalogDesign;
    }

    if (!design) {
      return jsonError(
        "Design นี้ไม่พร้อมสำหรับ Craft",
        404,
        "DESIGN_NOT_AVAILABLE"
      );
    }

    if (
      Number(
        design.product_id
      ) !==
      Number(
        product.id
      )
    ) {
      return jsonError(
        "Design ไม่ได้อยู่ภายใต้ Product นี้",
        400,
        "DESIGN_PRODUCT_MISMATCH"
      );
    }

    /* =====================================================
       9. SIZE FROM DESIGN
    ===================================================== */

    const availableSizes =
      normalizeSizes(
        design.available_sizes
      );

    if (
      !availableSizes.includes(
        size
      )
    ) {
      return jsonError(
        `Size ${size} ไม่เปิดใช้งานสำหรับ ${design.design_code}`,
        400,
        "SIZE_NOT_AVAILABLE",
        {
          available_sizes:
            availableSizes,
        }
      );
    }

    /* =====================================================
       10. CRAFT COST FROM DATABASE

       NEVER trust client price.
    ===================================================== */

    const craftCost =
      Number(
        design.craft_cost_lt
      );

    if (
      !Number.isInteger(
        craftCost
      ) ||
      craftCost < 0
    ) {
      return jsonError(
        "Craft Cost ของ Design ไม่ถูกต้อง",
        500,
        "INVALID_CRAFT_COST"
      );
    }

    /* =====================================================
       11. LOAD GRADE ASSETS

       THIS IS THE NEW STEP.

       product_designs.thumbnail_url = Design Preview

       product_design_grade_assets.thumbnail_url
         = actual Craft result artwork
    ===================================================== */

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
          thumbnail_path,
          model_url,
          model_path
          `
        )
        .eq(
          "design_id",
          design.id
        );

    if (
      gradeAssetError
    ) {
      console.error(
        "CRAFT GRADE ASSET ERROR:",
        gradeAssetError
      );

      return jsonError(
        "ไม่สามารถโหลด Grade Assets ได้",
        500,
        "GRADE_ASSET_LOAD_FAILED"
      );
    }

    const gradeAssets =
      (
        gradeAssetData ??
        []
      ) as GradeAsset[];

    const assetMap =
      new Map<
        Grade,
        GradeAsset
      >();

    for (
      const asset of
      gradeAssets
    ) {
      if (
        GRADES.includes(
          asset.grade
        )
      ) {
        assetMap.set(
          asset.grade,
          asset
        );
      }
    }

    /* =====================================================
       12. GRADE ASSET READINESS

       IMPORTANT:

       Validate ALL possible Grades BEFORE random roll.

       This prevents:
       - free rerolls
       - broken probability
       - creating Item without correct artwork
    ===================================================== */

    const requiredGrades =
      getRequiredGrades(
        season
      );

    const missingGrades =
      requiredGrades.filter(
        (
          grade
        ) => {
          const asset =
            assetMap.get(
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

    if (
      missingGrades.length >
      0
    ) {
      return jsonError(
        `Design ${design.design_code} ยังมี Grade Image ไม่ครบ: ${missingGrades.join(
          ", "
        )}`,
        409,
        "GRADE_ASSETS_INCOMPLETE",
        {
          product_id:
            product.id,

          design_id:
            design.id,

          design_code:
            design.design_code,

          missing_grades:
            missingGrades,

          required_grades:
            requiredGrades,
        }
      );
    }

    /* =====================================================
       13. WALLET
    ===================================================== */

    const {
      data:
        wallet,

      error:
        walletError,
    } =
      await supabaseAdmin
        .from(
          "wallets"
        )
        .select(
          `
          id,
          user_id,
          balance
          `
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      walletError
    ) {
      console.error(
        "CRAFT WALLET ERROR:",
        walletError
      );

      return jsonError(
        "ไม่สามารถโหลด Wallet ได้",
        500,
        "WALLET_LOAD_FAILED"
      );
    }

    if (!wallet) {
      return jsonError(
        "ไม่พบ Wallet ของ Player",
        404,
        "WALLET_NOT_FOUND"
      );
    }

    const currentBalance =
      Number(
        wallet.balance ??
        0
      );

    if (
      currentBalance <
      craftCost
    ) {
      return jsonError(
        `Loot Token ไม่พอ ต้องใช้ ${craftCost} LT`,
        400,
        "INSUFFICIENT_BALANCE",
        {
          required:
            craftCost,

          balance:
            currentBalance,
        }
      );
    }

    /* =====================================================
       14. SERVER RANDOM GRADE
    ===================================================== */

    const grade =
      rollGrade(
        season
      );

    /* =====================================================
       15. RESOLVE EXACT GRADE ASSET

       Example:

       Design D01
       Server rolls EPIC

       → D01 + EPIC
    ===================================================== */

    const gradeAsset =
      assetMap.get(
        grade
      );

    /*
      This should never happen because readiness validation
      already ran before the roll.

      Keep defensive protection anyway.
    */

    if (
      !gradeAsset ||
      !gradeAsset.thumbnail_url
    ) {
      console.error(
        "CRAFT GRADE ASSET MISSING AFTER VALIDATION:",
        {
          design_id:
            design.id,

          grade,
        }
      );

      return jsonError(
        `Grade Asset ${grade} ไม่พร้อม`,
        500,
        "GRADE_ASSET_NOT_READY"
      );
    }

    /* =====================================================
       16. GENERATE SERIAL

       Existing MVP allocator.

       TODO before high-concurrency LIVE:
       move serial allocation into atomic Postgres RPC.
    ===================================================== */

    const {
      data:
        latestItem,

      error:
        latestItemError,
    } =
      await supabaseAdmin
        .from(
          "items"
        )
        .select(
          "id"
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
      latestItemError
    ) {
      console.error(
        "CRAFT LATEST ITEM ERROR:",
        latestItemError
      );

      return jsonError(
        "ไม่สามารถสร้าง Item ID ได้",
        500,
        "SERIAL_GENERATION_FAILED"
      );
    }

    const nextNumber =
      Number(
        latestItem?.id ??
        0
      ) + 1;

    const serial =
      createSerial(
        season.season_code,
        nextNumber
      );

    const snapshotAt =
      new Date()
        .toISOString();

    /* =====================================================
       17. CREATE ITEM

       IMPORTANT:

       Design Preview:
         design.thumbnail_url
         design.model_url

       ARE NOT used for result snapshots anymore.

       Result Snapshot:
         gradeAsset.thumbnail_url
         gradeAsset.model_url
    ===================================================== */

    const {
      data:
        newItem,

      error:
        itemError,
    } =
      await supabaseAdmin
        .from(
          "items"
        )
        .insert({
          /* -----------------------------------------------
             LEGACY / CORE IDENTITY
          ----------------------------------------------- */

          serial,

          product:
            product.name,

          season:
            season.season_code,

          product_id:
            product.id,

          design_id:
            design.id,

          grade,

          level:
            0,

          size,

          owner_id:
            user.id,

          /* -----------------------------------------------
             PRODUCTION
          ----------------------------------------------- */

          production_status:
            "CRAFTED",

          production_updated_at:
            snapshotAt,

          /* -----------------------------------------------
             ENVIRONMENT
          ----------------------------------------------- */

          environment_mode:
            environmentMode,

          /* -----------------------------------------------
             CATALOG SNAPSHOT
          ----------------------------------------------- */

          product_code_snapshot:
            product.code,

          product_name_snapshot:
            product.name,

          design_code_snapshot:
            design.design_code,

          design_name_snapshot:
            design.name,

          season_snapshot:
            season.season_code,

          category_snapshot:
            product.category,

          equip_slot_snapshot:
            product.equip_slot,

          craft_cost_lt_snapshot:
            craftCost,

          /*
            NEW BEHAVIOR:

            These are now Grade-specific Assets.
          */

          thumbnail_url_snapshot:
            gradeAsset.thumbnail_url,

          model_url_snapshot:
            gradeAsset.model_url ??
            null,

          catalog_snapshot_at:
            snapshotAt,
        })
        .select(
          `
          id,
          serial,
          product,
          season,

          product_id,
          design_id,

          grade,
          level,
          size,

          owner_id,

          production_status,
          tracking_number,
          production_updated_at,

          environment_mode,

          product_code_snapshot,
          product_name_snapshot,
          design_code_snapshot,
          design_name_snapshot,
          season_snapshot,
          category_snapshot,
          equip_slot_snapshot,
          craft_cost_lt_snapshot,
          thumbnail_url_snapshot,
          model_url_snapshot,
          catalog_snapshot_at,

          created_at
          `
        )
        .single();

    if (
      itemError ||
      !newItem
    ) {
      console.error(
        "CRAFT ITEM ERROR:",
        itemError
      );

      return jsonError(
        "สร้าง Item ไม่สำเร็จ",
        500,
        "ITEM_CREATE_FAILED"
      );
    }

    /* =====================================================
       18. UPDATE WALLET
    ===================================================== */

    const newBalance =
      currentBalance -
      craftCost;

    const {
      data:
        updatedWallet,

      error:
        walletUpdateError,
    } =
      await supabaseAdmin
        .from(
          "wallets"
        )
        .update({
          balance:
            newBalance,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "user_id",
          user.id
        )
        .select(
          `
          id,
          user_id,
          balance,
          updated_at
          `
        )
        .single();

    if (
      walletUpdateError ||
      !updatedWallet
    ) {
      console.error(
        "CRAFT WALLET UPDATE ERROR:",
        walletUpdateError
      );

      /*
        Current compatibility rollback.

        Before LIVE at scale this should become ONE atomic
        Postgres RPC transaction.
      */

      const {
        error:
          rollbackError,
      } =
        await supabaseAdmin
          .from(
            "items"
          )
          .delete()
          .eq(
            "id",
            newItem.id
          )
          .eq(
            "owner_id",
            user.id
          );

      if (
        rollbackError
      ) {
        console.error(
          "CRAFT ITEM ROLLBACK ERROR:",
          rollbackError
        );
      }

      return jsonError(
        "เกิดข้อผิดพลาดในการหัก Token กรุณาติดต่อ Admin",
        500,
        "WALLET_UPDATE_FAILED"
      );
    }

    /* =====================================================
       19. WALLET LEDGER
    ===================================================== */

    const {
      error:
        transactionError,
    } =
      await supabaseAdmin
        .from(
          "wallet_transactions"
        )
        .insert({
          user_id:
            user.id,

          type:
            "CRAFT",

          amount:
            -craftCost,

          description:
            [
              "CRAFT",
              product.name,
              design.design_code,
              season.season_code,
              grade,
              size,
              serial,
            ].join(
              " / "
            ),

          item_id:
            newItem.id,

          environment_mode:
            environmentMode,
        });

    if (
      transactionError
    ) {
      /*
        Current legacy behavior:
        Item + wallet remain successful.

        Before LIVE, move:
        Item creation
        + wallet deduction
        + ledger

        into one Postgres transaction/RPC.
      */

      console.error(
        "CRAFT WALLET TRANSACTION ERROR:",
        transactionError
      );
    }

    /* =====================================================
       20. SUCCESS
    ===================================================== */

    return NextResponse.json(
      {
        success:
          true,

        item:
          newItem,

        wallet:
          updatedWallet,

        environment:
          environmentMode,

        craft: {
          cost:
            craftCost,

          grade,

          size,

          season:
            season.season_code,

          season_name:
            season.season_name,

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

            code:
              design.design_code,

            name:
              design.name,
          },

          /*
            Useful for debugging/admin testing.
          */

          grade_asset: {
            id:
              gradeAsset.id,

            grade:
              gradeAsset.grade,

            thumbnail_url:
              gradeAsset.thumbnail_url,

            model_url:
              gradeAsset.model_url ??
              null,
          },
        },

        odds:
          getSeasonOdds(
            season
          ),
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
      "CRAFT API ERROR:",
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : "Craft failed",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}