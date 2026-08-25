import {
  NextResponse,
} from "next/server";

import {
  randomInt,
  randomUUID,
} from "node:crypto";

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

type AtomicCraftItem =
  Record<
    string,
    unknown
  > & {
    grade?: unknown;
    thumbnail_url_snapshot?: unknown;
    model_url_snapshot?: unknown;
  };

type AtomicCraftWallet =
  Record<
    string,
    unknown
  > & {
    balance?: unknown;
  };

type AtomicCraftRpcResult = {
  item?: AtomicCraftItem;
  wallet?: AtomicCraftWallet;
  request_id?: string;
  idempotent_replay?: boolean;
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

function isUuid(
  value: string
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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
    randomInt(
      0,
      1_000_000
    ) /
    10_000;

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

    const rawRequestId =
      typeof body?.request_id ===
      "string"
        ? body.request_id
            .trim()
        : "";

    if (
      rawRequestId &&
      !isUuid(
        rawRequestId
      )
    ) {
      return jsonError(
        "request_id ไม่ถูกต้อง",
        400,
        "INVALID_REQUEST_ID"
      );
    }

    const requestId =
      rawRequestId ||
      randomUUID();

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
       16. ATOMIC CRAFT TRANSACTION

       PostgreSQL RPC is the authority for:
       - idempotency
       - wallet row lock / balance deduction
       - serial allocation
       - item insert
       - wallet ledger insert

       No unsafe application-level rollback fallback is used.
    ===================================================== */

    const {
      data:
        atomicDataRaw,

      error:
        atomicError,
    } =
      await supabaseAdmin
        .rpc(
          "lootform_craft_atomic",
          {
            p_request_id:
              requestId,

            p_user_id:
              user.id,

            p_product_id:
              product.id,

            p_design_id:
              design.id,

            p_product_code:
              product.code,

            p_product_name:
              product.name,

            p_design_code:
              design.design_code,

            p_design_name:
              design.name,

            p_season_code:
              season.season_code,

            p_category:
              product.category,

            p_equip_slot:
              product.equip_slot,

            p_size:
              size,

            p_craft_cost:
              craftCost,

            p_grade:
              grade,

            p_thumbnail_url:
              gradeAsset.thumbnail_url,

            p_model_url:
              gradeAsset.model_url ??
              null,

            p_environment_mode:
              environmentMode,
          }
        );

    if (
      atomicError
    ) {
      const atomicMessage =
        String(
          atomicError.message ??
          ""
        );

      console.error(
        "CRAFT ATOMIC RPC ERROR:",
        atomicError
      );

      if (
        atomicMessage.includes(
          "LOOTFORM_INSUFFICIENT_BALANCE"
        )
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

      if (
        atomicMessage.includes(
          "LOOTFORM_WALLET_NOT_FOUND"
        )
      ) {
        return jsonError(
          "ไม่พบ Wallet ของ Player",
          404,
          "WALLET_NOT_FOUND"
        );
      }

      if (
        atomicMessage.includes(
          "LOOTFORM_REQUEST_ID_CONFLICT"
        ) ||
        atomicMessage.includes(
          "LOOTFORM_REQUEST_ID_PAYLOAD_MISMATCH"
        )
      ) {
        return jsonError(
          "Craft request ซ้ำแต่ข้อมูลไม่ตรงกัน กรุณาเริ่ม Craft ใหม่",
          409,
          "CRAFT_REQUEST_CONFLICT"
        );
      }

      return jsonError(
        "Atomic Craft transaction ไม่พร้อม กรุณาตรวจ Supabase migration ก่อน Deploy",
        503,
        "ATOMIC_CRAFT_NOT_READY"
      );
    }

    const atomicData =
      atomicDataRaw as
        | AtomicCraftRpcResult
        | null;

    const newItem =
      atomicData?.item;

    const updatedWallet =
      atomicData?.wallet;

    if (
      !newItem ||
      !updatedWallet
    ) {
      return jsonError(
        "Atomic Craft transaction ส่งผลลัพธ์ไม่ครบ",
        500,
        "ATOMIC_CRAFT_INVALID_RESPONSE"
      );
    }

    const committedGradeRaw =
      String(
        newItem.grade ??
        grade
      )
        .trim()
        .toUpperCase();

    const committedGrade =
      GRADES.includes(
        committedGradeRaw as
          Grade
      )
        ? committedGradeRaw as
            Grade
        : grade;

    const committedGradeAsset =
      assetMap.get(
        committedGrade
      );

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

          grade:
            committedGrade,

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
              committedGradeAsset?.id ??
              null,

            grade:
              committedGrade,

            thumbnail_url:
              String(
                newItem.thumbnail_url_snapshot ??
                committedGradeAsset?.thumbnail_url ??
                ""
              ),

            model_url:
              newItem.model_url_snapshot ??
              committedGradeAsset?.model_url ??
              null,
          },
        },

        request_id:
          atomicData?.request_id ??
          requestId,

        idempotent_replay:
          atomicData?.idempotent_replay ===
          true,

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