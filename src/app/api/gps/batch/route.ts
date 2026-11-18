import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/middleware";
import { processGpsRecord } from "@/lib/gps/processor";
import { connectDB } from "@/lib/db/connection";
import { Driver } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    if (!auth.user && !auth.device) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { records } = await req.json();

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Records array is required" }, { status: 400 });
    }

    if (records.length > 100) {
      return NextResponse.json({ error: "Batch size limit exceeded (max 100)" }, { status: 413 });
    }

    let authenticatedDriverId: string | null = null;
    if (auth.user && auth.user.role === "driver") {
      await connectDB();
      const driver = await Driver.findOne({ userId: auth.user.userId });
      if (driver) {
        authenticatedDriverId = driver._id.toString();
      }
    }

    const results = [];
    let acceptedCount = 0;
    let duplicateCount = 0;
    let rejectedCount = 0;

    for (const record of records) {
      if (authenticatedDriverId) {
        record.driverId = authenticatedDriverId;
      }
      if (auth.device) {
        record.deviceId = auth.device.deviceId;
      }

      const res = await processGpsRecord(record);
      results.push(res);

      if (res.status === "accepted") acceptedCount++;
      else if (res.status === "duplicate") duplicateCount++;
      else if (res.status === "rejected") rejectedCount++;
    }

    return NextResponse.json({
      success: true,
      processedTotal: records.length,
      acceptedCount,
      duplicateCount,
      rejectedCount,
      results,
    });
  } catch (error: any) {
    console.error("GPS Batch API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

