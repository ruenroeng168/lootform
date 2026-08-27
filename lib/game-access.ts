import {
  useEffect,
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabase";

/*
  Temporary Phase 2 rollout gate for the Game section (/game,
  /game/play). Presentation-only -- grants no gameplay authority.

  When NEXT_PUBLIC_GAME_COMING_SOON is not "true", this resolves to
  allowed=true immediately with no network round trip -- flipping
  that one env var back off is all it takes to open the Game section
  to real players later.

  When it is "true", the team (ADMIN_EMAILS allowlist, checked
  server-side in /api/game/access) can still get in; everyone else
  should be shown a "COMING SOON" screen by the caller.
*/

export function useGameAccessGate() {
  const [
    checked,
    setChecked,
  ] =
    useState(false);

  const [
    allowed,
    setAllowed,
  ] =
    useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (
        process.env
          .NEXT_PUBLIC_GAME_COMING_SOON !==
        "true"
      ) {
        if (!cancelled) {
          setAllowed(
            true
          );

          setChecked(
            true
          );
        }

        return;
      }

      try {
        const {
          data: {
            session,
          },
        } =
          await supabase
            .auth
            .getSession();

        if (
          !session
        ) {
          if (!cancelled) {
            setAllowed(
              false
            );

            setChecked(
              true
            );
          }

          return;
        }

        const response =
          await fetch(
            "/api/game/access",
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },

              cache:
                "no-store",
            }
          );

        const result =
          (await response.json()) as {
            allowed?: boolean;
          };

        if (!cancelled) {
          setAllowed(
            Boolean(
              result.allowed
            )
          );

          setChecked(
            true
          );
        }
      } catch (error) {
        console.error(
          "GAME ACCESS GATE ERROR:",
          error
        );

        if (!cancelled) {
          setAllowed(
            false
          );

          setChecked(
            true
          );
        }
      }
    }

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    checked,
    allowed,
  };
}
