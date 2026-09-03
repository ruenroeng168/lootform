-- LOOTFORM Beta Reset: also wipe Game Coin / Expedition data
-- Date: 2026-09-03
--
-- Context:
--   reset_lootform_beta() (202608252000_manual_topup_review.sql...
--   actually defined outside this repo's migrations originally) only
--   ever cleared the Craft/LT economy: items, wallet_transactions,
--   topup_orders, wallets. The Game Coin / Expedition subsystem
--   (game_sessions, game_events, game_encounters, game_session_state,
--   game_session_loot, game_results, game_coin_wallets,
--   game_coin_transactions, player_game_inventory,
--   game_inventory_transactions, player_exp_transactions) was added
--   later and the reset function never learned about it -- confirmed
--   via information_schema that none of these tables even have an
--   environment_mode column (that split only exists on the LT side),
--   so a full wipe is the only sensible interpretation once the
--   outer system_settings.environment_mode = 'TEST' gate has already
--   passed.
--
--   Also clears rpgmaker_player_state -- currently unused (0 rows,
--   no bridge plugin ported to MZ yet), included so the Reset
--   already covers it once the RPG Maker Bridge lands. This does
--   NOT and CANNOT reset the standalone RPG Maker MZ game's own
--   local save file -- that requires the not-yet-built Bridge
--   ("Reset Epoch" mechanism) on the MZ side; out of scope here.
--
--   player_profiles.level/exp intentionally left untouched -- that
--   column is shared with the Collection/Member Home concept per
--   /lootform-project's critical checkpoint list, not exclusively
--   Game/Expedition data, so it's not touched without a separate,
--   explicit decision.
--
-- Deletion order respects FK dependencies (children before parents):
--   leaves -> game_encounters -> game_events -> game_sessions
--
-- NOT YET APPLIED to the live project -- saved locally for review/testing.

BEGIN;

CREATE OR REPLACE FUNCTION public.reset_lootform_beta(p_admin_user_id uuid, p_confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_mode text;

  v_test_items integer := 0;
  v_test_transactions integer := 0;
  v_test_topup_orders integer := 0;

  v_wallets_reset integer := 0;

  v_live_items integer := 0;
  v_live_transactions integer := 0;
  v_live_topup_orders integer := 0;

  v_game_sessions_deleted integer := 0;
  v_game_events_deleted integer := 0;
  v_game_coin_wallets_reset integer := 0;
  v_rpgmaker_states_deleted integer := 0;
begin

  -- =======================================================
  -- CONFIRMATION
  -- =======================================================

  if p_confirmation is distinct from 'RESET LOOTFORM BETA' then
    raise exception 'INVALID_RESET_CONFIRMATION';
  end if;

  -- =======================================================
  -- LOCK SYSTEM SETTINGS
  -- =======================================================

  select environment_mode
  into v_mode
  from public.system_settings
  where id = 1
  for update;

  if v_mode is null then
    raise exception 'SYSTEM_SETTINGS_NOT_FOUND';
  end if;

  -- =======================================================
  -- TEST MODE ONLY
  -- =======================================================

  if v_mode <> 'TEST' then
    raise exception 'RESET_NOT_ALLOWED_IN_LIVE_MODE';
  end if;

  -- =======================================================
  -- LIVE DATA SAFETY (Craft/LT side only -- the only tables
  -- that carry an environment_mode split)
  -- =======================================================

  select count(*)
  into v_live_items
  from public.items
  where environment_mode = 'LIVE';

  select count(*)
  into v_live_transactions
  from public.wallet_transactions
  where environment_mode = 'LIVE';

  select count(*)
  into v_live_topup_orders
  from public.topup_orders
  where environment_mode = 'LIVE';

  if
    v_live_items > 0
    or v_live_transactions > 0
    or v_live_topup_orders > 0
  then
    raise exception
      'LIVE_DATA_DETECTED_RESET_ABORTED';
  end if;

  -- =======================================================
  -- COUNT TEST DATA (Craft/LT side)
  -- =======================================================

  select count(*)
  into v_test_items
  from public.items
  where environment_mode = 'TEST';

  select count(*)
  into v_test_transactions
  from public.wallet_transactions
  where environment_mode = 'TEST';

  select count(*)
  into v_test_topup_orders
  from public.topup_orders
  where environment_mode = 'TEST';

  select count(*)
  into v_wallets_reset
  from public.wallets
  where id is not null;

  -- =======================================================
  -- COUNT GAME COIN / EXPEDITION DATA
  -- =======================================================

  select count(*) into v_game_sessions_deleted from public.game_sessions;
  select count(*) into v_game_events_deleted from public.game_events;
  select count(*) into v_game_coin_wallets_reset from public.game_coin_wallets;
  select count(*) into v_rpgmaker_states_deleted from public.rpgmaker_player_state;

  -- =======================================================
  -- DELETE TEST LEDGER (Craft/LT)
  -- =======================================================

  delete from public.wallet_transactions
  where environment_mode = 'TEST';

  -- =======================================================
  -- DELETE TEST TOP-UP ORDERS (Craft/LT)
  -- =======================================================

  delete from public.topup_orders
  where environment_mode = 'TEST';

  -- =======================================================
  -- DELETE TEST ITEMS (Craft/LT)
  -- =======================================================

  delete from public.items
  where environment_mode = 'TEST';

  -- =======================================================
  -- RESET WALLET BALANCES (Craft/LT)
  -- =======================================================

  update public.wallets
  set
    balance = 0,
    updated_at = now()
  where id is not null;

  -- =======================================================
  -- WIPE GAME COIN / EXPEDITION (no environment_mode split --
  -- full wipe is correct once we're already gated on TEST mode)
  -- =======================================================

  delete from public.player_exp_transactions;
  delete from public.game_session_loot;
  delete from public.game_inventory_transactions;
  delete from public.game_coin_transactions;
  delete from public.player_game_inventory;
  delete from public.game_results;
  delete from public.game_session_state;
  delete from public.game_encounters;
  delete from public.game_events;
  delete from public.game_sessions;

  update public.game_coin_wallets
  set
    balance = 0,
    updated_at = now();

  -- Placeholder for the not-yet-built RPG Maker Bridge -- currently
  -- always 0 rows, cleared here so Reset already covers it once
  -- the Bridge starts writing to this table.
  delete from public.rpgmaker_player_state;

  -- =======================================================
  -- RESET LOG
  -- =======================================================

  insert into public.system_reset_logs (
    reset_type,
    environment_mode,
    items_deleted,
    transactions_deleted,
    wallets_reset,
    topup_orders_deleted,
    performed_by,
    note
  )
  values (
    'BETA_RESET',
    'TEST',
    v_test_items,
    v_test_transactions,
    v_wallets_reset,
    v_test_topup_orders,
    p_admin_user_id,
    format(
      'SAFE RESET LOOTFORM BETA + GAME/EXPEDITION WIPE: sessions=%s events=%s game_coin_wallets_reset=%s rpgmaker_states=%s',
      v_game_sessions_deleted,
      v_game_events_deleted,
      v_game_coin_wallets_reset,
      v_rpgmaker_states_deleted
    )
  );

  -- =======================================================
  -- UPDATE SYSTEM
  -- =======================================================

  update public.system_settings
  set
    updated_at = now()
  where id = 1;

  -- =======================================================
  -- RESULT
  -- =======================================================

  return jsonb_build_object(
    'success', true,
    'environment_mode', v_mode,
    'items_deleted', v_test_items,
    'transactions_deleted', v_test_transactions,
    'topup_orders_deleted', v_test_topup_orders,
    'wallets_reset', v_wallets_reset,
    'game_sessions_deleted', v_game_sessions_deleted,
    'game_events_deleted', v_game_events_deleted,
    'game_coin_wallets_reset', v_game_coin_wallets_reset,
    'rpgmaker_states_deleted', v_rpgmaker_states_deleted
  );

end;
$function$;

COMMIT;
