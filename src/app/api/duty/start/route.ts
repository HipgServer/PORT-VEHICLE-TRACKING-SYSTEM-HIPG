import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { connectDB } from "@/lib/db/connection";
import { Vehicle, Driver, DutySession, LatestLocation, AuditLog, User } from "@/lib/db/models";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user || (auth.user.role !== "driver" && auth.user.role !== "admin")) {
      return NextResponse.json({ error: "Unauthorized: Driver access required" }, { status: 403 });
    }

    const body = await req.json();
    const { vehicleId, perryNo, vehicleNumber, driverName, latitude, longitude, forceRestart } = body;

    await connectDB();

    // 1. Resolve Driver profile
    let driver = await Driver.findOne({ userId: auth.user.userId });
    if (!driver && auth.user.role === "admin") {
      driver = await Driver.findOne();
    }

    if (!driver) {
      return NextResponse.json({ error: "Driver profile not found" }, { status: 404 });
    }

    if (driverName && driverName.trim()) {
      await User.findByIdAndUpdate(driver.userId, { fullName: driverName.trim() });
    }

    // 2. Resolve Vehicle / Perry No
    let vehicle = null;
    const cleanPerry = (perryNo || vehicleNumber || "").toUpperCase().trim();

    if (cleanPerry) {
      vehicle = await Vehicle.findOne({ vehicleNumber: cleanPerry });
      if (!vehicle) {
        // Auto-register new Perry No / Vehicle dynamically
        vehicle = await Vehicle.create({
          vehicleNumber: cleanPerry,
          type: "terminal_tractor",
          makeModel: `Port Vehicle (${cleanPerry})`,
          licensePlate: `HIPG-${cleanPerry}`,
          status: "active",
          maxSpeedKmh: 45,
        });
      }
    } else if (vehicleId && Types.ObjectId.isValid(vehicleId)) {
      vehicle = await Vehicle.findById(vehicleId);
    }

    if (!vehicle) {
      return NextResponse.json({ error: "Perry No or Vehicle is required" }, { status: 400 });
    }

    // 3. Check existing duty sessions for this driver
    const existingDriverSession = await DutySession.findOne({
      driverId: driver._id,
      status: { $in: ["DUTY_ACTIVE", "DUTY_INTERRUPTED"] },
    });

    if (existingDriverSession) {
      if (existingDriverSession.vehicleId.toString() === vehicle._id.toString() && !forceRestart) {
        // Driver is re-entering duty with same vehicle: resume and return current session
        existingDriverSession.status = "DUTY_ACTIVE";
        existingDriverSession.resumedAt = new Date();
        await existingDriverSession.save();

        await LatestLocation.findOneAndUpdate(
          { vehicleId: vehicle._id },
          { trackingStatus: "ONLINE", lastAcceptedGpsTime: new Date() }
        );

        return NextResponse.json({
          success: true,
          message: "Resumed active duty session",
          dutySession: existingDriverSession,
          vehicle: {
            id: vehicle._id,
            vehicleNumber: vehicle.vehicleNumber,
            type: vehicle.type,
          },
        });
      } else {
        // End the previous session and switch to this one
        existingDriverSession.status = "DUTY_COMPLETED";
        existingDriverSession.endTime = new Date();
        await existingDriverSession.save();
      }
    }

    // 4. Check if vehicle has an existing active session with another driver
    const existingVehicleSession = await DutySession.findOne({
      vehicleId: vehicle._id,
      status: { $in: ["DUTY_ACTIVE", "DUTY_INTERRUPTED"] },
    });

    if (existingVehicleSession && existingVehicleSession.driverId.toString() !== driver._id.toString()) {
      if (forceRestart) {
        // Force complete previous driver's abandoned session
        existingVehicleSession.status = "DUTY_COMPLETED";
        existingVehicleSession.endTime = new Date();
        await existingVehicleSession.save();
      } else {
        return NextResponse.json(
          {
            error: `Perry No ${vehicle.vehicleNumber} is currently assigned to another driver.`,
            canForceRestart: true,
          },
          { status: 409 }
        );
      }
    }

    // 5. Create new Duty Session
    const startLocation =
      latitude != null && longitude != null
        ? { type: "Point", coordinates: [Number(longitude), Number(latitude)] }
        : undefined;

    const dutySession = await DutySession.create({
      driverId: driver._id,
      vehicleId: vehicle._id,
      startTime: new Date(),
      status: "DUTY_ACTIVE",
      startLocation,
      totalDistanceMeters: 0,
      durationSeconds: 0,
    });

    // 6. Update Driver & Vehicle assignments
    await Driver.findByIdAndUpdate(driver._id, {
      status: "on_duty",
      assignedVehicleId: vehicle._id,
      currentDutySessionId: dutySession._id,
    });

    await Vehicle.findByIdAndUpdate(vehicle._id, {
      assignedDriverId: driver._id,
      status: "active",
    });

    // 7. Update LatestLocation tracking status
    await LatestLocation.findOneAndUpdate(
      { vehicleId: vehicle._id },
      {
        driverId: driver._id,
        dutySessionId: dutySession._id,
        trackingStatus: "ONLINE",
        lastAcceptedGpsTime: new Date(),
        location: startLocation || { type: "Point", coordinates: [81.0940, 6.1235] },
      },
      { upsert: true }
    );

    // 8. Audit Log
    await AuditLog.create({
      userId: auth.user.userId,
      username: auth.user.username,
      action: "DUTY_START",
      resourceType: "DUTY_SESSION",
      resourceId: dutySession._id.toString(),
      details: {
        vehicleNumber: vehicle.vehicleNumber,
        driverName: driverName || auth.user.fullName,
      },
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      dutySession,
      vehicle: {
        id: vehicle._id,
        vehicleNumber: vehicle.vehicleNumber,
        type: vehicle.type,
      },
    });
  } catch (error: any) {
    console.error("Start duty error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
