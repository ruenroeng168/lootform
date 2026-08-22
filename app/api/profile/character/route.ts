import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM
   STEP 10D-6A
   PLAYER CHARACTER API

   GET
   - Authenticate Player
   - Load player_profiles.character_model_id
   - Load Character Model
   - Return safe Character data

   IMPORTANT
   - Character does NOT need to remain active
     for an existing Player assignment.
   - is_active controls future availability,
     not whether an existing Player can render it.
========================================================= */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

type PlayerProfileRow = {
  user_id: string;

  character_model_id:
    | number
    | null;
};

type CharacterRow = {
  id: number;

  code: string;

  name: string;

  description:
    | string
    | null;

  version: number;

  thumbnail_url:
    | string
    | null;

  thumbnail_path:
    | string
    | null;

  model_url:
    | string
    | null;

  model_path:
    | string
    | null;

  is_active: boolean;

  is_default: boolean;

  sort_order: number;
};

/* =========================================================
   RESPONSE
========================================================= */

function errorResponse(
  error: string,
  status = 400,
  code = "PLAYER_CHARACTER_ERROR"
) {
  return NextResponse.json(
    {
      ok: false,

      code,

      error,
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

function successResponse(
  data: Record<
    string,
    unknown
  >
) {
  return NextResponse.json(
    {
      ok: true,

      ...data,
    },
    {
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

/* =========================================================
   AUTH
========================================================= */

async function getAuthenticatedUser(
  request: NextRequest
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
      ok: false as const,

      response:
        errorResponse(
          "Unauthorized",
          401,
          "UNAUTHORIZED"
        ),
    };
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    return {
      ok: false as const,

      response:
        errorResponse(
          "Unauthorized",
          401,
          "UNAUTHORIZED"
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
      ok: false as const,

      response:
        errorResponse(
          "Invalid or expired session",
          401,
          "INVALID_SESSION"
        ),
    };
  }

  return {
    ok: true as const,

    user:
      data.user,
  };
}

/* =========================================================
   LOAD DEFAULT CHARACTER
========================================================= */

async function loadDefaultCharacter() {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "character_models"
      )
      .select(`
        id,
        code,
        name,
        description,
        version,
        thumbnail_url,
        thumbnail_path,
        model_url,
        model_path,
        is_active,
        is_default,
        sort_order
      `)
      .eq(
        "is_active",
        true
      )
      .eq(
        "is_default",
        true
      )
      .order(
        "sort_order",
        {
          ascending:
            true,
        }
      )
      .order(
        "id",
        {
          ascending:
            true,
        }
      )
      .limit(
        1
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data as
      | CharacterRow
      | null
  );
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    /* =====================================================
       1. AUTH
    ===================================================== */

    const auth =
      await getAuthenticatedUser(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    const user =
      auth.user;

    /* =====================================================
       2. PLAYER PROFILE
    ===================================================== */

    const {
      data:
        profileData,

      error:
        profileError,
    } =
      await supabaseAdmin
        .from(
          "player_profiles"
        )
        .select(`
          user_id,
          character_model_id
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
        "PLAYER CHARACTER PROFILE ERROR:",
        profileError
      );

      return errorResponse(
        profileError.message,
        500,
        "PROFILE_QUERY_FAILED"
      );
    }

    if (
      !profileData
    ) {
      return errorResponse(
        "Player Profile not found",
        404,
        "PROFILE_NOT_FOUND"
      );
    }

    const profile =
      profileData as
        PlayerProfileRow;

    /* =====================================================
       3. LOAD ASSIGNED CHARACTER
    ===================================================== */

    let character:
      CharacterRow | null =
        null;

    if (
      profile
        .character_model_id
    ) {
      const {
        data:
          characterData,

        error:
          characterError,
      } =
        await supabaseAdmin
          .from(
            "character_models"
          )
          .select(`
            id,
            code,
            name,
            description,
            version,
            thumbnail_url,
            thumbnail_path,
            model_url,
            model_path,
            is_active,
            is_default,
            sort_order
          `)
          .eq(
            "id",
            profile
              .character_model_id
          )
          .maybeSingle();

      if (
        characterError
      ) {
        console.error(
          "PLAYER CHARACTER QUERY ERROR:",
          characterError
        );

        return errorResponse(
          characterError.message,
          500,
          "CHARACTER_QUERY_FAILED"
        );
      }

      character =
        characterData as
          | CharacterRow
          | null;
    }

    /* =====================================================
       4. SAFETY FALLBACK

       If an old / malformed Profile has no Character,
       return the current Default Character.

       We do NOT silently overwrite the Profile here.
    ===================================================== */

    let fallbackUsed =
      false;

    if (!character) {
      try {
        character =
          await loadDefaultCharacter();

        fallbackUsed =
          Boolean(
            character
          );
      } catch (
        fallbackError
      ) {
        console.error(
          "DEFAULT CHARACTER FALLBACK ERROR:",
          fallbackError
        );

        return errorResponse(
          fallbackError instanceof
          Error
            ? fallbackError.message
            : "Unable to load Default Character",
          500,
          "DEFAULT_CHARACTER_QUERY_FAILED"
        );
      }
    }

    /* =====================================================
       5. CHARACTER REQUIRED
    ===================================================== */

    if (!character) {
      return errorResponse(
        "No Character is available",
        404,
        "CHARACTER_NOT_AVAILABLE"
      );
    }

    /* =====================================================
       6. MODEL REQUIRED FOR 3D RENDERING
    ===================================================== */

    const modelReady =
      Boolean(
        character
          .model_url
      );

    const imageReady =
      Boolean(
        character
          .thumbnail_url
      );

    /* =====================================================
       7. SUCCESS
    ===================================================== */

    return successResponse({
      profile: {
        user_id:
          profile.user_id,

        character_model_id:
          profile
            .character_model_id,
      },

      character: {
        id:
          character.id,

        code:
          character.code,

        name:
          character.name,

        description:
          character.description,

        version:
          character.version,

        thumbnail_url:
          character
            .thumbnail_url,

        model_url:
          character
            .model_url,

        is_active:
          character
            .is_active,

        is_default:
          character
            .is_default,

        image_ready:
          imageReady,

        model_ready:
          modelReady,
      },

      fallback_used:
        fallbackUsed,
    });
  } catch (
    error
  ) {
    console.error(
      "PLAYER CHARACTER API INTERNAL ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to load Player Character",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}