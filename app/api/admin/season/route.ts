import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

type SeasonSettings = {
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

  start_at: string | null;
  end_at: string | null;

  hero_image_url: string | null;
  hero_image_path: string | null;
  hero_model_url: string | null;
  hero_model_path: string | null;

  created_at: string;
  updated_at: string;
};

// =====================================
// ADMIN EMAILS
// =====================================

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// =====================================
// VERIFY ADMIN
// =====================================

async function verifyAdmin(request: Request) {
  const authHeader =
    request.headers.get("authorization");

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return {
      user: null,
      status: 401,
      message: "กรุณา Login ใหม่",
    };
  }

  const token =
    authHeader.replace("Bearer ", "");

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (
    error ||
    !user ||
    !user.email
  ) {
    return {
      user: null,
      status: 401,
      message: "กรุณา Login ใหม่",
    };
  }

  const isAdmin =
    getAdminEmails().includes(
      user.email.toLowerCase()
    );

  if (!isAdmin) {
    return {
      user: null,
      status: 403,
      message:
        "คุณไม่มีสิทธิ์เข้าหน้า Admin",
    };
  }

  return {
    user,
    status: 200,
    message: null,
  };
}

// =====================================
// DATE HELPER
// =====================================

function normalizeDateTime(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    new Date(String(value));

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "INVALID";
  }

  return parsed.toISOString();
}

// =====================================
// GET SEASON
// =====================================

export async function GET(
  request: Request
) {
  try {
    const auth =
      await verifyAdmin(request);

    if (!auth.user) {
      return NextResponse.json(
        {
          success: false,
          message: auth.message,
        },
        {
          status: auth.status,
        }
      );
    }

    const {
      data: activeSeason,
      error: activeError,
    } = await supabaseAdmin
      .from("season_settings")
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
        is_active,
        start_at,
        end_at,
        hero_image_url,
        hero_image_path,
        hero_model_url,
        hero_model_path,
        created_at,
        updated_at
      `)
      .eq("is_active", true)
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      throw activeError;
    }

    if (activeSeason) {
      return NextResponse.json({
        success: true,

        admin: {
          email:
            auth.user.email,
        },

        season:
          activeSeason,
      });
    }

    const {
      data: latestSeason,
      error: latestError,
    } = await supabaseAdmin
      .from("season_settings")
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
        is_active,
        start_at,
        end_at,
        hero_image_url,
        hero_image_path,
        hero_model_url,
        hero_model_path,
        created_at,
        updated_at
      `)
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    if (!latestSeason) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบ Season Settings",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,

      admin: {
        email:
          auth.user.email,
      },

      season:
        latestSeason,
    });
  } catch (error) {
    console.error(
      "ADMIN SEASON GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load Season Settings",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================
// UPDATE SEASON
// =====================================

export async function PATCH(
  request: Request
) {
  try {
    const auth =
      await verifyAdmin(request);

    if (!auth.user) {
      return NextResponse.json(
        {
          success: false,
          message: auth.message,
        },
        {
          status: auth.status,
        }
      );
    }

    const body =
      await request.json();

    const id =
      Number(body.id);

    const seasonCode =
      String(
        body.season_code ?? ""
      )
        .trim()
        .toUpperCase();

    const seasonName =
      String(
        body.season_name ?? ""
      ).trim();

    const productName =
      String(
        body.product_name ?? ""
      ).trim();

    const craftCost =
      Number(body.craft_cost);

    const commonRate =
      Number(body.common_rate);

    const rareRate =
      Number(body.rare_rate);

    const epicRate =
      Number(body.epic_rate);

    const legendaryRate =
      Number(body.legendary_rate);

    const isActive =
      body.is_active === true;

    const startAt =
      normalizeDateTime(
        body.start_at
      );

    const endAt =
      normalizeDateTime(
        body.end_at
      );

    // =====================================
    // VALIDATION
    // =====================================

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Season ID ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    if (!seasonCode) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณาใส่ Season Code",
        },
        {
          status: 400,
        }
      );
    }

    if (!seasonName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณาใส่ Season Name",
        },
        {
          status: 400,
        }
      );
    }

    if (!productName) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณาใส่ Product Name",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isInteger(craftCost) ||
      craftCost < 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Craft Cost ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    if (
      startAt === "INVALID"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "วันเวลาเปิด Season ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    if (
      endAt === "INVALID"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "วันเวลาปิด Season ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    if (
      startAt &&
      endAt &&
      new Date(endAt).getTime() <=
        new Date(startAt).getTime()
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "วันเวลาปิด Season ต้องอยู่หลังวันเวลาเปิด",
        },
        {
          status: 400,
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
          !Number.isInteger(rate) ||
          rate < 0 ||
          rate > 100
      );

    if (invalidRate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Grade Rate ต้องเป็นจำนวนเต็มระหว่าง 0-100",
        },
        {
          status: 400,
        }
      );
    }

    const totalRate =
      commonRate +
      rareRate +
      epicRate +
      legendaryRate;

    if (totalRate !== 100) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Grade Odds รวมต้องเท่ากับ 100% ปัจจุบัน ${totalRate}%`,
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // ACTIVE SEASON
    // =====================================

    if (isActive) {
      const {
        error:
          deactivateError,
      } = await supabaseAdmin
        .from("season_settings")
        .update({
          is_active: false,

          updated_at:
            new Date().toISOString(),
        })
        .neq("id", id);

      if (deactivateError) {
        throw deactivateError;
      }
    }

    // =====================================
    // UPDATE
    // =====================================

    const {
      data: updatedSeason,
      error: updateError,
    } = await supabaseAdmin
      .from("season_settings")
      .update({
        season_code:
          seasonCode,

        season_name:
          seasonName,

        product_name:
          productName,

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

        is_active:
          isActive,

        start_at:
          startAt,

        end_at:
          endAt,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id)
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
        is_active,
        start_at,
        end_at,
        hero_image_url,
        hero_image_path,
        hero_model_url,
        hero_model_path,
        created_at,
        updated_at
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,

      season:
        updatedSeason as SeasonSettings,
    });
  } catch (error) {
    console.error(
      "ADMIN SEASON PATCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update Season Settings",
      },
      {
        status: 500,
      }
    );
  }
}