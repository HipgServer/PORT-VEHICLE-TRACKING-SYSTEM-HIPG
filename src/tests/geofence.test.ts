import { findContainingYard, evaluateGeofence } from "../lib/geofence/engine";
import { connectDB } from "../lib/db/connection";
import { Yard } from "../lib/db/models";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export async function testGeofencing(): Promise<boolean> {
  console.log("▶ Testing Geofencing Engine & Hysteresis Drift Prevention...");
  await connectDB();

  const ry01 = await Yard.findOne({ code: "RY-01" });
  if (!ry01) {
    throw new Error("Yard RY-01 not found. Seed database before running tests.");
  }

  // 1. Point inside Ro-Ro Yard 1: [81.1155, 6.1225]
  const insideCoords: [number, number] = [81.1155, 6.1225];
  const detectedYard = await findContainingYard(insideCoords);
  if (!detectedYard || detectedYard.code !== "RY-01") {
    throw new Error(`Expected point inside RY-01, but detected: ${detectedYard?.code}`);
  }
  console.log("  ✔ Point-In-Polygon Detection (Ro-Ro Yard 1) passed");

  // 2. Point clearly outside all yards: [81.0500, 6.1000]
  const outsideCoords: [number, number] = [81.0500, 6.1000];
  const outsideYard = await findContainingYard(outsideCoords);
  if (outsideYard !== null) {
    throw new Error(`Expected point outside yards, but detected: ${outsideYard.code}`);
  }
  console.log("  ✔ Outside All Yards Boundary Check passed");

  // 3. Consecutive Reading Confirmation (Hysteresis)
  const testVehicleId = new mongoose.Types.ObjectId().toString();

  // First reading in new yard (count = 1, hysteresis threshold = 2)
  const reading1 = await evaluateGeofence(
    testVehicleId,
    null,
    null,
    "DEV-TEST",
    insideCoords,
    10.0,
    new Date(),
    null, // Previously outside
    2     // Requires 2 consecutive readings
  );

  if (reading1.confirmed !== false || reading1.eventType !== null) {
    throw new Error("Hysteresis failed: triggered yard entry on single unconfirmed reading");
  }
  console.log("  ✔ Hysteresis: Single Reading Boundary Drift Suppressed passed");

  // Second consecutive reading in the same yard (count = 2 -> confirmed!)
  const reading2 = await evaluateGeofence(
    testVehicleId,
    null,
    null,
    "DEV-TEST",
    insideCoords,
    10.0,
    new Date(),
    null,
    2
  );

  if (reading2.confirmed !== true || reading2.eventType !== "YARD_ENTERED") {
    throw new Error(`Expected YARD_ENTERED after 2 consecutive readings, got: ${reading2.eventType}`);
  }
  console.log("  ✔ Hysteresis: Confirmed YARD_ENTERED Event passed");

  // 4. Inaccurate Reading Drift Suppression (> 40m)
  const readingInaccurate = await evaluateGeofence(
    testVehicleId,
    null,
    null,
    "DEV-TEST",
    outsideCoords,
    65.0, // Inaccurate GPS (65m)
    new Date(),
    ry01._id as any,
    2
  );

  if (readingInaccurate.confirmed !== false) {
    throw new Error("Inaccurate GPS reading (> 40m) triggered boundary event");
  }
  console.log("  ✔ Accuracy-Aware Boundary Drift Suppression passed");

  return true;
}
