import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "disconnected";

  try {
    await connectDB();
    dbStatus = mongoose.connection.readyState === 1 ? "connected" : "connecting";
  } catch (err: any) {
    dbStatus = `error: ${err.message}`;
  }

  const responseTimeMs = Date.now() - startTime;
  const isHealthy = dbStatus === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      service: "Port Vehicle & Yard Tracking Management System (Peri Tracker)",
      version: "1.0.0",
      database: {
        status: dbStatus,
        host: mongoose.connection.host,
      },
      performance: {
        responseTimeMs,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}

