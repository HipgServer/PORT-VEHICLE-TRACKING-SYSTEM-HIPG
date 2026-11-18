import jwt from "jsonwebtoken";
import { UserRole } from "@/lib/types";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-jwt-key-for-port-vehicle-tracker-2026-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  driverId?: string;
  assignedVehicleId?: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

