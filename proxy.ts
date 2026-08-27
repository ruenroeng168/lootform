import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TEST_ONLY_ROUTES = new Set([
  "/test",
  "/equipment-test",
  "/rank-test",
  "/game/session-test",
  "/game/event-test",
  "/game/event-helper-test",
  "/api/wallet/topup/test",
]);

export function proxy(request: NextRequest) {
  // NODE_ENV is always "production" for any deployed build (Vercel
  // Preview included, not just the real live site) -- VERCEL_ENV is
  // what actually distinguishes them ("production" | "preview" |
  // undefined locally). Gating on NODE_ENV blocked these test-only
  // routes on every Preview deployment too, including Beta test
  // builds that still need TEST top-up to work.
  if (
    process.env.VERCEL_ENV === "production" &&
    TEST_ONLY_ROUTES.has(request.nextUrl.pathname)
  ) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/test",
    "/equipment-test",
    "/rank-test",
    "/game/session-test",
    "/game/event-test",
    "/game/event-helper-test",
    "/api/wallet/topup/test",
  ],
};
