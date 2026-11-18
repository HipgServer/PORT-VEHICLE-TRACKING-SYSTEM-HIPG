import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { Yard } from "@/lib/db/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    const yards = await Yard.find({ active: true }).sort({ name: 1 });

    const formatted = yards.map((y) => ({
      id: y._id.toString(),
      name: y.name,
      code: y.code,
      category: y.category,
      capacity: y.capacity,
      currentCount: y.currentCount,
      occupancyPercentage: Math.min(100, Math.round((y.currentCount / Math.max(1, y.capacity)) * 100)),
      speedLimitKmh: y.speedLimitKmh,
      color: y.color,
      boundary: y.boundary,
      description: y.description,
    }));

    return NextResponse.json({ success: true, count: formatted.length, yards: formatted });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

