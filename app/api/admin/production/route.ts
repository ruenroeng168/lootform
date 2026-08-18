import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

const PRODUCTION_STATUSES = [
  "CRAFTED",
  "PRODUCTION",
  "QC",
  "PACKING",
  "SHIPPED",
  "DELIVERED",
] as const;

type ProductionStatus =
  (typeof PRODUCTION_STATUSES)[number];

// =====================================
// ADMIN EMAILS
// =====================================

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) =>
      email.trim().toLowerCase()
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
    data: { user },
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
// GET ALL PRODUCTION ITEMS
// =====================================

export async function GET(
  request: Request
) {
  try {
    const {
      user,
      error: authError,
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
          success: false,
          message:
            "กรุณา Login ใหม่",
        },
        {
          status: 401,
        }
      );
    }

    if (
      authError ===
      "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "คุณไม่มีสิทธิ์เข้าหน้า Admin",
        },
        {
          status: 403,
        }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin verification failed",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: items,
      error: itemError,
    } = await supabaseAdmin
      .from("items")
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
        created_at
      `)
      .order("id", {
        ascending: false,
      });

    if (itemError) {
      throw itemError;
    }

    return NextResponse.json({
      success: true,
      items: items ?? [],
    });
  } catch (error) {
    console.error(
      "ADMIN PRODUCTION GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to load production items",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================
// UPDATE PRODUCTION STATUS
// =====================================

export async function PATCH(
  request: Request
) {
  try {
    const {
      user,
      error: authError,
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
          success: false,
          message:
            "กรุณา Login ใหม่",
        },
        {
          status: 401,
        }
      );
    }

    if (
      authError ===
      "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "คุณไม่มีสิทธิ์แก้สถานะ Production",
        },
        {
          status: 403,
        }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Admin verification failed",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    // รองรับทั้ง field แบบเดิมและแบบใหม่
    const rawItemId =
      body.id ??
      body.itemId;

    const rawProductionStatus =
      body.production_status ??
      body.productionStatus;

    const rawTrackingNumber =
      body.tracking_number ??
      body.trackingNumber ??
      "";

    const itemId =
      Number(rawItemId);

    const productionStatus =
      String(
        rawProductionStatus ?? ""
      ) as ProductionStatus;

    const trackingNumber =
      typeof rawTrackingNumber ===
      "string"
        ? rawTrackingNumber.trim()
        : "";

    // =====================================
    // VALIDATE ITEM ID
    // =====================================

    if (
      !Number.isInteger(itemId) ||
      itemId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Item ID ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // VALIDATE STATUS
    // =====================================

    if (
      !PRODUCTION_STATUSES.includes(
        productionStatus
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Production Status ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // REQUIRE TRACKING WHEN SHIPPED
    // =====================================

    if (
      productionStatus ===
        "SHIPPED" &&
      !trackingNumber
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "กรุณาใส่ Tracking Number ก่อนเปลี่ยนเป็น SHIPPED",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // BUILD UPDATE DATA
    // =====================================

    const updateData: {
      production_status: ProductionStatus;
      production_updated_at: string;
      tracking_number?: string | null;
    } = {
      production_status:
        productionStatus,

      production_updated_at:
        new Date().toISOString(),
    };

    if (
      productionStatus ===
        "SHIPPED" ||
      productionStatus ===
        "DELIVERED"
    ) {
      updateData.tracking_number =
        trackingNumber || null;
    }

    // =====================================
    // UPDATE ITEM
    // =====================================

    const {
      data: updatedItem,
      error: updateError,
    } = await supabaseAdmin
      .from("items")
      .update(updateData)
      .eq("id", itemId)
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
        created_at
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error(
      "ADMIN PRODUCTION PATCH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to update production status",
      },
      {
        status: 500,
      }
    );
  }
}