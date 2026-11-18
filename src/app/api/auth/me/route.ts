import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connection";
import { User, Driver, DutySession } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    await connectDB();
    const user = await User.findById(auth.user.userId).select("-passwordHash");
    if (!user || !user.active) {
      return NextResponse.json({ authenticated: false, error: "Account inactive" }, { status: 403 });
    }

    let activeSession = null;
    let driverProfile = null;

    if (user.role === "driver") {
      driverProfile = await Driver.findOne({ userId: user._id }).populate("assignedVehicleId");
      if (driverProfile) {
        activeSession = await DutySession.findOne({
          driverId: driverProfile._id,
          status: { $in: ["DUTY_ACTIVE", "DUTY_INTERRUPTED"] },
        }).populate("vehicleId");
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        driverId: driverProfile ? driverProfile._id.toString() : undefined,
        assignedVehicle: driverProfile?.assignedVehicleId,
        activeDutySession: activeSession,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

