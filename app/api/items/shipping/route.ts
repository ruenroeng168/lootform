import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

// =====================================
// GET USER FROM TOKEN
// =====================================

async function getUserFromRequest(
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
    return null;
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
    return null;
  }

  return user;
}

// =====================================
// ASSIGN SHIPPING ADDRESS TO ITEM
// =====================================

export async function PATCH(
  request: Request
) {
  try {
    const user =
      await getUserFromRequest(
        request
      );

    if (!user) {
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

    const body =
      await request.json();

    const itemId =
      Number(
        body.itemId
      );

    const addressId =
      Number(
        body.addressId
      );

    // =====================================
    // VALIDATE
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

    if (
      !Number.isInteger(
        addressId
      ) ||
      addressId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Shipping Address ไม่ถูกต้อง",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // CHECK ITEM OWNERSHIP
    // =====================================

    const {
      data: item,
      error: itemError,
    } =
      await supabaseAdmin
        .from("items")
        .select(`
          id,
          owner_id,
          production_status
        `)
        .eq(
          "id",
          itemId
        )
        .eq(
          "owner_id",
          user.id
        )
        .maybeSingle();

    if (itemError) {
      throw itemError;
    }

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบ Item หรือคุณไม่มีสิทธิ์แก้ไข Item นี้",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================
    // LOCK AFTER SHIPPING
    // =====================================

    if (
      item.production_status ===
        "SHIPPED" ||
      item.production_status ===
        "DELIVERED"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Item นี้ถูกจัดส่งแล้ว ไม่สามารถเปลี่ยนที่อยู่ได้",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // CHECK ADDRESS OWNERSHIP
    // =====================================

    const {
      data: address,
      error: addressError,
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
          addressId
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (addressError) {
      throw addressError;
    }

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ไม่พบที่อยู่จัดส่ง หรือที่อยู่นี้ไม่ใช่ของคุณ",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================
    // UPDATE ITEM
    // =====================================

    const {
      data: updatedItem,
      error: updateError,
    } =
      await supabaseAdmin
        .from("items")
        .update({
          shipping_address_id:
            address.id,
        })
        .eq(
          "id",
          itemId
        )
        .eq(
          "owner_id",
          user.id
        )
        .select(`
          id,
          serial,
          shipping_address_id
        `)
        .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,

      item: updatedItem,

      address,
    });
  } catch (error) {
    console.error(
      "ITEM SHIPPING ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "ไม่สามารถบันทึกที่อยู่สำหรับ Item ได้",
      },
      {
        status: 500,
      }
    );
  }
}