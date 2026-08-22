import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

/* =========================================================
   LOOTFORM
   STEP 10D-2B2
   ADMIN CHARACTER API

   GET
   - Load Character Library

   POST
   - create_character

   PATCH
   - update_character
   - set_default

   SECURITY
   - Bearer Supabase session
   - ADMIN_EMAILS
   - service_role database access
========================================================= */

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================================
   TYPES
========================================================= */

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

  created_at: string;
  updated_at: string;
};

type AdminAuthSuccess = {
  ok: true;

  userId: string;
  email: string;
};

type AdminAuthFailure = {
  ok: false;

  response: NextResponse;
};

type AdminAuthResult =
  | AdminAuthSuccess
  | AdminAuthFailure;

/* =========================================================
   RESPONSE HELPERS
========================================================= */

function successResponse(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      ok: true,
      ...data,
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

function errorResponse(
  error: string,
  status = 400,
  code = "CHARACTER_API_ERROR"
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

/* =========================================================
   TEXT HELPERS
========================================================= */

function cleanText(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

function nullableText(
  value: unknown
) {
  const text =
    cleanText(value);

  return text
    ? text
    : null;
}

/* =========================================================
   CHARACTER CODE
========================================================= */

function normalizeCode(
  value: unknown
) {
  return cleanText(value)
    .toUpperCase()
    .replace(
      /\s+/g,
      "-"
    );
}

function isValidCode(
  code: string
) {
  return /^[A-Z0-9][A-Z0-9_-]*$/.test(
    code
  );
}

/* =========================================================
   NUMBER HELPERS
========================================================= */

function parsePositiveInteger(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function parseNonNegativeInteger(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

/* =========================================================
   BOOLEAN
========================================================= */

function parseBoolean(
  value: unknown
):
  | boolean
  | undefined {
  if (
    value === true ||
    value === false
  ) {
    return value;
  }

  return undefined;
}

/* =========================================================
   ADMIN AUTH
========================================================= */

async function requireAdmin(
  request: NextRequest
): Promise<AdminAuthResult> {
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
      ok: false,

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
      ok: false,

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
      ok: false,

      response:
        errorResponse(
          "Invalid or expired session",
          401,
          "INVALID_SESSION"
        ),
    };
  }

  const email =
    (
      data.user.email ??
      ""
    )
      .trim()
      .toLowerCase();

  const adminEmails =
    (
      process.env
        .ADMIN_EMAILS ??
      ""
    )
      .split(",")
      .map(
        (item) =>
          item
            .trim()
            .toLowerCase()
      )
      .filter(Boolean);

  if (
    !email ||
    !adminEmails.includes(
      email
    )
  ) {
    return {
      ok: false,

      response:
        errorResponse(
          "Admin access required",
          403,
          "ADMIN_REQUIRED"
        ),
    };
  }

  return {
    ok: true,

    userId:
      data.user.id,

    email,
  };
}

/* =========================================================
   CHARACTER SELECT
========================================================= */

const CHARACTER_SELECT = `
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
  sort_order,
  created_at,
  updated_at
`;

/* =========================================================
   DECORATE CHARACTER
========================================================= */

function decorateCharacter(
  row: CharacterRow
) {
  return {
    ...row,

    image_ready:
      Boolean(
        row.thumbnail_url
      ),

    model_ready:
      Boolean(
        row.model_url
      ),

    status:
      row.is_default
        ? "DEFAULT"
        : row.is_active
        ? "ACTIVE"
        : "DRAFT",
  };
}

/* =========================================================
   LOAD ONE CHARACTER
========================================================= */

async function loadCharacter(
  characterId: number
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "character_models"
      )
      .select(
        CHARACTER_SELECT
      )
      .eq(
        "id",
        characterId
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
   LOAD CHARACTER LIBRARY
========================================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const auth =
      await requireAdmin(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "character_models"
        )
        .select(
          CHARACTER_SELECT
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
        );

    if (error) {
      console.error(
        "ADMIN CHARACTER GET ERROR:",
        error
      );

      return errorResponse(
        error.message,
        500,
        "CHARACTER_QUERY_FAILED"
      );
    }

    const characters =
      (
        (data ?? []) as
          CharacterRow[]
      ).map(
        decorateCharacter
      );

    const defaultCharacter =
      characters.find(
        (character) =>
          character.is_default
      ) ?? null;

    return successResponse({
      admin: {
        email:
          auth.email,
      },

      characters,

      count:
        characters.length,

      active_count:
        characters.filter(
          (character) =>
            character.is_active
        ).length,

      default_character:
        defaultCharacter,
    });
  } catch (
    error
  ) {
    console.error(
      "ADMIN CHARACTER GET INTERNAL ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to load Character Library",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}

/* =========================================================
   POST
   CREATE CHARACTER DRAFT
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    const auth =
      await requireAdmin(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    let body:
      Record<string, unknown>;

    try {
      body =
        await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON body",
        400,
        "INVALID_JSON"
      );
    }

    const action =
      cleanText(
        body.action
      );

    if (
      action !==
      "create_character"
    ) {
      return errorResponse(
        "Unsupported action",
        400,
        "INVALID_ACTION"
      );
    }

    /* =====================================================
       CODE
    ===================================================== */

    const code =
      normalizeCode(
        body.code
      );

    if (!code) {
      return errorResponse(
        "Character Code is required",
        400,
        "CODE_REQUIRED"
      );
    }

    if (
      !isValidCode(
        code
      )
    ) {
      return errorResponse(
        "Character Code may contain only A-Z, 0-9, _ and -",
        400,
        "INVALID_CODE"
      );
    }

    /* =====================================================
       NAME
    ===================================================== */

    const name =
      cleanText(
        body.name
      );

    if (!name) {
      return errorResponse(
        "Character Name is required",
        400,
        "NAME_REQUIRED"
      );
    }

    /* =====================================================
       VERSION
    ===================================================== */

    const version =
      body.version ===
      undefined
        ? 1
        : parsePositiveInteger(
            body.version
          );

    if (!version) {
      return errorResponse(
        "Version must be an integer greater than 0",
        400,
        "INVALID_VERSION"
      );
    }

    /* =====================================================
       SORT ORDER
    ===================================================== */

    const sortOrder =
      body.sort_order ===
      undefined
        ? 0
        : parseNonNegativeInteger(
            body.sort_order
          );

    if (
      sortOrder ===
      null
    ) {
      return errorResponse(
        "Sort Order must be 0 or greater",
        400,
        "INVALID_SORT_ORDER"
      );
    }

    /* =====================================================
       CREATE AS DRAFT

       Important:
       New Character never becomes ACTIVE automatically.
    ===================================================== */

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "character_models"
        )
        .insert({
          code,

          name,

          description:
            nullableText(
              body.description
            ),

          version,

          thumbnail_url:
            null,

          thumbnail_path:
            null,

          model_url:
            null,

          model_path:
            null,

          is_active:
            false,

          is_default:
            false,

          sort_order:
            sortOrder,
        })
        .select(
          CHARACTER_SELECT
        )
        .single();

    if (error) {
      console.error(
        "CREATE CHARACTER ERROR:",
        error
      );

      if (
        error.code ===
        "23505"
      ) {
        return errorResponse(
          `Character ${code} Version ${version} already exists`,
          409,
          "CHARACTER_VERSION_EXISTS"
        );
      }

      return errorResponse(
        error.message,
        500,
        "CHARACTER_CREATE_FAILED"
      );
    }

    const character =
      decorateCharacter(
        data as CharacterRow
      );

    return successResponse(
      {
        character,

        message:
          `${character.name} created as DRAFT.`,
      },
      201
    );
  } catch (
    error
  ) {
    console.error(
      "ADMIN CHARACTER POST INTERNAL ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to create Character",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}

/* =========================================================
   PATCH
========================================================= */

export async function PATCH(
  request: NextRequest
) {
  try {
    const auth =
      await requireAdmin(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    let body:
      Record<string, unknown>;

    try {
      body =
        await request.json();
    } catch {
      return errorResponse(
        "Invalid JSON body",
        400,
        "INVALID_JSON"
      );
    }

    const action =
      cleanText(
        body.action
      );

    /* =====================================================
       CHARACTER ID
    ===================================================== */

    const characterId =
      parsePositiveInteger(
        body.character_id
      );

    if (!characterId) {
      return errorResponse(
        "Invalid character_id",
        400,
        "INVALID_CHARACTER_ID"
      );
    }

    /* =====================================================
       LOAD CURRENT CHARACTER
    ===================================================== */

    let current:
      CharacterRow | null;

    try {
      current =
        await loadCharacter(
          characterId
        );
    } catch (
      error
    ) {
      console.error(
        "LOAD CHARACTER ERROR:",
        error
      );

      return errorResponse(
        error instanceof Error
          ? error.message
          : "Unable to load Character",
        500,
        "CHARACTER_QUERY_FAILED"
      );
    }

    if (!current) {
      return errorResponse(
        "Character not found",
        404,
        "CHARACTER_NOT_FOUND"
      );
    }

    /* =====================================================
       ACTION: SET DEFAULT
    ===================================================== */

    if (
      action ===
      "set_default"
    ) {
      /*
        A Character without a GLB cannot become
        the live default Character.
      */

      if (
        !current.model_url
      ) {
        return errorResponse(
          "Import a Character GLB before setting this Character as Default",
          409,
          "CHARACTER_MODEL_REQUIRED"
        );
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .rpc(
            "set_default_character_model",
            {
              target_character_id:
                characterId,
            }
          );

      if (error) {
        console.error(
          "SET DEFAULT CHARACTER ERROR:",
          error
        );

        return errorResponse(
          error.message,
          500,
          "SET_DEFAULT_FAILED"
        );
      }

      /*
        Depending on PostgREST version,
        composite-returning RPC may be returned
        as an object or one-element array.

        Reload from the source table so our API
        response is always consistent.
      */

      void data;

      let updated:
        CharacterRow | null;

      try {
        updated =
          await loadCharacter(
            characterId
          );
      } catch (
        error
      ) {
        return errorResponse(
          error instanceof Error
            ? error.message
            : "Unable to reload Default Character",
          500,
          "CHARACTER_RELOAD_FAILED"
        );
      }

      if (!updated) {
        return errorResponse(
          "Character disappeared after setting Default",
          500,
          "CHARACTER_RELOAD_FAILED"
        );
      }

      return successResponse({
        character:
          decorateCharacter(
            updated
          ),

        message:
          `${updated.name} is now the Default Character.`,
      });
    }

    /* =====================================================
       ACTION: UPDATE CHARACTER
    ===================================================== */

    if (
      action !==
      "update_character"
    ) {
      return errorResponse(
        "Unsupported action",
        400,
        "INVALID_ACTION"
      );
    }

    /* =====================================================
       BUILD UPDATE
    ===================================================== */

    const update:
      Record<
        string,
        unknown
      > = {};

    /* =====================================================
       CODE
    ===================================================== */

    if (
      body.code !==
      undefined
    ) {
      const code =
        normalizeCode(
          body.code
        );

      if (!code) {
        return errorResponse(
          "Character Code is required",
          400,
          "CODE_REQUIRED"
        );
      }

      if (
        !isValidCode(
          code
        )
      ) {
        return errorResponse(
          "Character Code may contain only A-Z, 0-9, _ and -",
          400,
          "INVALID_CODE"
        );
      }

      update.code =
        code;
    }

    /* =====================================================
       NAME
    ===================================================== */

    if (
      body.name !==
      undefined
    ) {
      const name =
        cleanText(
          body.name
        );

      if (!name) {
        return errorResponse(
          "Character Name is required",
          400,
          "NAME_REQUIRED"
        );
      }

      update.name =
        name;
    }

    /* =====================================================
       DESCRIPTION
    ===================================================== */

    if (
      body.description !==
      undefined
    ) {
      update.description =
        nullableText(
          body.description
        );
    }

    /* =====================================================
       VERSION
    ===================================================== */

    if (
      body.version !==
      undefined
    ) {
      const version =
        parsePositiveInteger(
          body.version
        );

      if (!version) {
        return errorResponse(
          "Version must be an integer greater than 0",
          400,
          "INVALID_VERSION"
        );
      }

      update.version =
        version;
    }

    /* =====================================================
       SORT ORDER
    ===================================================== */

    if (
      body.sort_order !==
      undefined
    ) {
      const sortOrder =
        parseNonNegativeInteger(
          body.sort_order
        );

      if (
        sortOrder ===
        null
      ) {
        return errorResponse(
          "Sort Order must be 0 or greater",
          400,
          "INVALID_SORT_ORDER"
        );
      }

      update.sort_order =
        sortOrder;
    }

    /* =====================================================
       IMAGE URL / PATH

       "" means clear.
    ===================================================== */

    if (
      body.thumbnail_url !==
      undefined
    ) {
      update.thumbnail_url =
        nullableText(
          body.thumbnail_url
        );
    }

    if (
      body.thumbnail_path !==
      undefined
    ) {
      update.thumbnail_path =
        nullableText(
          body.thumbnail_path
        );
    }

    /* =====================================================
       MODEL URL / PATH

       "" means clear.
    ===================================================== */

    if (
      body.model_url !==
      undefined
    ) {
      update.model_url =
        nullableText(
          body.model_url
        );
    }

    if (
      body.model_path !==
      undefined
    ) {
      update.model_path =
        nullableText(
          body.model_path
        );
    }

    /* =====================================================
       ACTIVE / DRAFT
    ===================================================== */

    const requestedActive =
      parseBoolean(
        body.is_active
      );

    if (
      requestedActive !==
      undefined
    ) {
      /*
        DEFAULT cannot be hidden.

        Admin must set another Character as Default first.
      */

      if (
        requestedActive ===
          false &&
        current.is_default
      ) {
        return errorResponse(
          "Default Character cannot be hidden. Set another Character as Default first.",
          409,
          "DEFAULT_CHARACTER_CANNOT_HIDE"
        );
      }

      /*
        Publishing requires a GLB.

        model_url can also be included in this same PATCH.
      */

      if (
        requestedActive ===
        true
      ) {
        const finalModelUrl =
          body.model_url !==
          undefined
            ? nullableText(
                body.model_url
              )
            : current.model_url;

        if (
          !finalModelUrl
        ) {
          return errorResponse(
            "Import a Character GLB before publishing this Character",
            409,
            "CHARACTER_MODEL_REQUIRED"
          );
        }
      }

      update.is_active =
        requestedActive;
    }

    /* =====================================================
       BLOCK DIRECT DEFAULT MUTATION

       is_default must only change through:
       action = set_default
    ===================================================== */

    if (
      body.is_default !==
      undefined
    ) {
      return errorResponse(
        "Use action=set_default to change the Default Character",
        400,
        "USE_SET_DEFAULT_ACTION"
      );
    }

    /* =====================================================
       NOTHING TO UPDATE
    ===================================================== */

    if (
      Object.keys(
        update
      ).length === 0
    ) {
      return successResponse({
        character:
          decorateCharacter(
            current
          ),

        message:
          "No Character changes were supplied.",
      });
    }

    /* =====================================================
       UPDATE DATABASE
    ===================================================== */

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from(
          "character_models"
        )
        .update(
          update
        )
        .eq(
          "id",
          characterId
        )
        .select(
          CHARACTER_SELECT
        )
        .single();

    if (error) {
      console.error(
        "UPDATE CHARACTER ERROR:",
        error
      );

      if (
        error.code ===
        "23505"
      ) {
        return errorResponse(
          "This Character Code + Version already exists",
          409,
          "CHARACTER_VERSION_EXISTS"
        );
      }

      return errorResponse(
        error.message,
        500,
        "CHARACTER_UPDATE_FAILED"
      );
    }

    const character =
      decorateCharacter(
        data as CharacterRow
      );

    return successResponse({
      character,

      message:
        `${character.name} updated successfully.`,
    });
  } catch (
    error
  ) {
    console.error(
      "ADMIN CHARACTER PATCH INTERNAL ERROR:",
      error
    );

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Unable to update Character",
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}