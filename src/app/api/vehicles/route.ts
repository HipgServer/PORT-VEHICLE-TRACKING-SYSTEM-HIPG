import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { Vehicle, LatestLocation, DutySession, Driver, Yard, SystemSetting } from "@/lib/db/models";
import { evaluateVehicleTrackingStatus } from "@/lib/gps/statusEngine";
import { authenticateRequest, requireRoles } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    // Retrieve system threshold settings
    const staleSetting = await SystemSetting.findOne({ key: "GPS_STALE_THRESHOLD_SECONDS" });
    const offlineSetting = await SystemSetting.findOne({ key: "GPS_OFFLINE_THRESHOLD_SECONDS" });
    const staleThreshold = staleSetting?.value ?? 60;
    const offlineThreshold = offlineSetting?.value ?? 180;

    const vehicles = await Vehicle.find()
      .populate({
        path: "assignedDriverId",
        populate: { path: "userId", select: "fullName" },
      })
      .populate("currentYardId");
    const latestLocations = await LatestLocation.find();
    const activeSessions = await DutySession.find({
      status: { $in: ["DUTY_ACTIVE", "DUTY_INTERRUPTED"] },
    });

    const locationMap = new Map();
    for (const loc of latestLocations) {
      locationMap.set(loc.vehicleId.toString(), loc);
    }

    const sessionMap = new Map();
    for (const sess of activeSessions) {
      sessionMap.set(sess.vehicleId.toString(), sess);
    }

    const result = vehicles.map((v) => {
      const loc = locationMap.get(v._id.toString());
      const session = sessionMap.get(v._id.toString());
      const dutyStatus = session ? session.status : "NOT_ON_DUTY";

      const statusEval = evaluateVehicleTrackingStatus({
        dutyStatus,
        lastAcceptedGpsTime: loc?.lastAcceptedGpsTime,
        isTrackingInterrupted: session?.status === "DUTY_INTERRUPTED" || loc?.trackingStatus === "TRACKING_INTERRUPTED",
        staleThresholdSeconds: staleThreshold,
        offlineThresholdSeconds: offlineThreshold,
      });

      return {
        id: v._id.toString(),
        vehicleNumber: v.vehicleNumber,
        type: v.type,
        makeModel: v.makeModel,
        status: v.status,
        licensePlate: v.licensePlate,
        maxSpeedKmh: v.maxSpeedKmh,
        assignedDriver: v.assignedDriverId,
        assignedDriverName:
          (v.assignedDriverId as any)?.userId?.fullName ||
          (v.assignedDriverId as any)?.employeeId ||
          undefined,
        currentYard: v.currentYardId,
        dutyStatus,
        activeDutySessionId: session?._id,
        trackingStatus: statusEval.trackingStatus,
        confidence: statusEval.confidence,
        isLive: statusEval.isLive,
        secondsSinceLastUpdate: statusEval.secondsSinceLastUpdate,
        lastAcceptedGpsTime: loc?.lastAcceptedGpsTime,
        lastReceivedGpsTime: loc?.lastReceivedGpsTime,
        location: loc?.location,
        latitude: loc?.location?.coordinates ? loc.location.coordinates[1] : undefined,
        longitude: loc?.location?.coordinates ? loc.location.coordinates[0] : undefined,
        speed: loc?.speed || 0,
        heading: loc?.heading || 0,
        accuracy: loc?.accuracy || 0,
        isMoving: loc?.isMoving || false,
        batteryLevel: loc?.batteryLevel,
      };
    });

    return NextResponse.json({ success: true, count: result.length, vehicles: result });
  } catch (error: any) {
    console.error("Vehicles API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user || !requireRoles(auth.user, ["admin", "supervisor"])) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    await connectDB();

    const existing = await Vehicle.findOne({ vehicleNumber: body.vehicleNumber.toUpperCase() });
    if (existing) {
      return NextResponse.json({ error: "Vehicle number already exists" }, { status: 409 });
    }

    const vehicle = await Vehicle.create({
      vehicleNumber: body.vehicleNumber.toUpperCase(),
      type: body.type,
      makeModel: body.makeModel,
      licensePlate: body.licensePlate.toUpperCase(),
      maxSpeedKmh: body.maxSpeedKmh || 50,
      status: body.status || "active",
    });

    return NextResponse.json({ success: true, vehicle }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

