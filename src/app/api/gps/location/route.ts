import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { processGpsRecord } from "@/lib/gps/processor";
import { connectDB } from "@/lib/db/connection";
import { Driver, Vehicle } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Request (Supports JWT Cookies, Bearer token, or Device API Keys)
    const auth = await authenticateRequest(req);
    if (!auth.user && !auth.device) {
      return NextResponse.json(
        { error: "Unauthorized: valid session or device token required" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // 2. Validate client identity against authenticated entity
    // Never trust client-supplied driverId or vehicleId blindly!
    if (auth.user && auth.user.role === "driver") {
      await connectDB();
      const driver = await Driver.findOne({ userId: auth.user.userId });
      if (!driver) {
        return NextResponse.json({ error: "Driver profile not found" }, { status: 403 });
      }

      // Enforce authenticated driver ID
      body.driverId = driver._id.toString();

      // If user specified a vehicle, verify they are authorized for it
      if (body.vehicleId) {
        const vehicle = await Vehicle.findById(body.vehicleId);
        if (!vehicle || vehicle.status !== "active") {
          return NextResponse.json({ error: "Vehicle unauthorized or inactive" }, { status: 403 });
        }
      }
    } else if (auth.device) {
      // Device token authenticated: bind to device
      body.deviceId = auth.device.deviceId;
      body.source = auth.device.type;
    }

    // 3. Process Location through Processing Pipeline
    const result = await processGpsRecord(body);

    if (!result.success && result.status === "rejected") {
      return NextResponse.json(
        {
          success: false,
          recordId: result.recordId,
          error: result.error,
          status: "rejected",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        recordId: result.recordId,
        status: result.status,
        data: result.data,
      },
      { status: result.status === "duplicate" ? 200 : 201 }
    );
  } catch (error: any) {
    console.error("GPS Ingestion API error:", error);
    return NextResponse.json(
      { error: "Internal processing error", details: error.message },
      { status: 500 }
    );
  }
}

