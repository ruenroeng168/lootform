import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

// =====================================
// TYPES
// =====================================

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

  product_name: string;

  craft_cost: number;

  common_rate: number;
  rare_rate: number;
  epic_rate: number;
  legendary_rate: number;

  is_active: boolean;
};

// =====================================
// CONFIG
// =====================================

const allowedSizes = [
  "S",
  "M",
  "L",
  "XL",
  "XXL",
];

// =====================================
// RANDOM GRADE
// =====================================

function rollGrade(
  season: ActiveSeason
): Grade {
  const roll =
    Math.random() * 100;

  const commonEnd =
    season.common_rate;

  const rareEnd =
    commonEnd +
    season.rare_rate;

  const epicEnd =
    rareEnd +
    season.epic_rate;

  if (
    roll <
    commonEnd
  ) {
    return "COMMON";
  }

  if (
    roll <
    rareEnd
  ) {
    return "RARE";
  }

  if (
    roll <
    epicEnd
  ) {
    return "EPIC";
  }

  return "LEGENDARY";
}

// =====================================
// SERIAL
// =====================================

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

// =====================================
// LOAD SYSTEM MODE
// =====================================

async function getSystemMode(): Promise<
  EnvironmentMode
> {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "system_settings"
      )
      .select(`
        environment_mode
      `)
      .eq(
        "id",
        1
      )
      .maybeSingle();

  if (error) {
    console.error(
      "SYSTEM MODE ERROR:",
      error
    );

    throw new Error(
      "SYSTEM_MODE_LOAD_FAILED"
    );
  }

  if (!data) {
    throw new Error(
      "SYSTEM_SETTINGS_NOT_FOUND"
    );
  }

  const mode =
    String(
      data.environment_mode ??
        ""
    ).toUpperCase();

  if (
    mode !== "TEST" &&
    mode !== "LIVE"
  ) {
    throw new Error(
      "INVALID_SYSTEM_MODE"
    );
  }

  return mode as EnvironmentMode;
}

// =====================================
// POST /api/craft
// =====================================

export async function POST(
  request: Request
) {
  try {
    // =====================================
    // AUTHORIZATION
    // =====================================

    const authHeader =
      request.headers.get(
        "authorization"
      );

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "กรุณา Login ก่อน Craft",
        },
        {
          status: 401,
        }
      );
    }

    const token =
      authHeader.replace(
        "Bearer ",
        ""
      );

    const {
      data: { user },
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        token
      );

    if (
      userError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Session หมดอายุ กรุณา Login ใหม่",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================
    // LOAD SYSTEM MODE
    // =====================================

    let environmentMode:
      EnvironmentMode;

    try {
      environmentMode =
        await getSystemMode();
    } catch (error) {
      console.error(
        "CRAFT SYSTEM MODE ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,

          code:
            "SYSTEM_MODE_ERROR",

          message:
            "ไม่สามารถตรวจสอบ System Mode ได้ กรุณาติดต่อ Admin",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================
    // REQUEST BODY
    // =====================================

    const body =
      await request.json();

    const size =
      String(
        body.size ??
          ""
      ).toUpperCase();

    if (
      !allowedSizes.includes(
        size
      )
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "กรุณาเลือก Size ที่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // LOAD ACTIVE SEASON
    // =====================================

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
        .select(`
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
        `)
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

      return NextResponse.json(
        {
          success: false,

          message:
            "ไม่สามารถโหลดข้อมูล Season ได้",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !seasonData
    ) {
      return NextResponse.json(
        {
          success: false,

          code:
            "DROP_INACTIVE",

          message:
            "DROP CLOSED — ไม่มี Season ที่เปิดใช้งานอยู่",
        },
        {
          status: 403,
        }
      );
    }

    const season =
      seasonData as
        ActiveSeason;

    // =====================================
    // VALIDATE SEASON SETTINGS
    // =====================================

    const craftCost =
      Number(
        season.craft_cost
      );

    const commonRate =
      Number(
        season.common_rate
      );

    const rareRate =
      Number(
        season.rare_rate
      );

    const epicRate =
      Number(
        season.epic_rate
      );

    const legendaryRate =
      Number(
        season.legendary_rate
      );

    const totalRate =
      commonRate +
      rareRate +
      epicRate +
      legendaryRate;

    if (
      !Number.isInteger(
        craftCost
      ) ||
      craftCost < 0
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Season Craft Cost ไม่ถูกต้อง",
        },
        {
          status: 500,
        }
      );
    }

    const rates = [
      commonRate,
      rareRate,
      epicRate,
      legendaryRate,
    ];

    const invalidRate =
      rates.some(
        (rate) =>
          !Number.isInteger(
            rate
          ) ||
          rate < 0 ||
          rate > 100
      );

    if (
      invalidRate
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "Season Grade Odds ไม่ถูกต้อง",
        },
        {
          status: 500,
        }
      );
    }

    if (
      totalRate !==
      100
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `Season Grade Odds ไม่ถูกต้อง (${totalRate}%)`,
        },
        {
          status: 500,
        }
      );
    }

    const normalizedSeason:
      ActiveSeason = {
        ...season,

        craft_cost:
          craftCost,

        common_rate:
          commonRate,

        rare_rate:
          rareRate,

        epic_rate:
          epicRate,

        legendary_rate:
          legendaryRate,
      };

    // =====================================
    // LOAD WALLET
    // =====================================

    const {
      data: wallet,

      error:
        walletError,
    } =
      await supabaseAdmin
        .from(
          "wallets"
        )
        .select(`
          id,
          user_id,
          balance
        `)
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

      return NextResponse.json(
        {
          success: false,

          message:
            "ไม่สามารถโหลด Wallet ได้",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !wallet
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "ไม่พบ Wallet ของ Player",
        },
        {
          status: 404,
        }
      );
    }

    const currentBalance =
      Number(
        wallet.balance ??
          0
      );

    // =====================================
    // CHECK BALANCE
    // =====================================

    if (
      currentBalance <
      craftCost
    ) {
      return NextResponse.json(
        {
          success: false,

          code:
            "INSUFFICIENT_BALANCE",

          message:
            `Loot Token ไม่พอ ต้องใช้ ${craftCost} LT`,

          required:
            craftCost,

          balance:
            currentBalance,
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // GENERATE GRADE
    // =====================================

    const grade =
      rollGrade(
        normalizedSeason
      );

    // =====================================
    // GENERATE SERIAL
    //
    // MVP VERSION
    // =====================================

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
        "LATEST ITEM ERROR:",
        latestItemError
      );

      return NextResponse.json(
        {
          success: false,

          message:
            "ไม่สามารถสร้าง Item ID ได้",
        },
        {
          status: 500,
        }
      );
    }

    const nextNumber =
      Number(
        latestItem?.id ??
          0
      ) + 1;

    const serial =
      createSerial(
        normalizedSeason.season_code,
        nextNumber
      );

    // =====================================
    // CREATE ITEM
    // =====================================

    const {
      data: newItem,

      error:
        itemError,
    } =
      await supabaseAdmin
        .from(
          "items"
        )
        .insert({
          serial,

          product:
            normalizedSeason.product_name,

          season:
            normalizedSeason.season_code,

          grade,

          level:
            0,

          size,

          owner_id:
            user.id,

          production_status:
            "CRAFTED",

          production_updated_at:
            new Date().toISOString(),

          environment_mode:
            environmentMode,
        })
        .select(`
          id,
          serial,
          product,
          season,
          grade,
          level,
          size,
          owner_id,
          production_status,
          tracking_number,
          production_updated_at,
          created_at,
          environment_mode
        `)
        .single();

    if (
      itemError
    ) {
      console.error(
        "CRAFT ITEM ERROR:",
        itemError
      );

      return NextResponse.json(
        {
          success: false,

          message:
            "สร้าง Item ไม่สำเร็จ",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================
    // UPDATE WALLET
    // =====================================

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
            new Date().toISOString(),
        })
        .eq(
          "user_id",
          user.id
        )
        .select(`
          id,
          user_id,
          balance,
          updated_at
        `)
        .single();

    if (
      walletUpdateError
    ) {
      console.error(
        "CRAFT WALLET UPDATE ERROR:",
        walletUpdateError
      );

      return NextResponse.json(
        {
          success: false,

          code:
            "WALLET_UPDATE_FAILED",

          message:
            "เกิดข้อผิดพลาดในการหัก Token กรุณาติดต่อ Admin",

          itemId:
            newItem.id,

          serial:
            newItem.serial,
        },
        {
          status: 500,
        }
      );
    }

    // =====================================
    // WALLET TRANSACTION
    // =====================================

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
            `CRAFT ${normalizedSeason.product_name} ${normalizedSeason.season_code} / ${grade} / ${size} / ${serial}`,

          item_id:
            newItem.id,

          environment_mode:
            environmentMode,
        });

    if (
      transactionError
    ) {
      console.error(
        "CRAFT TRANSACTION ERROR:",
        transactionError
      );
    }

    // =====================================
    // SUCCESS
    // =====================================

    return NextResponse.json({
      success:
        true,

      environment:
        environmentMode,

      item:
        newItem,

      wallet:
        updatedWallet,

      craft: {
        cost:
          craftCost,

        grade,

        size,

        season:
          normalizedSeason.season_code,

        seasonName:
          normalizedSeason.season_name,

        product:
          normalizedSeason.product_name,
      },

      odds: {
        COMMON:
          normalizedSeason.common_rate,

        RARE:
          normalizedSeason.rare_rate,

        EPIC:
          normalizedSeason.epic_rate,

        LEGENDARY:
          normalizedSeason.legendary_rate,
      },
    });
  } catch (error) {
    console.error(
      "CRAFT API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          "Craft failed",
      },
      {
        status:
          500,
      }
    );
  }
}