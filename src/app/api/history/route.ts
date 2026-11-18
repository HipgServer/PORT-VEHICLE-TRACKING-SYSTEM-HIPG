import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { LocationHistory, Vehicle } from "@/lib/db/models";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId");
    const dutySessionId = searchParams.get("dutySessionId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = Math.min(1000, Math.max(10, Number(searchParams.get("limit") || 250)));
    const page = Math.max(1, Number(searchParams.get("page") || 1));

    if (!vehicleId && !dutySessionId) {
      return NextResponse.json({ error: "vehicleId or dutySessionId is required" }, { status: 400 });
    }

    await connectDB();
    const query: any = {};

    if (vehicleId && Types.ObjectId.isValid(vehicleId)) {
      query.vehicleId = new Types.ObjectId(vehicleId);
    }
    if (dutySessionId && Types.ObjectId.isValid(dutySessionId)) {
      query.dutySessionId = new Types.ObjectId(dutySessionId);
    }

    if (startDate || endDate) {
      query.gpsTimestamp = {};
      if (startDate) query.gpsTimestamp.$gte = new Date(startDate);
      if (endDate) query.gpsTimestamp.$lte = new Date(endDate);
    }

    const totalCount = await LocationHistory.countDocuments(query);
    const records = await LocationHistory.find(query)
      .sort({ gpsTimestamp: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("yardId", "name code color");

    const vehicleInfo = vehicleId ? await Vehicle.findById(vehicleId) : null;

    return NextResponse.json({
      success: true,
      vehicle: vehicleInfo ? { id: vehicleInfo._id, number: vehicleInfo.vehicleNumber } : null,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      points: records.map((r) => ({
        recordId: r.recordId,
        coordinates: r.location.coordinates, // [lng, lat]
        latitude: r.location.coordinates[1],
        longitude: r.location.coordinates[0],
        speed: r.speed,
        heading: r.heading,
        accuracy: r.accuracy,
        timestamp: r.gpsTimestamp.toISOString(),
        yard: r.yardId,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

