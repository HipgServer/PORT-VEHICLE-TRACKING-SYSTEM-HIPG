import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { DutySession, LatestLocation, Notification, AuditLog } from "@/lib/db/models";
import { broadcastTrackingInterrupted, broadcastVehicleStatus } from "@/lib/socket/server";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { vehicleId, dutySessionId, interruptedAt, reason } = await req.json();

    if (!vehicleId || !dutySessionId) {
      return NextResponse.json({ error: "Missing vehicleId or dutySessionId" }, { status: 400 });
    }

    await connectDB();

    const timestamp = interruptedAt ? new Date(interruptedAt) : new Date();

    // 1. Update Duty Session status to DUTY_INTERRUPTED
    if (Types.ObjectId.isValid(dutySessionId)) {
      await DutySession.findOneAndUpdate(
        { _id: dutySessionId, status: "DUTY_ACTIVE" },
        {
          status: "DUTY_INTERRUPTED",
          interruptedAt: timestamp,
          interruptionReason: reason || "Browser lifecycle suspended",
        }
      );
    }

    // 2. Update LatestLocation status to TRACKING_INTERRUPTED
    if (Types.ObjectId.isValid(vehicleId)) {
      await LatestLocation.findOneAndUpdate(
        { vehicleId },
        {
          trackingStatus: "TRACKING_INTERRUPTED",
        }
      );

      // 3. Broadcast real-time interruption alert
      broadcastTrackingInterrupted({
        vehicleId,
        dutySessionId,
        interruptedAt: timestamp.toISOString(),
        reason: reason || "Browser suspended/hidden",
      });

      broadcastVehicleStatus({
        vehicleId,
        trackingStatus: "TRACKING_INTERRUPTED",
        dutyStatus: "DUTY_INTERRUPTED",
        lastSeen: timestamp.toISOString(),
      });
    }

    // 4. Create Notification
    await Notification.create({
      recipientRoles: ["supervisor", "admin"],
      type: "TRACKING_INTERRUPTED",
      title: "Vehicle Tracking Interrupted",
      message: `Tracking suspended for vehicle. Reason: ${reason || "Browser backgrounded"}`,
      data: { vehicleId, dutySessionId, interruptedAt: timestamp },
    });

    return NextResponse.json({
      success: true,
      message: "Tracking marked as interrupted",
      status: "TRACKING_INTERRUPTED",
    });
  } catch (error: any) {
    console.error("Duty interruption handler error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

