import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

// =====================================
// GET PUBLIC SEASON CONFIG
// =====================================

export async function GET() {
  try {
    // =====================================
    // FIND ACTIVE SEASON
    // =====================================

    const {
      data: activeSeason,
      error: activeError,
    } = await supabaseAdmin
      .from("season_settings")
      .select(`
        id,
        season_code,
        season_name,
        product_name,
        craft_cost,
        common_rate,
        rare_rate,
        epic_rate,
        legendary_rate,
        is_active,
        updated_at
      `)
      .eq("is_active", true)
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (activeError) {
      throw activeError;
    }

    if (activeSeason) {
      return NextResponse.json({
        success: true,
        season: activeSeason,
      });
    }

    // =====================================
    // NO ACTIVE DROP
    // RETURN LATEST SEASON AS INACTIVE
    // =====================================

    const {
      data: latestSeason,
      error: latestError,
    } = await supabaseAdmin
      .from("season_settings")
      .select(`
        id,
        season_code,
        season_name,
        product_name,
        craft_cost,
        common_rate,
        rare_rate,
        epic_rate,
        legendary_rate,
        is_active,
        updated_at
      `)
      .order("id", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    if (!latestSeason) {
      return NextResponse.json(
        {
          success: false,
          message: "ยังไม่มี Season ในระบบ",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      season: latestSeason,
    });
  } catch (error) {
    console.error(
      "PUBLIC SEASON API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load Season",
      },
      {
        status: 500,
      }
    );
  }
}