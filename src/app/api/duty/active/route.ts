import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connection";
import { Driver, DutySession } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const driver = await Driver.findOne({ userId: auth.user.userId });
    if (!driver) {
      return NextResponse.json({ activeSession: null });
    }

    const activeSession = await DutySession.findOne({
      driverId: driver._id,
      status: { $in: ["DUTY_ACTIVE", "DUTY_INTERRUPTED"] },
    }).populate("vehicleId");

    return NextResponse.json({
      activeSession,
      driverId: driver._id,
      assignedVehicleId: driver.assignedVehicleId,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

