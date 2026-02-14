import { NextRequest, NextResponse } from "next/server";

/**
 * Verify CRON_SECRET from Authorization header.
 * Returns null if valid, or a 401 NextResponse if invalid.
 */
export function verifyCronSecret(
  request: NextRequest
): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return null;
}
