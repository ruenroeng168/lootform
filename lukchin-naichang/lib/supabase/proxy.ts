import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "./env";

// Refreshes the Supabase auth session cookie. Authorization itself is done
// server-side in each protected page (lib/auth.ts), not here.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getSupabasePublicEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
