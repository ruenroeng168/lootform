import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

type EquipmentSlot =
  | "HEAD"
  | "TOP"
  | "BOTTOM"
  | "SHOES"
  | "ACCESSORY";

type ItemRow = {
  id: number;
  owner_id: string | null;
  serial: string;
  product: string;
  season: string;
  grade: string;
  level: number;
  size: string | null;

  product_id:
    | number
    | null;

  design_id:
    | number
    | null;

  equip_slot_snapshot:
    | string
    | null;

  upgrade_level:
    | number
    | null;

  upgrade_exp:
    | number
    | null;

  thumbnail_url_snapshot:
    | string
    | null;

  model_url_snapshot:
    | string
    | null;

  hp_bonus_snapshot:
    | number
    | null;

  attack_bonus_snapshot:
    | number
    | null;

  defense_bonus_snapshot:
    | number
    | null;

  luck_bonus_snapshot:
    | number
    | null;

  heal_bonus_snapshot:
    | number
    | null;

  vision_bonus_snapshot:
    | number
    | null;

  power_score_snapshot:
    | number
    | null;

  ability_code_snapshot:
    | string
    | null;

  ability_config_snapshot:
    | Record<string, unknown>
    | null;
};

const VALID_SLOTS:
  EquipmentSlot[] = [
    "HEAD",
    "TOP",
    "BOTTOM",
    "SHOES",
    "ACCESSORY",
  ];

function noStore(
  response:
    NextResponse
) {
  response.headers.set(
    "Cache-Control",
    "no-store"
  );

  return response;
}

function ok(
  data:
    Record<
      string,
      unknown
    >,
  status = 200
) {
  return noStore(
    NextResponse.json(
      {
        ok:
          true,

        ...data,
      },
      {
        status,
      }
    )
  );
}

function fail(
  status:
    number,

  code:
    string,

  error:
    string
) {
  return noStore(
    NextResponse.json(
      {
        ok:
          false,

        code,
        error,
      },
      {
        status,
      }
    )
  );
}

function isSlot(
  value:
    unknown
): value is EquipmentSlot {
  return (
    typeof value ===
      "string" &&
    VALID_SLOTS.includes(
      value as
        EquipmentSlot
    )
  );
}

async function getAuthenticatedUser(
  request:
    NextRequest
) {
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
      user:
        null,

      error:
        fail(
          401,
          "UNAUTHORIZED",
          "Missing Bearer token."
        ),
    };
  }

  const token =
    authorization
      .slice(
        "Bearer ".length
      )
      .trim();

  if (!token) {
    return {
      user:
        null,

      error:
        fail(
          401,
          "UNAUTHORIZED",
          "Missing access token."
        ),
    };
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .auth
      .getUser(
        token
      );

  if (
    error ||
    !data.user
  ) {
    return {
      user:
        null,

      error:
        fail(
          401,
          "UNAUTHORIZED",
          "Invalid or expired session."
        ),
    };
  }

  return {
    user:
      data.user,

    error:
      null,
  };
}

async function getItem(
  itemId:
    number
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "items"
      )
      .select(`
        id,
        owner_id,
        serial,
        product,
        season,
        grade,
        level,
        size,
        product_id,
        design_id,
        equip_slot_snapshot,
        upgrade_level,
        upgrade_exp,
        thumbnail_url_snapshot,
        model_url_snapshot,
        hp_bonus_snapshot,
        attack_bonus_snapshot,
        defense_bonus_snapshot,
        luck_bonus_snapshot,
        heal_bonus_snapshot,
        vision_bonus_snapshot,
        power_score_snapshot,
        ability_code_snapshot,
        ability_config_snapshot
      `)
      .eq(
        "id",
        itemId
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data as
      | ItemRow
      | null
  );
}

async function resolveItemSlot(
  item:
    ItemRow
): Promise<
  EquipmentSlot | null
> {
  if (
    isSlot(
      item.equip_slot_snapshot
    )
  ) {
    return item
      .equip_slot_snapshot;
  }

  if (
    !item.product_id
  ) {
    return null;
  }

  const {
    data:
      product,

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
    throw error;
  }

  if (
    !product ||
    !isSlot(
      product.equip_slot
    )
  ) {
    return null;
  }

  return product
    .equip_slot;
}

// =========================================================
// GET
// Return player's current equipment
// =========================================================

export async function GET(
  request:
    NextRequest
) {
  try {
    const auth =
      await getAuthenticatedUser(
        request
      );

    if (
      auth.error ||
      !auth.user
    ) {
      return auth.error!;
    }

    const userId =
      auth.user.id;

    const {
      data:
        equipmentRows,

      error:
        equipmentError,
    } =
      await supabaseAdmin
        .from(
          "player_equipment"
        )
        .select(`
          id,
          user_id,
          slot,
          item_id,
          created_at,
          updated_at
        `)
        .eq(
          "user_id",
          userId
        )
        .order(
          "slot",
          {
            ascending:
              true,
          }
        );

    if (
      equipmentError
    ) {
      throw equipmentError;
    }

    const rows =
      equipmentRows ??
      [];

    const itemIds =
      rows.map(
        (
          row
        ) =>
          Number(
            row.item_id
          )
      );

    let itemMap =
      new Map<
        number,
        ItemRow
      >();

    if (
      itemIds.length >
      0
    ) {
      const {
        data:
          itemRows,

        error:
          itemsError,
      } =
        await supabaseAdmin
          .from(
            "items"
          )
          .select(`
            id,
            owner_id,
            serial,
            product,
            season,
            grade,
            level,
            size,
            product_id,
            design_id,
            equip_slot_snapshot,
            upgrade_level,
            upgrade_exp,
            thumbnail_url_snapshot,
            model_url_snapshot,
            hp_bonus_snapshot,
            attack_bonus_snapshot,
            defense_bonus_snapshot,
            luck_bonus_snapshot,
            heal_bonus_snapshot,
            vision_bonus_snapshot,
            power_score_snapshot,
            ability_code_snapshot,
            ability_config_snapshot
          `)
          .in(
            "id",
            itemIds
          );

      if (
        itemsError
      ) {
        throw itemsError;
      }

      itemMap =
        new Map(
          (
            itemRows ??
            []
          ).map(
            (
              item
            ) => [
              Number(
                item.id
              ),

              item as
                ItemRow,
            ]
          )
        );
    }

    const equipment =
      rows.map(
        (
          row
        ) => ({
          id:
            row.id,

          slot:
            row.slot,

          item_id:
            row.item_id,

          created_at:
            row.created_at,

          updated_at:
            row.updated_at,

          item:
            itemMap.get(
              Number(
                row.item_id
              )
            ) ??
            null,
        })
      );

    const slots:
      Record<
        EquipmentSlot,
        unknown
      > = {
        HEAD:
          null,

        TOP:
          null,

        BOTTOM:
          null,

        SHOES:
          null,

        ACCESSORY:
          null,
      };

    for (
      const entry of
      equipment
    ) {
      if (
        isSlot(
          entry.slot
        )
      ) {
        slots[
          entry.slot
        ] =
          entry;
      }
    }

    return ok({
      equipment,
      slots,
      count:
        equipment.length,
    });
  } catch (
    error
  ) {
    console.error(
      "GET PLAYER EQUIPMENT ERROR:",
      error
    );

    return fail(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to load player equipment."
    );
  }
}

// =========================================================
// POST
// Equip an owned item.
// Slot is derived by server.
// =========================================================

export async function POST(
  request:
    NextRequest
) {
  try {
    const auth =
      await getAuthenticatedUser(
        request
      );

    if (
      auth.error ||
      !auth.user
    ) {
      return auth.error!;
    }

    const userId =
      auth.user.id;

    let body:
      Record<
        string,
        unknown
      >;

    try {
      body =
        await request.json();
    } catch {
      return fail(
        400,
        "INVALID_JSON",
        "Request body must be valid JSON."
      );
    }

    const itemId =
      Number(
        body.item_id ??
        body.itemId
      );

    if (
      !Number.isInteger(
        itemId
      ) ||
      itemId <= 0
    ) {
      return fail(
        400,
        "INVALID_ITEM_ID",
        "item_id is required."
      );
    }

    const item =
      await getItem(
        itemId
      );

    if (!item) {
      return fail(
        404,
        "ITEM_NOT_FOUND",
        "Item not found."
      );
    }

    if (
      item.owner_id !==
      userId
    ) {
      return fail(
        403,
        "ITEM_NOT_OWNED",
        "You do not own this item."
      );
    }

    const slot =
      await resolveItemSlot(
        item
      );

    if (!slot) {
      return fail(
        409,
        "ITEM_SLOT_UNAVAILABLE",
        "This item does not have a valid equipment slot."
      );
    }

    const {
      data:
        equipped,

      error:
        equipError,
    } =
      await supabaseAdmin
        .from(
          "player_equipment"
        )
        .upsert(
          {
            user_id:
              userId,

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
        )
        .select(`
          id,
          user_id,
          slot,
          item_id,
          created_at,
          updated_at
        `)
        .single();

    if (
      equipError
    ) {
      if (
        equipError.code ===
        "23505"
      ) {
        return fail(
          409,
          "ITEM_ALREADY_EQUIPPED",
          "This item is already equipped in another slot."
        );
      }

      throw equipError;
    }

    // =====================================================
    // LEGACY COMPATIBILITY
    //
    // Existing Home still uses player_profiles.equipped_item_id.
    // Keep TOP synchronized until Home fully migrates to
    // player_equipment.
    // =====================================================

    if (
      slot ===
      "TOP"
    ) {
      const {
        error:
          legacyError,
      } =
        await supabaseAdmin
          .from(
            "player_profiles"
          )
          .update({
            equipped_item_id:
              item.id,
          })
          .eq(
            "user_id",
            userId
          );

      if (
        legacyError
      ) {
        console.error(
          "LEGACY TOP EQUIP SYNC ERROR:",
          legacyError
        );
      }
    }

    return ok({
      message:
        "Item equipped.",

      slot,

      equipment:
        equipped,

      item: {
        ...item,

        resolved_slot:
          slot,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "POST PLAYER EQUIPMENT ERROR:",
      error
    );

    return fail(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to equip item."
    );
  }
}

// =========================================================
// DELETE
// Unequip one slot
//
// body:
// {
//   "slot": "TOP"
// }
// =========================================================

export async function DELETE(
  request:
    NextRequest
) {
  try {
    const auth =
      await getAuthenticatedUser(
        request
      );

    if (
      auth.error ||
      !auth.user
    ) {
      return auth.error!;
    }

    const userId =
      auth.user.id;

    let body:
      Record<
        string,
        unknown
      >;

    try {
      body =
        await request.json();
    } catch {
      return fail(
        400,
        "INVALID_JSON",
        "Request body must be valid JSON."
      );
    }

    const slotValue =
      typeof body.slot ===
        "string"
        ? body.slot
            .trim()
            .toUpperCase()
        : "";

    if (
      !isSlot(
        slotValue
      )
    ) {
      return fail(
        400,
        "INVALID_SLOT",
        "Valid slot is required."
      );
    }

    const slot =
      slotValue as
        EquipmentSlot;

    const {
      data:
        current,

      error:
        currentError,
    } =
      await supabaseAdmin
        .from(
          "player_equipment"
        )
        .select(
          "id,item_id,slot"
        )
        .eq(
          "user_id",
          userId
        )
        .eq(
          "slot",
          slot
        )
        .maybeSingle();

    if (
      currentError
    ) {
      throw currentError;
    }

    if (!current) {
      return ok({
        message:
          "Slot already empty.",

        slot,
      });
    }

    const {
      error:
        deleteError,
    } =
      await supabaseAdmin
        .from(
          "player_equipment"
        )
        .delete()
        .eq(
          "id",
          current.id
        )
        .eq(
          "user_id",
          userId
        );

    if (
      deleteError
    ) {
      throw deleteError;
    }

    // Keep old Home safe until migration finishes.
    if (
      slot ===
      "TOP"
    ) {
      const {
        data:
          profile,
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
            userId
          )
          .maybeSingle();

      if (
        Number(
          profile
            ?.equipped_item_id
        ) ===
        Number(
          current.item_id
        )
      ) {
        const {
          error:
            legacyError,
        } =
          await supabaseAdmin
            .from(
              "player_profiles"
            )
            .update({
              equipped_item_id:
                null,
            })
            .eq(
              "user_id",
              userId
            );

        if (
          legacyError
        ) {
          console.error(
            "LEGACY TOP UNEQUIP SYNC ERROR:",
            legacyError
          );
        }
      }
    }

    return ok({
      message:
        "Item unequipped.",

      slot,

      item_id:
        current.item_id,
    });
  } catch (
    error
  ) {
    console.error(
      "DELETE PLAYER EQUIPMENT ERROR:",
      error
    );

    return fail(
      500,
      "INTERNAL_SERVER_ERROR",
      "Unable to unequip item."
    );
  }
}