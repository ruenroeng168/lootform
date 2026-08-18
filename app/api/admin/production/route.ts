import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

// =====================================
// PRODUCTION STATUS
// =====================================

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
// TYPES
// =====================================

type ShippingAddress = {
  id: number;
  user_id: string;
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string | null;
  district: string | null;
  province: string;
  postal_code: string;
  note: string | null;
  is_default: boolean;
};

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
// AUTH RESPONSE
// =====================================

function getAuthResponse(
  authError: string | null
) {
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
          "คุณไม่มีสิทธิ์เข้าถึงระบบ Production",
      },
      {
        status: 403,
      }
    );
  }

  return null;
}

// =====================================
// GET NEXT STATUS
// =====================================

function getNextStatus(
  currentStatus: ProductionStatus
): ProductionStatus | null {
  const index =
    PRODUCTION_STATUSES.indexOf(
      currentStatus
    );

  if (
    index === -1 ||
    index >=
      PRODUCTION_STATUSES.length - 1
  ) {
    return null;
  }

  return PRODUCTION_STATUSES[
    index + 1
  ];
}

// =====================================
// CHECK VALID TRANSITION
// =====================================

function isValidTransition(
  currentStatus: ProductionStatus,
  requestedStatus: ProductionStatus
) {
  // อนุญาตสถานะเดิม
  // เช่น SHIPPED เพื่อแก้ Tracking

  if (
    currentStatus ===
    requestedStatus
  ) {
    return true;
  }

  const nextStatus =
    getNextStatus(
      currentStatus
    );

  return (
    requestedStatus ===
    nextStatus
  );
}

// =====================================
// LOAD SHIPPING ADDRESS
// =====================================

async function getShippingAddress(
  shippingAddressId:
    number | null
) {
  if (!shippingAddressId) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "shipping_addresses"
      )
      .select(`
        id,
        user_id,
        recipient_name,
        phone,
        address_line,
        subdistrict,
        district,
        province,
        postal_code,
        note,
        is_default
      `)
      .eq(
        "id",
        shippingAddressId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data as
      | ShippingAddress
      | null
  );
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

    const authResponse =
      getAuthResponse(
        authError
      );

    if (authResponse) {
      return authResponse;
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
    } =
      await supabaseAdmin
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
          created_at,
          shipping_address_id
        `)
        .order(
          "id",
          {
            ascending: false,
          }
        );

    if (itemError) {
      throw itemError;
    }

    const productionItems =
      items ?? [];

    // =====================================
    // UNIQUE SHIPPING ADDRESS IDS
    // =====================================

    const addressIds =
      Array.from(
        new Set(
          productionItems
            .map(
              (item) =>
                item.shipping_address_id
            )
            .filter(
              (
                id
              ): id is number =>
                typeof id ===
                  "number" &&
                id > 0
            )
        )
      );

    let addresses:
      ShippingAddress[] =
      [];

    // =====================================
    // LOAD ADDRESSES
    // =====================================

    if (
      addressIds.length >
      0
    ) {
      const {
        data:
          addressData,

        error:
          addressError,
      } =
        await supabaseAdmin
          .from(
            "shipping_addresses"
          )
          .select(`
            id,
            user_id,
            recipient_name,
            phone,
            address_line,
            subdistrict,
            district,
            province,
            postal_code,
            note,
            is_default
          `)
          .in(
            "id",
            addressIds
          );

      if (
        addressError
      ) {
        throw addressError;
      }

      addresses =
        (addressData ??
          []) as ShippingAddress[];
    }

    // =====================================
    // ADDRESS MAP
    // =====================================

    const addressMap =
      new Map<
        number,
        ShippingAddress
      >();

    addresses.forEach(
      (address) => {
        addressMap.set(
          address.id,
          address
        );
      }
    );

    // =====================================
    // MERGE
    // =====================================

    const resultItems =
      productionItems.map(
        (item) => ({
          ...item,

          shipping_address:
            item.shipping_address_id
              ? addressMap.get(
                  item.shipping_address_id
                ) ??
                null
              : null,
        })
      );

    return NextResponse.json({
      success: true,
      items: resultItems,
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

    const authResponse =
      getAuthResponse(
        authError
      );

    if (authResponse) {
      return authResponse;
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

    // =====================================
    // BODY
    // =====================================

    const body =
      await request.json();

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
      Number(
        rawItemId
      );

    const productionStatus =
      String(
        rawProductionStatus ??
          ""
      ) as ProductionStatus;

    const trackingNumber =
      typeof rawTrackingNumber ===
      "string"
        ? rawTrackingNumber.trim()
        : "";

    // =====================================
    // VALIDATE ID
    // =====================================

    if (
      !Number.isInteger(
        itemId
      ) ||
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
    // LOAD CURRENT ITEM
    // =====================================

    const {
      data: currentItem,
      error:
        currentItemError,
    } =
      await supabaseAdmin
        .from("items")
        .select(`
          id,
          serial,
          production_status,
          shipping_address_id,
          tracking_number
        `)
        .eq(
          "id",
          itemId
        )
        .maybeSingle();

    if (
      currentItemError
    ) {
      throw currentItemError;
    }

    if (!currentItem) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบ Item นี้ในระบบ",
        },
        {
          status: 404,
        }
      );
    }

    const currentStatus =
      currentItem.production_status as
        ProductionStatus;

    // =====================================
    // LOCK STATUS ORDER
    // =====================================

    if (
      !isValidTransition(
        currentStatus,
        productionStatus
      )
    ) {
      const next =
        getNextStatus(
          currentStatus
        );

      return NextResponse.json(
        {
          success: false,

          message:
            next
              ? `${currentItem.serial} ไม่สามารถเปลี่ยนจาก ${currentStatus} → ${productionStatus} ได้ ขั้นตอนถัดไปต้องเป็น ${next}`
              : `${currentItem.serial} อยู่สถานะสุดท้าย DELIVERED แล้ว`,
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // REQUIRE SHIPPING ADDRESS
    // =====================================

    if (
      productionStatus !==
        "CRAFTED" &&
      !currentItem.shipping_address_id
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            `${currentItem.serial} ยังไม่มีที่อยู่จัดส่ง กรุณารอให้ลูกค้ายืนยันที่อยู่ก่อน`,
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // REQUIRE TRACKING
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
    // BUILD UPDATE
    // =====================================

    const updateData: {
      production_status:
        ProductionStatus;

      production_updated_at:
        string;

      tracking_number?:
        string | null;
    } = {
      production_status:
        productionStatus,

      production_updated_at:
        new Date().toISOString(),
    };

    // =====================================
    // TRACKING
    // =====================================

    if (
      productionStatus ===
      "SHIPPED"
    ) {
      updateData.tracking_number =
        trackingNumber;
    }

    if (
      productionStatus ===
      "DELIVERED"
    ) {
      updateData.tracking_number =
        trackingNumber ||
        currentItem.tracking_number ||
        null;
    }

    // =====================================
    // UPDATE
    // =====================================

    const {
      data: updatedItem,
      error: updateError,
    } =
      await supabaseAdmin
        .from("items")
        .update(
          updateData
        )
        .eq(
          "id",
          itemId
        )
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
          shipping_address_id
        `)
        .single();

    if (
      updateError
    ) {
      throw updateError;
    }

    // =====================================
    // LOAD ADDRESS
    // =====================================

    const shippingAddress =
      await getShippingAddress(
        updatedItem.shipping_address_id
      );

    // =====================================
    // RESPONSE
    // =====================================

    return NextResponse.json({
      success: true,

      item: {
        ...updatedItem,

        shipping_address:
          shippingAddress,
      },
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