import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { User, Driver, AuditLog } from "@/lib/db/models";
import { signToken } from "@/lib/auth/jwt";
import { setAuthCookie } from "@/lib/auth/cookies";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loginType, driverName, username, password } = body;

    await connectDB();

    // ==========================================
    // 1. DRIVER LOGIN MODE
    // ==========================================
    if (loginType === "driver" || (!username && driverName)) {
      const cleanName = (driverName || "Driver").trim();
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "") || "driver";

      // Find existing driver or create new one on the fly
      let user = await User.findOne({
        $or: [
          { fullName: { $regex: new RegExp(`^${cleanName}$`, "i") }, role: "driver" },
          { username: slug, role: "driver" },
        ],
      });

      if (!user) {
        const uniqueUsername = `${slug}_${Math.floor(Math.random() * 900 + 100)}`;
        const defaultHash = await bcrypt.hash("driver123", 10);

        user = await User.create({
          username: uniqueUsername,
          email: `${uniqueUsername}@hipg.lk`,
          passwordHash: defaultHash,
          fullName: cleanName,
          role: "driver",
          active: true,
        });

        await Driver.create({
          userId: user._id,
          employeeId: `DRV-${Math.floor(Math.random() * 9000 + 1000)}`,
          licenseNumber: "DL-STANDARD",
          licenseExpiry: new Date("2030-01-01"),
          status: "available",
        });
      }

      const driver = await Driver.findOne({ userId: user._id });

      const tokenPayload = {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: "driver" as const,
        driverId: driver ? driver._id.toString() : undefined,
        assignedVehicleId: driver?.assignedVehicleId ? driver.assignedVehicleId.toString() : undefined,
      };

      const token = signToken(tokenPayload);
      await setAuthCookie(token);

      await AuditLog.create({
        userId: user._id,
        username: user.username,
        action: "DRIVER_SIGNIN",
        resourceType: "AUTH",
        resourceId: user._id.toString(),
        details: { driverName: cleanName },
        ipAddress: req.headers.get("x-forwarded-for") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown",
        timestamp: new Date(),
      });

      return NextResponse.json({
        success: true,
        user: tokenPayload,
        redirect: "/driver",
        token,
      });
    }

    // ==========================================
    // 2. ADMINISTRATOR LOGIN MODE
    // ==========================================
    const cleanUsername = (username || "").toLowerCase().trim();
    if (!cleanUsername || !password) {
      return NextResponse.json(
        { error: "Username and password are required for Administrator sign-in" },
        { status: 400 }
      );
    }

    const user = await User.findOne({
      $or: [{ username: cleanUsername }, { email: cleanUsername }],
      active: true,
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const tokenPayload = {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };

    const token = signToken(tokenPayload);
    await setAuthCookie(token);

    await AuditLog.create({
      userId: user._id,
      username: user.username,
      action: "ADMIN_LOGIN",
      resourceType: "AUTH",
      resourceId: user._id.toString(),
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      user: tokenPayload,
      redirect: "/dashboard",
      token,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
