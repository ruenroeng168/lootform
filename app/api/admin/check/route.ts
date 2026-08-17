import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(
  request: Request
) {
  try {
    const authHeader =
      request.headers.get(
        "authorization"
      );

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          isAdmin: false,
        },
        {
          status: 401,
        }
      );
    }

    const token =
      authHeader.replace(
        "Bearer ",
        ""
      );

    const {
      data: { user },
      error,
    } =
      await supabaseAdmin.auth.getUser(
        token
      );

    if (
      error ||
      !user ||
      !user.email
    ) {
      return NextResponse.json(
        {
          success: false,
          isAdmin: false,
        },
        {
          status: 401,
        }
      );
    }

    const adminEmails =
      getAdminEmails();

    const isAdmin =
      adminEmails.includes(
        user.email.toLowerCase()
      );

    return NextResponse.json({
      success: true,
      isAdmin,
    });
  } catch (error) {
    console.error(
      "ADMIN CHECK ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        isAdmin: false,
      },
      {
        status: 500,
      }
    );
  }
}