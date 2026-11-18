import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connection";
import { Vehicle, Driver, DutySession, LatestLocation, AuditLog } from "@/lib/db/models";
import { Types } from "mongoose";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dutySessionId, latitude, longitude } = await req.json();

    if (!dutySessionId || !Types.ObjectId.isValid(dutySessionId)) {
      return NextResponse.json({ error: "Valid dutySessionId is required" }, { status: 400 });
    }

    await connectDB();
    const dutySession = await DutySession.findById(dutySessionId);
    if (!dutySession) {
      return NextResponse.json({ error: "Duty session not found" }, { status: 404 });
    }

    // Drivers can only end their own sessions unless supervisor/admin
    if (auth.user.role === "driver") {
      const driver = await Driver.findOne({ userId: auth.user.userId });
      if (!driver || dutySession.driverId.toString() !== driver._id.toString()) {
        return NextResponse.json({ error: "Unauthorized: not your duty session" }, { status: 403 });
      }
    }

    if (dutySession.status === "DUTY_COMPLETED") {
      return NextResponse.json({ message: "Duty session already completed", dutySession });
    }

    const endTime = new Date();
    const durationSeconds = Math.max(0, Math.floor((endTime.getTime() - dutySession.startTime.getTime()) / 1000));

    const endLocation =
      latitude != null && longitude != null
        ? { type: "Point", coordinates: [Number(longitude), Number(latitude)] }
        : undefined;

    // 1. Mark Duty Session Completed
    dutySession.status = "DUTY_COMPLETED";
    dutySession.endTime = endTime;
    dutySession.durationSeconds = durationSeconds;
    if (endLocation) dutySession.endLocation = endLocation as any;
    await dutySession.save();

    // 2. Release Driver
    await Driver.findByIdAndUpdate(dutySession.driverId, {
      status: "available",
      currentDutySessionId: null,
      assignedVehicleId: null,
    });

    // 3. Release Vehicle
    await Vehicle.findByIdAndUpdate(dutySession.vehicleId, {
      assignedDriverId: null,
    });

    // 4. Update LatestLocation to NOT_ON_DUTY
    await LatestLocation.findOneAndUpdate(
      { vehicleId: dutySession.vehicleId },
      {
        trackingStatus: "NOT_ON_DUTY",
        dutySessionId: null,
      }
    );

    // 5. Audit Log
    await AuditLog.create({
      userId: auth.user.userId,
      username: auth.user.username,
      action: "DUTY_END",
      resourceType: "DUTY_SESSION",
      resourceId: dutySession._id.toString(),
      details: { durationSeconds },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: "Duty session completed successfully",
      dutySession,
    });
  } catch (error: any) {
    console.error("End duty error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

