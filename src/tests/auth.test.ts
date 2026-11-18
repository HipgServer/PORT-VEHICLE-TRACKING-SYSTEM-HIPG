import { signToken, verifyToken } from "../lib/auth/jwt";
import { requireRoles } from "../lib/auth/middleware";

export async function testAuthentication(): Promise<boolean> {
  console.log("▶ Testing Authentication & RBAC Modules...");

  // 1. Sign and Verify valid JWT token
  const payload = {
    userId: "673cf89123456789abcdef01",
    username: "driver1",
    email: "driver1@hipg.lk",
    fullName: "Kamal Perera",
    role: "driver" as const,
  };

  const token = signToken(payload);
  if (!token || typeof token !== "string") {
    throw new Error("Failed to sign JWT token");
  }

  const verified = verifyToken(token);
  if (!verified || verified.username !== "driver1" || verified.role !== "driver") {
    throw new Error("Failed to verify signed JWT token");
  }
  console.log("  ✔ JWT Token Signing & Verification passed");

  // 2. Reject forged or invalid token
  const invalidToken = token + "corrupted";
  const verifiedInvalid = verifyToken(invalidToken);
  if (verifiedInvalid !== null) {
    throw new Error("Invalid token was unexpectedly accepted");
  }
  console.log("  ✔ Corrupted/Forged Token Rejection passed");

  // 3. Role-Based Authorization Checks
  const adminAllowed = requireRoles(verified, ["admin", "supervisor"]);
  if (adminAllowed !== false) {
    throw new Error("Driver was unexpectedly granted admin/supervisor role privileges");
  }

  const driverAllowed = requireRoles(verified, ["driver", "operator"]);
  if (driverAllowed !== true) {
    throw new Error("Driver was denied appropriate driver role privileges");
  }
  console.log("  ✔ Role-Based Permissions & Guard passed");

  return true;
}

