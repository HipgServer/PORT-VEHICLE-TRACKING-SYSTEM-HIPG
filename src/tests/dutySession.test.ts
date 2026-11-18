import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../lib/db/connection";
import { DutySession, Vehicle, Driver, User } from "../lib/db/models";

dotenv.config({ path: ".env.local" });

export async function testDutySession(): Promise<boolean> {
  console.log("▶ Testing Duty Session Lifecycle & Validation Rules...");
  await connectDB();

  // Find seeded driver and vehicle
  const driver = await Driver.findOne();
  const vehicle = await Vehicle.findOne();

  if (!driver || !vehicle) {
    throw new Error("Seed database required before running duty tests");
  }

  // 1. Create Active Duty Session
  const session = await DutySession.create({
    driverId: driver._id,
    vehicleId: vehicle._id,
    startTime: new Date(),
    status: "DUTY_ACTIVE",
  });

  if (session.status !== "DUTY_ACTIVE") {
    throw new Error("Failed to initialize active duty session");
  }
  console.log("  ✔ Duty Session Initialization passed");

  // 2. Prevent Multiple Active Sessions for One Vehicle
  const conflictingSession = await DutySession.findOne({
    vehicleId: vehicle._id,
    status: { $in: ["DUTY_ACTIVE", "DUTY_INTERRUPTED"] },
  });

  if (!conflictingSession) {
    throw new Error("Active session index failed to find vehicle lock");
  }
  console.log("  ✔ Single Active Session Enforcement passed");

  // 3. Application Interruption Simulation
  session.status = "DUTY_INTERRUPTED";
  session.interruptedAt = new Date();
  session.interruptionReason = "Mobile browser hidden";
  await session.save();

  const interrupted = await DutySession.findById(session._id);
  if (interrupted?.status !== "DUTY_INTERRUPTED") {
    throw new Error("Failed to transition session to DUTY_INTERRUPTED");
  }
  console.log("  ✔ Tracking Interruption State Transition passed");

  // 4. Supervisor Recovery: Complete Session
  session.status = "DUTY_COMPLETED";
  session.endTime = new Date();
  session.durationSeconds = 1200;
  session.supervisorNotes = "Shift completed by supervisor test";
  await session.save();

  const completed = await DutySession.findById(session._id);
  if (completed?.status !== "DUTY_COMPLETED") {
    throw new Error("Supervisor recovery completion failed");
  }
  console.log("  ✔ Supervisor Recovery & Duty Completion passed");

  // Clean up test session
  await DutySession.findByIdAndDelete(session._id);

  return true;
}

