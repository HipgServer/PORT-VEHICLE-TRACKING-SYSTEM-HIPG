import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, requireRoles } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connection";
import { DutySession, Driver, Vehicle, LatestLocation, AuditLog } from "@/lib/db/models";
import { broadcastVehicleStatus } from "@/lib/socket/server";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user || !requireRoles(auth.user, ["admin", "supervisor"])) {
      return NextResponse.json({ error: "Unauthorized: Supervisor or Admin access required" }, { status: 403 });
    }

    const { dutySessionId, action, supervisorNotes } = await req.json();

    if (!dutySessionId || !Types.ObjectId.isValid(dutySessionId)) {
      return NextResponse.json({ error: "Valid dutySessionId is required" }, { status: 400 });
    }

    if (!["resume", "force_complete"].includes(action)) {
      return NextResponse.json({ error: "Action must be 'resume' or 'force_complete'" }, { status: 400 });
    }

    await connectDB();
    const session = await DutySession.findById(dutySessionId).populate("vehicleId driverId");
    if (!session) {
      return NextResponse.json({ error: "Duty session not found" }, { status: 404 });
    }

    const supervisorId = new Types.ObjectId(auth.user.userId);

    if (action === "force_complete") {
      const endTime = new Date();
      const duration = Math.max(0, Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000));

      session.status = "DUTY_COMPLETED";
      session.endTime = endTime;
      session.durationSeconds = duration;
      session.completedBySupervisorId = supervisorId;
      session.supervisorNotes = supervisorNotes || "Force completed by supervisor recovery mechanism";
      await session.save();

      // Release driver and vehicle
      await Driver.findByIdAndUpdate(session.driverId, {
        status: "available",
        currentDutySessionId: null,
        assignedVehicleId: null,
      });

      await Vehicle.findByIdAndUpdate(session.vehicleId, {
        assignedDriverId: null,
      });

      await LatestLocation.findOneAndUpdate(
        { vehicleId: session.vehicleId },
        { trackingStatus: "NOT_ON_DUTY" }
      );

      broadcastVehicleStatus({
        vehicleId: session.vehicleId._id.toString(),
        trackingStatus: "NOT_ON_DUTY",
        dutyStatus: "DUTY_COMPLETED",
        lastSeen: endTime.toISOString(),
      });
    } else if (action === "resume") {
      session.status = "DUTY_ACTIVE";
      session.resumedAt = new Date();
      session.supervisorNotes = supervisorNotes || "Resumed by supervisor recovery";
      await session.save();

      await LatestLocation.findOneAndUpdate(
        { vehicleId: session.vehicleId },
        { trackingStatus: "ONLINE" }
      );

      broadcastVehicleStatus({
        vehicleId: session.vehicleId._id.toString(),
        trackingStatus: "ONLINE",
        dutyStatus: "DUTY_ACTIVE",
        lastSeen: new Date().toISOString(),
      });
    }

    // Audit log
    await AuditLog.create({
      userId: supervisorId,
      username: auth.user.username,
      action: `SUPERVISOR_DUTY_${action.toUpperCase()}`,
      resourceType: "DUTY_SESSION",
      resourceId: session._id.toString(),
      details: { action, supervisorNotes },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      action,
      dutySession: session,
    });
  } catch (error: any) {
    console.error("Supervisor duty recovery error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

