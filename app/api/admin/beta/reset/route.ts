import {
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

// =====================================
// ADMIN EMAILS
// =====================================

function getAdminEmails() {
  return (
    process.env.ADMIN_EMAILS ??
    ""
  )
    .split(",")
    .map((email) =>
      email
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
}

// =====================================
// VERIFY ADMIN
// =====================================

async function getAdminUser(
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
    data: {
      user,
    },

    error,
  } =
    await supabaseAdmin.auth.getUser(
      token
    );

  if (
    error ||
    !user ||
    !user.email
  ) {
    return {
      user: null,
      error: "UNAUTHORIZED",
    };
  }

  const adminEmails =
    getAdminEmails();

  const isAdmin =
    adminEmails.includes(
      user.email.toLowerCase()
    );

  if (!isAdmin) {
    return {
      user: null,
      error: "FORBIDDEN",
    };
  }

  return {
    user,
    error: null,
  };
}

// =====================================
// POST RESET
// =====================================

export async function POST(
  request: Request
) {
  try {
    // =====================================
    // ADMIN
    // =====================================

    const {
      user,
      error:
        authError,
    } =
      await getAdminUser(
        request
      );

    if (
      authError ===
      "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "กรุณา Login ใหม่",
        },
        {
          status:
            401,
        }
      );
    }

    if (
      authError ===
      "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "คุณไม่มีสิทธิ์ Reset ระบบ",
        },
        {
          status:
            403,
        }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "Admin verification failed",
        },
        {
          status:
            401,
        }
      );
    }

    // =====================================
    // BODY
    // =====================================

    const body =
      await request.json();

    const confirmation =
      typeof body.confirmation ===
      "string"
        ? body.confirmation.trim()
        : "";

    // =====================================
    // CONFIRMATION
    // =====================================

    if (
      confirmation !==
      "RESET LOOTFORM BETA"
    ) {
      return NextResponse.json(
        {
          success:
            false,

          code:
            "INVALID_CONFIRMATION",

          message:
            "ข้อความยืนยันไม่ถูกต้อง",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================
    // CHECK SYSTEM MODE
    // =====================================

    const {
      data:
        settings,

      error:
        settingsError,
    } =
      await supabaseAdmin
        .from(
          "system_settings"
        )
        .select(`
          id,
          environment_mode
        `)
        .eq(
          "id",
          1
        )
        .maybeSingle();

    if (
      settingsError
    ) {
      throw settingsError;
    }

    if (!settings) {
      return NextResponse.json(
        {
          success:
            false,

          message:
            "ไม่พบ System Settings",
        },
        {
          status:
            500,
        }
      );
    }

    if (
      settings.environment_mode !==
      "TEST"
    ) {
      return NextResponse.json(
        {
          success:
            false,

          code:
            "LIVE_MODE",

          message:
            "ไม่สามารถ Reset ได้ เพราะระบบไม่ได้อยู่ใน TEST MODE",
        },
        {
          status:
            400,
        }
      );
    }

    // =====================================
    // RUN TRANSACTIONAL RESET
    // =====================================

    const {
      data:
        resetResult,

      error:
        resetError,
    } =
      await supabaseAdmin.rpc(
        "reset_lootform_beta",
        {
          p_admin_user_id:
            user.id,

          p_confirmation:
            confirmation,
        }
      );

    if (
      resetError
    ) {
      console.error(
        "BETA RESET RPC ERROR:",
        resetError
      );

      const message =
        resetError.message ??
        "";

      if (
        message.includes(
          "LIVE_DATA_DETECTED_RESET_ABORTED"
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            code:
              "LIVE_DATA_DETECTED",

            message:
              "พบ LIVE DATA ในระบบ จึงยกเลิก Reset เพื่อความปลอดภัย",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        message.includes(
          "RESET_NOT_ALLOWED_IN_LIVE_MODE"
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            code:
              "LIVE_MODE",

            message:
              "ไม่สามารถ Reset ได้ใน LIVE MODE",
          },
          {
            status:
              400,
          }
        );
      }

      throw resetError;
    }

    // =====================================
    // SUCCESS
    // =====================================

    return NextResponse.json({
      success:
        true,

      message:
        "LOOTFORM BETA RESET สำเร็จ",

      result:
        resetResult,
    });
  } catch (error) {
    console.error(
      "BETA RESET API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        message:
          "เกิดข้อผิดพลาดในการ Reset Beta",
      },
      {
        status:
          500,
      }
    );
  }
}