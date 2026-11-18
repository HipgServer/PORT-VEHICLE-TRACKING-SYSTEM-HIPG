import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { YardEvent } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") || 50)));

    await connectDB();
    const events = await YardEvent.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate("vehicleId", "vehicleNumber type")
      .populate("yardId", "name code color category")
      .populate("previousYardId", "name code color category")
      .populate("driverId", "employeeId");

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

