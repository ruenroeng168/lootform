import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

// =====================================
// TEST TOP-UP PACKAGE
// =====================================

const TOPUP_PACKAGE = {
  code: "LT100",
  amountTHB: 999,
  tokenAmount: 100,
} as const;

// =====================================
// VERIFY USER
// =====================================

async function getUser(
  request: Request
) {
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
    return {
      user: null,
      error: "UNAUTHORIZED",
    };
  }

  const token =
    authHeader.replace(
      "Bearer ",
      ""
    );

  const {
    data: { user },
    error,
  } =
    await supabaseAdmin.auth.getUser(
      token
    );

  if (
    error ||
    !user
  ) {
    return {
      user: null,
      error: "UNAUTHORIZED",
    };
  }

  return {
    user,
    error: null,
  };
}

// =====================================
// CREATE REFERENCE
// =====================================

function createReference() {
  const now =
    new Date();

  const date =
    now
      .toISOString()
      .slice(0, 10)
      .replaceAll(
        "-",
        ""
      );

  const time =
    now
      .toISOString()
      .slice(11, 19)
      .replaceAll(
        ":",
        ""
      );

  const random =
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase();

  return `TP-${date}-${time}-${random}`;
}

// =====================================
// POST TEST TOP-UP
// =====================================

export async function POST(
  request: Request
) {
  try {
    // =====================================
    // AUTH
    // =====================================

    const {
      user,
      error: authError,
    } =
      await getUser(
        request
      );

    if (
      authError ||
      !user
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณา Login ก่อนเติม LT",
        },
        {
          status: 401,
        }
      );
    }

    // =====================================
    // BODY
    // =====================================

    let body: {
      packageCode?: string;
    };

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message:
            "Request Body ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    const packageCode =
      String(
        body.packageCode ??
          ""
      ).toUpperCase();

    // =====================================
    // VALIDATE PACKAGE
    // =====================================

    if (
      packageCode !==
      TOPUP_PACKAGE.code
    ) {
      return NextResponse.json(
        {
          success: false,
          code:
            "INVALID_PACKAGE",
          message:
            "แพ็กเกจเติม LT ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // SYSTEM MODE
    // =====================================

    const {
      data: settings,
      error:
        settingsError,
    } =
      await supabaseAdmin
        .from(
          "system_settings"
        )
        .select(
          "environment_mode"
        )
        .eq(
          "id",
          1
        )
        .maybeSingle();

    if (
      settingsError
    ) {
      console.error(
        "TEST TOPUP SETTINGS ERROR:",
        settingsError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่สามารถตรวจสอบ System Mode ได้",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !settings
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบ System Settings",
        },
        {
          status: 500,
        }
      );
    }

    if (
      settings.environment_mode !==
      "TEST"
    ) {
      return NextResponse.json(
        {
          success: false,
          code:
            "TEST_TOPUP_DISABLED",
          message:
            "TEST TOP-UP ใช้งานได้เฉพาะ TEST MODE",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================
    // CREATE REFERENCE
    // =====================================

    const reference =
      createReference();

    // =====================================
    // RUN ATOMIC TOP-UP
    // =====================================

    const {
      data:
        topupResult,

      error:
        topupError,
    } =
      await supabaseAdmin.rpc(
        "complete_test_topup",
        {
          p_user_id:
            user.id,

          p_reference:
            reference,

          p_package_code:
            TOPUP_PACKAGE.code,

          p_amount_thb:
            TOPUP_PACKAGE.amountTHB,

          p_token_amount:
            TOPUP_PACKAGE.tokenAmount,
        }
      );

    if (
      topupError
    ) {
      console.error(
        "TEST TOPUP RPC ERROR:",
        topupError
      );

      return NextResponse.json(
        {
          success: false,
          code:
            "TOPUP_RPC_ERROR",
          message:
            topupError.message ||
            "TEST TOP-UP RPC ERROR",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !topupResult
    ) {
      return NextResponse.json(
        {
          success: false,
          code:
            "EMPTY_TOPUP_RESULT",
          message:
            "ระบบเติม LT ไม่ส่งผลลัพธ์กลับมา",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================
    // SUCCESS
    // =====================================

    return NextResponse.json(
      {
        success: true,

        mode: "TEST",

        package: {
          code:
            TOPUP_PACKAGE.code,

          amountTHB:
            TOPUP_PACKAGE.amountTHB,

          tokenAmount:
            TOPUP_PACKAGE.tokenAmount,
        },

        topup:
          topupResult,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "TEST TOPUP API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "ไม่สามารถเติม LT ได้",
      },
      {
        status: 500,
      }
    );
  }
}