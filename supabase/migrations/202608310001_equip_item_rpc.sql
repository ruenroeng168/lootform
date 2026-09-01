-- LOOTFORM Equip/Unequip RPC for external clients
-- Date: 2026-08-31
--
-- Purpose:
--   The standalone "Game for Lootform" Battle RPG (a separate app, no
--   backend of its own, only the Supabase anon key + a logged-in user's
--   session) needs to let a player change which real LOOTFORM item is
--   equipped, directly from its own Character screen, and have that
--   change reflect on both the real website and the game.
--
--   Audited before writing this file: equip/unequip today ONLY happens
--   through two Next.js API routes (app/api/profile/equipment/route.ts,
--   app/api/profile/equip/route.ts), both writing via supabaseAdmin
--   (service-role key). There is no RLS write policy and no RPC granting
--   `authenticated` write access to player_equipment -- confirmed via
--   pg_policies and a repo-wide search. A separate app has no legitimate
--   way to write that table today.
--
--   This migration adds exactly one new capability -- two SECURITY
--   DEFINER RPCs any authenticated user can call directly via
--   supabase.rpc(...), scoped to auth.uid() so a caller can only ever
--   equip/unequip their OWN items. Mirrors the existing API routes'
--   validation logic (ownership check, slot resolution via
--   equip_slot_snapshot -> products.equip_slot fallback, the TOP ->
--   player_profiles.equipped_item_id legacy mirror) exactly, so both the
--   website and the game see the identical result either way.
--
--   The existing Next.js API routes are NOT touched or replaced -- this
--   is purely additive, a second entry point to the same effect.
--
-- Schema audited live (not tracked in migrations):
--   player_equipment(id, user_id, slot, item_id, created_at, updated_at)
--   constraints: player_equipment_user_slot_unique UNIQUE(user_id, slot),
--                player_equipment_item_unique UNIQUE(item_id),
--                player_equipment_slot_check CHECK slot IN
--                  ('HEAD','TOP','BOTTOM','SHOES','ACCESSORY')

BEGIN;

CREATE OR REPLACE FUNCTION public.equip_item_atomic(
  p_item_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.items%ROWTYPE;
  v_slot text;
  v_equipment public.player_equipment%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'LOOTFORM_UNAUTHENTICATED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_item_id IS NULL OR p_item_id <= 0 THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_ITEM_ID'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOOTFORM_ITEM_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_item.owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'LOOTFORM_ITEM_NOT_OWNED'
      USING ERRCODE = 'P0001';
  END IF;

  -- Resolve slot exactly like resolveItemSlot() in
  -- app/api/profile/equipment/route.ts: the item's own snapshot first,
  -- else its product's configured equip_slot.
  IF v_item.equip_slot_snapshot IN ('HEAD', 'TOP', 'BOTTOM', 'SHOES', 'ACCESSORY') THEN
    v_slot := v_item.equip_slot_snapshot;
  ELSIF v_item.product_id IS NOT NULL THEN
    SELECT equip_slot
    INTO v_slot
    FROM public.products
    WHERE id = v_item.product_id;
  END IF;

  IF v_slot IS NULL OR v_slot NOT IN ('HEAD', 'TOP', 'BOTTOM', 'SHOES', 'ACCESSORY') THEN
    RAISE EXCEPTION 'LOOTFORM_ITEM_SLOT_UNAVAILABLE'
      USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.player_equipment (user_id, slot, item_id, created_at, updated_at)
    VALUES (v_user_id, v_slot, v_item.id, now(), now())
    ON CONFLICT (user_id, slot) DO UPDATE
      SET item_id = EXCLUDED.item_id,
          updated_at = now()
    RETURNING *
    INTO v_equipment;
  EXCEPTION WHEN unique_violation THEN
    -- Either the (user_id, slot) upsert target or the separate
    -- UNIQUE(item_id) constraint fired -- same friendly meaning either
    -- way: this exact item is already equipped somewhere.
    RAISE EXCEPTION 'LOOTFORM_ITEM_ALREADY_EQUIPPED'
      USING ERRCODE = 'P0001';
  END;

  -- Legacy compatibility: Home still reads player_profiles.equipped_item_id
  -- for TOP, same mirror the existing API route performs.
  IF v_slot = 'TOP' THEN
    UPDATE public.player_profiles
    SET equipped_item_id = v_item.id
    WHERE user_id = v_user_id;
  END IF;

  RETURN jsonb_build_object(
    'slot', v_slot,
    'item_id', v_item.id,
    'equipment_id', v_equipment.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.unequip_equipment_slot(
  p_slot text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_slot text := upper(btrim(COALESCE(p_slot, '')));
  v_current public.player_equipment%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'LOOTFORM_UNAUTHENTICATED'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_slot NOT IN ('HEAD', 'TOP', 'BOTTOM', 'SHOES', 'ACCESSORY') THEN
    RAISE EXCEPTION 'LOOTFORM_INVALID_SLOT'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_current
  FROM public.player_equipment
  WHERE user_id = v_user_id
    AND slot = v_slot;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'slot', v_slot,
      'message', 'Slot already empty.'
    );
  END IF;

  DELETE FROM public.player_equipment
  WHERE id = v_current.id
    AND user_id = v_user_id;

  -- Only clear the legacy mirror if it still points at the item we just
  -- removed (matches the existing API route's guard exactly).
  IF v_slot = 'TOP' THEN
    UPDATE public.player_profiles
    SET equipped_item_id = NULL
    WHERE user_id = v_user_id
      AND equipped_item_id = v_current.item_id;
  END IF;

  RETURN jsonb_build_object(
    'slot', v_slot,
    'item_id', v_current.item_id,
    'message', 'Item unequipped.'
  );
END;
$$;

-- Unlike lootform_craft_atomic (service_role only, called from a Next.js
-- API route), these two are meant to be called directly by any logged-in
-- user's own browser session -- that's the entire point of this file.
REVOKE ALL ON FUNCTION public.equip_item_atomic(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equip_item_atomic(bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.equip_item_atomic(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_item_atomic(bigint) TO service_role;

REVOKE ALL ON FUNCTION public.unequip_equipment_slot(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unequip_equipment_slot(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.unequip_equipment_slot(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unequip_equipment_slot(text) TO service_role;

COMMIT;
