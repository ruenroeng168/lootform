import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type MyCollectionRankRow = {
  user_id: string;

  collection_score: number | string;

  global_rank: number | string;

  total_players: number | string;

  total_items: number | string;

  common_items: number | string;

  rare_items: number | string;

  epic_items: number | string;

  legendary_items: number | string;
};

export async function GET(
  request: NextRequest
) {
  try {
    // =====================================================
    // 1. READ BEARER TOKEN
    // =====================================================

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          error: "Missing access token.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const accessToken =
      authorization.slice("Bearer ".length).trim();

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          error: "Missing access token.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // =====================================================
    // 2. VERIFY USER
    // =====================================================

    const {
      data: userData,
      error: userError,
    } =
      await supabaseAdmin.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !userData.user
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "UNAUTHORIZED",
          error: "Invalid or expired access token.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // =====================================================
    // 3. CREATE USER-SCOPED SUPABASE CLIENT
    //
    // IMPORTANT:
    // get_my_collection_rank() uses auth.uid()
    // so the RPC must run with the Player JWT,
    // not with service_role.
    // =====================================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabasePublishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (
      !supabaseUrl ||
      !supabasePublishableKey
    ) {
      console.error(
        "RANK API: Missing Supabase public environment variables."
      );

      return NextResponse.json(
        {
          ok: false,
          code: "SERVER_CONFIG_ERROR",
          error: "Server configuration error.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const userSupabase =
      createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },

          global: {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        }
      );

    // =====================================================
    // 4. GET LIVE COLLECTION SCORE + GLOBAL RANK
    // =====================================================

    const {
      data,
      error,
    } =
      await userSupabase.rpc(
        "get_my_collection_rank"
      );

    if (error) {
      console.error(
        "RANK RPC ERROR:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          code: "RANK_QUERY_FAILED",
          error: error.message,
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const row =
      Array.isArray(data) &&
      data.length > 0
        ? (data[0] as MyCollectionRankRow)
        : null;

    if (!row) {
      return NextResponse.json(
        {
          ok: false,
          code: "RANK_NOT_FOUND",
          error: "Player rank data was not found.",
        },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // =====================================================
    // 5. NORMALIZE NUMERIC VALUES
    // =====================================================

    const rank = {
      collection_score:
        Number(
          row.collection_score ?? 0
        ),

      global_rank:
        Number(
          row.global_rank ?? 0
        ),

      total_players:
        Number(
          row.total_players ?? 0
        ),

      total_items:
        Number(
          row.total_items ?? 0
        ),

      common_items:
        Number(
          row.common_items ?? 0
        ),

      rare_items:
        Number(
          row.rare_items ?? 0
        ),

      epic_items:
        Number(
          row.epic_items ?? 0
        ),

      legendary_items:
        Number(
          row.legendary_items ?? 0
        ),
    };

    // =====================================================
    // 6. RESPONSE
    // =====================================================

    return NextResponse.json(
      {
        ok: true,

        rank,

        player: {
          user_id:
            userData.user.id,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "PROFILE RANK API ERROR:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_SERVER_ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}