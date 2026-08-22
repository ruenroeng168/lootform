import {
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

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
      error:
        "UNAUTHORIZED",
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
    !user
  ) {
    return {
      user: null,
      error:
        "UNAUTHORIZED",
    };
  }

  return {
    user,
    error: null,
  };
}

// =====================================
// EQUIP ITEM
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
            "กรุณา Login ใหม่",
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

    const itemId =
      Number(
        body?.itemId
      );

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
            "INVALID_ITEM_ID",
        },
        {
          status: 400,
        }
      );
    }

    // =====================================
    // CHECK ITEM OWNERSHIP
    //
    // สำคัญ:
    // User จะ Equip Item
    // ที่ไม่ใช่ของตัวเองไม่ได้
    // =====================================

    const {
      data: item,
      error: itemError,
    } =
      await supabaseAdmin
        .from(
          "items"
        )
        .select(`
          id,
          serial,
          product,
          season,
          grade,
          level,
          size,
          owner_id
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

    if (
      itemError
    ) {
      console.error(
        "EQUIP ITEM LOAD ERROR:",
        itemError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to verify Item",
        },
        {
          status: 500,
        }
      );
    }

    if (!item) {
      return NextResponse.json(
        {
          success: false,
          message:
            "ITEM_NOT_OWNED",
        },
        {
          status: 403,
        }
      );
    }

    // =====================================
    // CHECK PLAYER PROFILE
    // =====================================

    const {
      data: profile,
      error:
        profileError,
    } =
      await supabaseAdmin
        .from(
          "player_profiles"
        )
        .select(`
          user_id,
          equipped_item_id
        `)
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      profileError
    ) {
      console.error(
        "PLAYER PROFILE LOAD ERROR:",
        profileError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to load Player Profile",
        },
        {
          status: 500,
        }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          message:
            "PLAYER_PROFILE_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    // =====================================
    // ALREADY EQUIPPED
    // =====================================

    if (
      Number(
        profile
          .equipped_item_id
      ) === itemId
    ) {
      return NextResponse.json({
        success: true,

        alreadyEquipped:
          true,

        item: {
          id:
            item.id,

          serial:
            item.serial,

          product:
            item.product,

          season:
            item.season,

          grade:
            item.grade,

          level:
            item.level,

          size:
            item.size,
        },
      });
    }

    // =====================================
    // EQUIP
    // =====================================

    const {
      error:
        updateError,
    } =
      await supabaseAdmin
        .from(
          "player_profiles"
        )
        .update({
          equipped_item_id:
            itemId,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "user_id",
          user.id
        );

    if (
      updateError
    ) {
      console.error(
        "EQUIP UPDATE ERROR:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to Equip Item",
        },
        {
          status: 500,
        }
      );
    }

    // =====================================
    // RESPONSE
    // =====================================

    return NextResponse.json({
      success: true,

      alreadyEquipped:
        false,

      message:
        "ITEM_EQUIPPED",

      item: {
        id:
          item.id,

        serial:
          item.serial,

        product:
          item.product,

        season:
          item.season,

        grade:
          item.grade,

        level:
          item.level,

        size:
          item.size,
      },
    });
  } catch (error) {
    console.error(
      "EQUIP API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to Equip Item",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================
// UNEQUIP ITEM
// =====================================

export async function DELETE(
  request: Request
) {
  try {
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
            "กรุณา Login ใหม่",
        },
        {
          status: 401,
        }
      );
    }

    const {
      error,
    } =
      await supabaseAdmin
        .from(
          "player_profiles"
        )
        .update({
          equipped_item_id:
            null,

          updated_at:
            new Date()
              .toISOString(),
        })
        .eq(
          "user_id",
          user.id
        );

    if (error) {
      console.error(
        "UNEQUIP ERROR:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to Unequip Item",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,

      message:
        "ITEM_UNEQUIPPED",
    });
  } catch (error) {
    console.error(
      "UNEQUIP API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Unable to Unequip Item",
      },
      {
        status: 500,
      }
    );
  }
}