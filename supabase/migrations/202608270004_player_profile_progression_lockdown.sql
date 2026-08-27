-- LOOTFORM Player Profile Progression Lockdown (security hardening)
-- Date: 2026-08-27
--
-- Discovered during STEP 4A.1 (displaying Player LV on /game/play):
-- public.player_profiles has an RLS UPDATE policy ("Players can
-- update own profile") scoped only to auth.uid() = user_id, with NO
-- column restriction. Postgres RLS cannot restrict which columns an
-- UPDATE touches -- only whether the row is visible/writable at all.
-- The policy is genuinely needed: app/account/page.tsx legitimately
-- calls the client-side (anon-key) Supabase client to update the
-- caller's own display_name. But the same open policy also lets any
-- authenticated user UPDATE their own level, exp, equipped_item_id,
-- or character_model_id directly from the browser -- e.g.
-- supabase.from('player_profiles').update({ level: 999, exp: 999999
-- }).eq('user_id', <self>) -- with no server involved at all.
--
-- Audited: grepped the entire app for player_profiles writes.
-- app/api/profile/equip/route.ts and .../character/route.ts are the
-- only legitimate writers of equipped_item_id / character_model_id,
-- and both already use supabaseAdmin (service_role), which this
-- trigger does not touch. Nothing anywhere legitimately writes
-- level/exp from the client -- there is currently no reward flow
-- that grants EXP at all (see STEP 4A.1 report,
-- CHARACTER_PROGRESSION_AUTHORITY_PENDING).
--
-- Fix: a BEFORE UPDATE trigger re-pins the four progression/
-- ownership columns to their existing value whenever the write is
-- not made with the service_role JWT, using auth.role() (Supabase's
-- own JWT-role helper) exactly the way this project already
-- distinguishes "server-trusted write" from "client write"
-- everywhere else (SECURITY DEFINER functions granted only to
-- service_role). This preserves the legitimate display_name update
-- unchanged and requires no application code change.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_player_profile_progression_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    NEW.level := OLD.level;
    NEW.exp := OLD.exp;
    NEW.equipped_item_id := OLD.equipped_item_id;
    NEW.character_model_id := OLD.character_model_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_player_profile_progression_columns() IS
  'BEFORE UPDATE trigger on player_profiles. RLS alone cannot '
  'restrict which columns an UPDATE touches, and the existing '
  '"Players can update own profile" policy is genuinely needed for '
  'display_name self-service (app/account/page.tsx). This trigger '
  'pins level/exp/equipped_item_id/character_model_id back to their '
  'prior value on any write that is not made with the service_role '
  'JWT, so a client can no longer set its own Level/EXP or equip an '
  'item by writing the row directly -- those remain server-only '
  '(app/api/profile/equip, .../character, and any future EXP-award '
  'RPC).';

DROP TRIGGER IF EXISTS trg_protect_player_profile_progression
  ON public.player_profiles;

CREATE TRIGGER trg_protect_player_profile_progression
  BEFORE UPDATE ON public.player_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_player_profile_progression_columns();

COMMIT;
