import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

/* =========================================================
   TYPES
========================================================= */

type ProductCategory =
  | "TEE"
  | "HOODIE"
  | "JACKET"
  | "PANTS"
  | "CAP"
  | "SHOES"
  | "ACCESSORY";

type EquipSlot =
  | "HEAD"
  | "TOP"
  | "BOTTOM"
  | "SHOES"
  | "ACCESSORY";

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

type CraftStatsRow = {
  design_id: number;

  total_crafted_count:
    | number
    | string
    | null;

  test_crafted_count:
    | number
    | string
    | null;

  live_crafted_count:
    | number
    | string
    | null;

  legacy_crafted_count:
    | number
    | string
    | null;

  protected_crafted_count:
    | number
    | string
    | null;

  identity_locked:
    | boolean
    | null;
};

/* =========================================================
   CONSTANTS
========================================================= */

const VALID_CATEGORIES: ProductCategory[] = [
  "TEE",
  "HOODIE",
  "JACKET",
  "PANTS",
  "CAP",
  "SHOES",
  "ACCESSORY",
];

const VALID_EQUIP_SLOTS: EquipSlot[] = [
  "HEAD",
  "TOP",
  "BOTTOM",
  "SHOES",
  "ACCESSORY",
];

const VALID_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "FREE",
];

/* =========================================================
   RESPONSE HELPERS
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
   TEXT HELPERS
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

function cleanOptionalText(
  value: unknown
) {
  const text =
    cleanText(value);

  return text
    ? text
    : null;
}

function normalizeCode(
  value: unknown
) {
  return cleanText(value)
    .toUpperCase()
    .replace(
      /\s+/g,
      "-"
    );
}

function normalizeSizes(
  value: unknown
) {
  if (
    !Array.isArray(value)
  ) {
    return [
      "S",
      "M",
      "L",
      "XL",
      "XXL",
    ];
  }

  const sizes =
    value
      .map((item) =>
        cleanText(
          item
        ).toUpperCase()
      )
      .filter((item) =>
        VALID_SIZES.includes(
          item
        )
      );

  return Array.from(
    new Set(
      sizes
    )
  );
}

function safeCount(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    ) ||
    number < 0
  ) {
    return 0;
  }

  return Math.floor(
    number
  );
}

/* =========================================================
   IDENTITY HELPERS
========================================================= */

function sameText(
  left: unknown,
  right: unknown
) {
  return (
    cleanText(left) ===
    cleanText(right)
  );
}

function sameUpperText(
  left: unknown,
  right: unknown
) {
  return (
    cleanText(left).toUpperCase() ===
    cleanText(right).toUpperCase()
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
   PROTECTION CHECK

   Protected:
   - LIVE
   - NULL / LEGACY
   - Future non-TEST modes

   TEST:
   - NEVER locks identity
========================================================= */

async function productHasProtectedItem(
  productId: number
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "items"
      )
      .select(
        "id"
      )
      .eq(
        "product_id",
        productId
      )
      .or(
        "environment_mode.neq.TEST,environment_mode.is.null"
      )
      .limit(1);

  if (error) {
    console.error(
      "PRODUCT PROTECTION CHECK ERROR:",
      error
    );

    throw new Error(
      error.message
    );
  }

  return (
    data?.length ?? 0
  ) > 0;
}

async function designHasProtectedItem(
  designId: number
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "items"
      )
      .select(
        "id"
      )
      .eq(
        "design_id",
        designId
      )
      .or(
        "environment_mode.neq.TEST,environment_mode.is.null"
      )
      .limit(1);

  if (error) {
    console.error(
      "DESIGN PROTECTION CHECK ERROR:",
      error
    );

    throw new Error(
      error.message
    );
  }

  return (
    data?.length ?? 0
  ) > 0;
}

/* =========================================================
   GET
   PRODUCTS + DESIGNS + CRAFT STATS
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

    /* -----------------------------------------------------
       PRODUCTS
    ----------------------------------------------------- */

    const {
      data:
        products,

      error:
        productsError,
    } =
      await supabaseAdmin
        .from(
          "products"
        )
        .select("*")
        .order(
          "id",
          {
            ascending:
              true,
          }
        );

    if (
      productsError
    ) {
      console.error(
        "PRODUCTS GET ERROR:",
        productsError
      );

      return jsonError(
        productsError.message,
        500
      );
    }

    /* -----------------------------------------------------
       DESIGNS
    ----------------------------------------------------- */

    const {
      data:
        designs,

      error:
        designsError,
    } =
      await supabaseAdmin
        .from(
          "product_designs"
        )
        .select("*")
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
      designsError
    ) {
      console.error(
        "PRODUCT DESIGNS GET ERROR:",
        designsError
      );

      return jsonError(
        designsError.message,
        500
      );
    }

    /* -----------------------------------------------------
       CRAFT STATS
    ----------------------------------------------------- */

    const {
      data:
        craftStats,

      error:
        craftStatsError,
    } =
      await supabaseAdmin
        .from(
          "product_design_craft_stats"
        )
        .select(
          `
          design_id,
          total_crafted_count,
          test_crafted_count,
          live_crafted_count,
          legacy_crafted_count,
          protected_crafted_count,
          identity_locked
          `
        );

    if (
      craftStatsError
    ) {
      console.error(
        "PRODUCT CRAFT STATS GET ERROR:",
        craftStatsError
      );

      return jsonError(
        craftStatsError.message,
        500
      );
    }

    /* -----------------------------------------------------
       BUILD STATS MAP
    ----------------------------------------------------- */

    const statsMap =
      new Map<
        number,
        {
          total_crafted_count:
            number;

          test_crafted_count:
            number;

          live_crafted_count:
            number;

          legacy_crafted_count:
            number;

          protected_crafted_count:
            number;

          identity_locked:
            boolean;
        }
      >();

    for (
      const rawStats of
      (
        craftStats ??
        []
      ) as CraftStatsRow[]
    ) {
      statsMap.set(
        Number(
          rawStats.design_id
        ),
        {
          total_crafted_count:
            safeCount(
              rawStats.total_crafted_count
            ),

          test_crafted_count:
            safeCount(
              rawStats.test_crafted_count
            ),

          live_crafted_count:
            safeCount(
              rawStats.live_crafted_count
            ),

          legacy_crafted_count:
            safeCount(
              rawStats.legacy_crafted_count
            ),

          protected_crafted_count:
            safeCount(
              rawStats.protected_crafted_count
            ),

          identity_locked:
            rawStats.identity_locked ===
            true,
        }
      );
    }

    /* -----------------------------------------------------
       DESIGNS + STATS
    ----------------------------------------------------- */

    const designsWithStats =
      (
        designs ??
        []
      ).map(
        (design) => {
          const stats =
            statsMap.get(
              design.id
            );

          return {
            ...design,

            total_crafted_count:
              stats?.total_crafted_count ??
              0,

            test_crafted_count:
              stats?.test_crafted_count ??
              0,

            live_crafted_count:
              stats?.live_crafted_count ??
              0,

            legacy_crafted_count:
              stats?.legacy_crafted_count ??
              0,

            protected_crafted_count:
              stats?.protected_crafted_count ??
              0,

            identity_locked:
              stats?.identity_locked ??
              false,
          };
        }
      );

    /* -----------------------------------------------------
       CATALOG
    ----------------------------------------------------- */

    const catalog =
      (
        products ??
        []
      ).map(
        (product) => {
          const productDesigns =
            designsWithStats.filter(
              (design) =>
                design.product_id ===
                product.id
            );

          const productProtectedCount =
            productDesigns.reduce(
              (
                total,
                design
              ) =>
                total +
                safeCount(
                  design.protected_crafted_count
                ),
              0
            );

          return {
            ...product,

            protected_crafted_count:
              productProtectedCount,

            identity_locked:
              productProtectedCount >
              0,

            designs:
              productDesigns,
          };
        }
      );

    return NextResponse.json({
      ok: true,
      catalog,
    });
  } catch (error) {
    console.error(
      "ADMIN PRODUCTS GET ERROR:",
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
   POST
   CREATE PRODUCT / DESIGN

   NEW DATA ALWAYS STARTS AS DRAFT
========================================================= */

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

    const body =
      await request.json();

    const action =
      cleanText(
        body?.action
      );

    /* =====================================================
       CREATE PRODUCT
    ===================================================== */

    if (
      action ===
      "create_product"
    ) {
      const code =
        normalizeCode(
          body?.code
        );

      const name =
        cleanText(
          body?.name
        );

      const category =
        cleanText(
          body?.category
        ).toUpperCase() as ProductCategory;

      const equipSlot =
        cleanText(
          body?.equip_slot
        ).toUpperCase() as EquipSlot;

      const season =
        cleanText(
          body?.season
        ).toUpperCase();

      const description =
        cleanOptionalText(
          body?.description
        );

      if (!code) {
        return jsonError(
          "Product code is required"
        );
      }

      if (!name) {
        return jsonError(
          "Product name is required"
        );
      }

      if (
        !VALID_CATEGORIES.includes(
          category
        )
      ) {
        return jsonError(
          "Invalid product category"
        );
      }

      if (
        !VALID_EQUIP_SLOTS.includes(
          equipSlot
        )
      ) {
        return jsonError(
          "Invalid equip slot"
        );
      }

      if (!season) {
        return jsonError(
          "Season is required"
        );
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "products"
          )
          .insert({
            code,
            name,
            category,

            equip_slot:
              equipSlot,

            season,
            description,

            is_active:
              false,
          })
          .select("*")
          .single();

      if (error) {
        console.error(
          "CREATE PRODUCT ERROR:",
          error
        );

        if (
          error.code ===
          "23505"
        ) {
          return jsonError(
            "Product code already exists",
            409
          );
        }

        return jsonError(
          error.message,
          500
        );
      }

      return NextResponse.json({
        ok: true,

        action:
          "create_product",

        status:
          "DRAFT",

        product:
          data,
      });
    }

    /* =====================================================
       CREATE DESIGN
    ===================================================== */

    if (
      action ===
      "create_design"
    ) {
      const productId =
        Number(
          body?.product_id
        );

      const designCode =
        normalizeCode(
          body?.design_code
        );

      const name =
        cleanText(
          body?.name
        );

      const craftCost =
        Number(
          body?.craft_cost_lt
        );

      const thumbnailUrl =
        cleanOptionalText(
          body?.thumbnail_url
        );

      const modelUrl =
        cleanOptionalText(
          body?.model_url
        );

      const sizes =
        normalizeSizes(
          body?.available_sizes
        );

      const sortOrder =
        Number.isFinite(
          Number(
            body?.sort_order
          )
        )
          ? Number(
              body?.sort_order
            )
          : 0;

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

      if (!designCode) {
        return jsonError(
          "Design code is required"
        );
      }

      if (!name) {
        return jsonError(
          "Design name is required"
        );
      }

      if (
        !Number.isInteger(
          craftCost
        ) ||
        craftCost < 0
      ) {
        return jsonError(
          "Craft cost must be 0 or greater"
        );
      }

      if (
        sizes.length ===
        0
      ) {
        return jsonError(
          "At least one size is required"
        );
      }

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
            "id, name, is_active"
          )
          .eq(
            "id",
            productId
          )
          .maybeSingle();

      if (
        productError
      ) {
        return jsonError(
          productError.message,
          500
        );
      }

      if (
        !existingProduct
      ) {
        return jsonError(
          "Product not found",
          404
        );
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "product_designs"
          )
          .insert({
            product_id:
              productId,

            design_code:
              designCode,

            name,

            craft_cost_lt:
              craftCost,

            thumbnail_url:
              thumbnailUrl,

            model_url:
              modelUrl,

            available_sizes:
              sizes,

            sort_order:
              sortOrder,

            is_active:
              false,
          })
          .select("*")
          .single();

      if (error) {
        console.error(
          "CREATE DESIGN ERROR:",
          error
        );

        if (
          error.code ===
          "23505"
        ) {
          return jsonError(
            "Design code already exists for this product",
            409
          );
        }

        return jsonError(
          error.message,
          500
        );
      }

      return NextResponse.json({
        ok: true,

        action:
          "create_design",

        status:
          "DRAFT",

        product_active:
          existingProduct.is_active,

        design: {
          ...data,

          total_crafted_count:
            0,

          test_crafted_count:
            0,

          live_crafted_count:
            0,

          legacy_crafted_count:
            0,

          protected_crafted_count:
            0,

          identity_locked:
            false,
        },
      });
    }

    return jsonError(
      "Unknown action"
    );
  } catch (error) {
    console.error(
      "ADMIN PRODUCTS POST ERROR:",
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

   IDENTITY PROTECTION RULE

   PRODUCT:
   - code
   - season
   - category
   - equip_slot

   DESIGN:
   - design_code

   TEST ITEMS DO NOT LOCK.
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

    const action =
      cleanText(
        body?.action
      );

    /* =====================================================
       UPDATE PRODUCT
    ===================================================== */

    if (
      action ===
      "update_product"
    ) {
      const productId =
        Number(
          body?.product_id
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

      /* ---------------------------------------------------
         LOAD CURRENT PRODUCT

         Needed so unchanged locked fields
         can still be sent by the Admin form.
      --------------------------------------------------- */

      const {
        data:
          currentProduct,

        error:
          currentProductError,
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
            productId
          )
          .maybeSingle();

      if (
        currentProductError
      ) {
        console.error(
          "LOAD CURRENT PRODUCT ERROR:",
          currentProductError
        );

        return jsonError(
          currentProductError.message,
          500
        );
      }

      if (
        !currentProduct
      ) {
        return jsonError(
          "Product not found",
          404
        );
      }

      const updateData: Record<
        string,
        unknown
      > = {};

      const identityChanges:
        string[] = [];

      /* ---------------------------------------------------
         PRODUCT CODE
         LOCKED AFTER PROTECTED CRAFT
      --------------------------------------------------- */

      if (
        body?.code !==
        undefined
      ) {
        const code =
          normalizeCode(
            body.code
          );

        if (!code) {
          return jsonError(
            "Product code cannot be empty"
          );
        }

        if (
          !sameUpperText(
            code,
            currentProduct.code
          )
        ) {
          identityChanges.push(
            "Product Code"
          );
        }

        updateData.code =
          code;
      }

      /* ---------------------------------------------------
         PRODUCT NAME
         SAFE FIELD
      --------------------------------------------------- */

      if (
        body?.name !==
        undefined
      ) {
        const name =
          cleanText(
            body.name
          );

        if (!name) {
          return jsonError(
            "Product name cannot be empty"
          );
        }

        updateData.name =
          name;
      }

      /* ---------------------------------------------------
         CATEGORY
         LOCKED AFTER PROTECTED CRAFT
      --------------------------------------------------- */

      if (
        body?.category !==
        undefined
      ) {
        const category =
          cleanText(
            body.category
          ).toUpperCase() as ProductCategory;

        if (
          !VALID_CATEGORIES.includes(
            category
          )
        ) {
          return jsonError(
            "Invalid product category"
          );
        }

        if (
          !sameUpperText(
            category,
            currentProduct.category
          )
        ) {
          identityChanges.push(
            "Category"
          );
        }

        updateData.category =
          category;
      }

      /* ---------------------------------------------------
         EQUIP SLOT
         LOCKED AFTER PROTECTED CRAFT
      --------------------------------------------------- */

      if (
        body?.equip_slot !==
        undefined
      ) {
        const equipSlot =
          cleanText(
            body.equip_slot
          ).toUpperCase() as EquipSlot;

        if (
          !VALID_EQUIP_SLOTS.includes(
            equipSlot
          )
        ) {
          return jsonError(
            "Invalid equip slot"
          );
        }

        if (
          !sameUpperText(
            equipSlot,
            currentProduct.equip_slot
          )
        ) {
          identityChanges.push(
            "Equip Slot"
          );
        }

        updateData.equip_slot =
          equipSlot;
      }

      /* ---------------------------------------------------
         SEASON
         LOCKED AFTER PROTECTED CRAFT
      --------------------------------------------------- */

      if (
        body?.season !==
        undefined
      ) {
        const season =
          cleanText(
            body.season
          ).toUpperCase();

        if (!season) {
          return jsonError(
            "Season cannot be empty"
          );
        }

        if (
          !sameUpperText(
            season,
            currentProduct.season
          )
        ) {
          identityChanges.push(
            "Season"
          );
        }

        updateData.season =
          season;
      }

      /* ---------------------------------------------------
         DESCRIPTION
         SAFE FIELD
      --------------------------------------------------- */

      if (
        body?.description !==
        undefined
      ) {
        updateData.description =
          cleanOptionalText(
            body.description
          );
      }

      /* ---------------------------------------------------
         PUBLISH / HIDE
         ALWAYS ALLOWED
      --------------------------------------------------- */

      if (
        body?.is_active !==
        undefined
      ) {
        if (
          typeof body.is_active !==
          "boolean"
        ) {
          return jsonError(
            "is_active must be boolean"
          );
        }

        updateData.is_active =
          body.is_active;
      }

      /* ---------------------------------------------------
         CHECK PRODUCT IDENTITY LOCK

         Only do this if an identity value
         is ACTUALLY changing.

         Sending the same Product Code again
         is allowed.
      --------------------------------------------------- */

      if (
        identityChanges.length >
        0
      ) {
        const identityLocked =
          await productHasProtectedItem(
            productId
          );

        if (
          identityLocked
        ) {
          return jsonError(
            `Product identity is locked because a LIVE or protected collectible exists. Cannot change: ${identityChanges.join(
              ", "
            )}. Create a new Product/Design for a new collectible identity.`,
            409
          );
        }
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

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "products"
          )
          .update(
            updateData
          )
          .eq(
            "id",
            productId
          )
          .select("*")
          .maybeSingle();

      if (error) {
        console.error(
          "UPDATE PRODUCT ERROR:",
          error
        );

        if (
          error.code ===
          "23505"
        ) {
          return jsonError(
            "Product code already exists",
            409
          );
        }

        return jsonError(
          error.message,
          500
        );
      }

      if (!data) {
        return jsonError(
          "Product not found",
          404
        );
      }

      return NextResponse.json({
        ok: true,

        action:
          "update_product",

        status:
          data.is_active
            ? "PUBLISHED"
            : "DRAFT",

        product:
          data,
      });
    }

    /* =====================================================
       UPDATE DESIGN
    ===================================================== */

    if (
      action ===
      "update_design"
    ) {
      const designId =
        Number(
          body?.design_id
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

      /* ---------------------------------------------------
         LOAD CURRENT DESIGN
      --------------------------------------------------- */

      const {
        data:
          currentDesign,

        error:
          currentDesignError,
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
            designId
          )
          .maybeSingle();

      if (
        currentDesignError
      ) {
        console.error(
          "LOAD CURRENT DESIGN ERROR:",
          currentDesignError
        );

        return jsonError(
          currentDesignError.message,
          500
        );
      }

      if (
        !currentDesign
      ) {
        return jsonError(
          "Design not found",
          404
        );
      }

      const updateData: Record<
        string,
        unknown
      > = {};

      let designCodeChanged =
        false;

      /* ---------------------------------------------------
         DESIGN CODE
         LOCKED AFTER PROTECTED CRAFT
      --------------------------------------------------- */

      if (
        body?.design_code !==
        undefined
      ) {
        const designCode =
          normalizeCode(
            body.design_code
          );

        if (
          !designCode
        ) {
          return jsonError(
            "Design code cannot be empty"
          );
        }

        designCodeChanged =
          !sameUpperText(
            designCode,
            currentDesign.design_code
          );

        updateData.design_code =
          designCode;
      }

      /* ---------------------------------------------------
         DESIGN NAME
         CURRENTLY SAFE FIELD
      --------------------------------------------------- */

      if (
        body?.name !==
        undefined
      ) {
        const name =
          cleanText(
            body.name
          );

        if (!name) {
          return jsonError(
            "Design name cannot be empty"
          );
        }

        updateData.name =
          name;
      }

      /* ---------------------------------------------------
         CRAFT COST
         SAFE FIELD
      --------------------------------------------------- */

      if (
        body?.craft_cost_lt !==
        undefined
      ) {
        const craftCost =
          Number(
            body.craft_cost_lt
          );

        if (
          !Number.isInteger(
            craftCost
          ) ||
          craftCost < 0
        ) {
          return jsonError(
            "Craft cost must be 0 or greater"
          );
        }

        updateData.craft_cost_lt =
          craftCost;
      }

      /* ---------------------------------------------------
         IMAGE
         CURRENTLY EDITABLE

         Historical asset snapshot will be added
         before LIVE Craft rollout.
      --------------------------------------------------- */

      if (
        body?.thumbnail_url !==
        undefined
      ) {
        updateData.thumbnail_url =
          cleanOptionalText(
            body.thumbnail_url
          );
      }

      /* ---------------------------------------------------
         MODEL
         CURRENTLY EDITABLE

         Historical asset snapshot will be added
         before LIVE Craft rollout.
      --------------------------------------------------- */

      if (
        body?.model_url !==
        undefined
      ) {
        updateData.model_url =
          cleanOptionalText(
            body.model_url
          );
      }

      /* ---------------------------------------------------
         SIZES
         SAFE FOR CURRENT CATALOG CONTROL
      --------------------------------------------------- */

      if (
        body?.available_sizes !==
        undefined
      ) {
        const sizes =
          normalizeSizes(
            body.available_sizes
          );

        if (
          sizes.length ===
          0
        ) {
          return jsonError(
            "At least one size is required"
          );
        }

        updateData.available_sizes =
          sizes;
      }

      /* ---------------------------------------------------
         SORT ORDER
      --------------------------------------------------- */

      if (
        body?.sort_order !==
        undefined
      ) {
        const sortOrder =
          Number(
            body.sort_order
          );

        if (
          !Number.isInteger(
            sortOrder
          )
        ) {
          return jsonError(
            "sort_order must be an integer"
          );
        }

        updateData.sort_order =
          sortOrder;
      }

      /* ---------------------------------------------------
         PUBLISH / HIDE
         ALWAYS ALLOWED
      --------------------------------------------------- */

      if (
        body?.is_active !==
        undefined
      ) {
        if (
          typeof body.is_active !==
          "boolean"
        ) {
          return jsonError(
            "is_active must be boolean"
          );
        }

        updateData.is_active =
          body.is_active;
      }

      /* ---------------------------------------------------
         DESIGN IDENTITY LOCK
      --------------------------------------------------- */

      if (
        designCodeChanged
      ) {
        const identityLocked =
          await designHasProtectedItem(
            designId
          );

        if (
          identityLocked
        ) {
          return jsonError(
            "Design identity is locked because a LIVE or protected collectible exists. Design Code cannot be changed. Create a new Design such as D02 instead.",
            409
          );
        }
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

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "product_designs"
          )
          .update(
            updateData
          )
          .eq(
            "id",
            designId
          )
          .select("*")
          .maybeSingle();

      if (error) {
        console.error(
          "UPDATE DESIGN ERROR:",
          error
        );

        if (
          error.code ===
          "23505"
        ) {
          return jsonError(
            "Design code already exists for this product",
            409
          );
        }

        return jsonError(
          error.message,
          500
        );
      }

      if (!data) {
        return jsonError(
          "Design not found",
          404
        );
      }

      return NextResponse.json({
        ok: true,

        action:
          "update_design",

        status:
          data.is_active
            ? "PUBLISHED"
            : "DRAFT",

        design:
          data,
      });
    }

    return jsonError(
      "Unknown action"
    );
  } catch (error) {
    console.error(
      "ADMIN PRODUCTS PATCH ERROR:",
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