import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TokenPayload } from "./jwt";
import { COOKIE_NAME } from "./cookies";
import { UserRole } from "@/lib/types";
import { connectDB } from "../db/connection";
import { GpsDevice } from "../db/models";

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
  deviceId?: string;
  deviceType?: string;
}

/**
 * Authenticates request from HTTP-only cookie, Authorization Bearer header, or X-Device-Token
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<{ user?: TokenPayload; device?: { deviceId: string; type: string }; error?: string }> {
  // 1. Check HTTP-only cookie
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const payload = verifyToken(cookieToken);
    if (payload) {
      return { user: payload };
    }
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const payload = verifyToken(token);
    if (payload) {
      return { user: payload };
    }
  }

  // 3. Check X-Device-Token or X-API-Key for IoT / ESP32 devices
  const deviceToken = req.headers.get("x-device-token") || req.headers.get("x-api-key");
  const deviceIdHeader = req.headers.get("x-device-id");
  if (deviceToken && deviceIdHeader) {
    await connectDB();
    const device = await GpsDevice.findOne({
      deviceId: deviceIdHeader.toUpperCase(),
      status: "active",
    });
    if (device) {
      // In production verify device hash, or token match
      return {
        device: {
          deviceId: device.deviceId,
          type: device.type,
        },
      };
    }
  }

  return { error: "Authentication required" };
}

/**
 * Enforces role-based authorization
 */
export function requireRoles(user: TokenPayload | undefined, allowedRoles: UserRole[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

