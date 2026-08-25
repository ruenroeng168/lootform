import {
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

type EquipmentSlot =
  | "HEAD"
  | "TOP"
  | "BOTTOM"
  | "SHOES"
  | "ACCESSORY";

type LegacyItem = {
  id: number;
  serial: string;
  product: string;
  season: string;
  grade: string;
  level: number;
  size: string | null;
  owner_id: string | null;
  product_id: number | null;
  equip_slot_snapshot: string | null;
};

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  "HEAD",
  "TOP",
  "BOTTOM",
  "SHOES",
  "ACCESSORY",
];

function isEquipmentSlot(
  value: unknown
): value is EquipmentSlot {
  return (
    typeof value === "string" &&
    EQUIPMENT_SLOTS.includes(
      value.trim().toUpperCase() as EquipmentSlot
    )
  );
}

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

async function resolveItemSlot(
  item: LegacyItem
): Promise<EquipmentSlot> {
  const snapshot =
    item.equip_slot_snapshot
      ?.trim()
      .toUpperCase();

  if (
    isEquipmentSlot(
      snapshot
    )
  ) {
    return snapshot;
  }

  if (
    item.product_id
  ) {
    const {
      data: product,
      error,
    } =
      await supabaseAdmin
        .from(
          "products"
        )
        .select(
          "equip_slot"
        )
        .eq(
          "id",
          item.product_id
        )
        .maybeSingle();

    if (error) {
      console.error(
        "LEGACY EQUIP PRODUCT SLOT ERROR:",
        error
      );
    }

    const productSlot =
      typeof product?.equip_slot === "string"
        ? product.equip_slot
            .trim()
            .toUpperCase()
        : "";

    if (
      isEquipmentSlot(
        productSlot
      )
    ) {
      return productSlot;
    }
  }

  // Legacy equipped_item_id pre-dates slot-aware equipment.
  // Treat unresolved legacy apparel as TOP so old collections
  // remain usable while player_equipment stays the source of truth.
  return "TOP";
}

async function loadOwnedItem(
  itemId: number,
  userId: string
) {
  const {
    data: item,
    error,
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
        owner_id,
        product_id,
        equip_slot_snapshot
      `)
      .eq(
        "id",
        itemId
      )
      .eq(
        "owner_id",
        userId
      )
      .maybeSingle();

  return {
    item:
      item as LegacyItem | null,
    error,
  };
}

export async function POST(
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

    const body =
      await request.json();

    const itemId =
      Number(
        body?.itemId ??
          body?.item_id
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

    const {
      item,
      error: itemError,
    } =
      await loadOwnedItem(
        itemId,
        user.id
      );

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

    const slot =
      await resolveItemSlot(
        item
      );

    const {
      error: equipmentError,
    } =
      await supabaseAdmin
        .from(
          "player_equipment"
        )
        .upsert(
          {
            user_id:
              user.id,
            slot,
            item_id:
              item.id,
            updated_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "user_id,slot",
          }
        );

    if (
      equipmentError
    ) {
      console.error(
        "LEGACY EQUIP SYNC ERROR:",
        equipmentError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to sync Player Equipment",
        },
        {
          status: 500,
        }
      );
    }

    const {
      data: profile,
      error: profileError,
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

    const alreadyEquipped =
      Number(
        profile.equipped_item_id
      ) === itemId;

    if (
      !alreadyEquipped
    ) {
      const {
        error: updateError,
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
    }

    return NextResponse.json({
      success: true,
      alreadyEquipped,
      message:
        alreadyEquipped
          ? "ITEM_ALREADY_EQUIPPED"
          : "ITEM_EQUIPPED",
      slot,
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
      data: profile,
      error: profileError,
    } =
      await supabaseAdmin
        .from(
          "player_profiles"
        )
        .select(
          "equipped_item_id"
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      profileError
    ) {
      throw profileError;
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

    const equippedItemId =
      Number(
        profile.equipped_item_id
      );

    if (
      Number.isInteger(
        equippedItemId
      ) &&
      equippedItemId > 0
    ) {
      const {
        error: equipmentError,
      } =
        await supabaseAdmin
          .from(
            "player_equipment"
          )
          .delete()
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "item_id",
            equippedItemId
          );

      if (
        equipmentError
      ) {
        console.error(
          "LEGACY UNEQUIP SYNC ERROR:",
          equipmentError
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Unable to sync Player Equipment",
          },
          {
            status: 500,
          }
        );
      }
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
