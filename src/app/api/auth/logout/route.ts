import { NextRequest, NextResponse } from "next/server";
import { removeAuthCookie } from "@/lib/auth/cookies";
import { authenticateRequest } from "@/lib/auth/middleware";
import { AuditLog } from "@/lib/db/models";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (auth.user) {
      await AuditLog.create({
        userId: auth.user.userId,
        username: auth.user.username,
        action: "USER_LOGOUT",
        resourceType: "AUTH",
        resourceId: auth.user.userId,
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        timestamp: new Date(),
      });
    }

    await removeAuthCookie();
    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

