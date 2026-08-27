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
  if (
    process.env.NODE_ENV === "production" &&
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
