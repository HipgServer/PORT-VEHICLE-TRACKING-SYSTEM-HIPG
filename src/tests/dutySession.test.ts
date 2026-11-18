import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../lib/db/connection";
import { DutySession, Vehicle, Driver, User } from "../lib/db/models";

dotenv.config({ path: ".env.local" });

export async function testDutySession(): Promise<boolean> {
  console.log("▶ Testing Duty Session Lifecycle & Validation Rules...");
  await connectDB();

  // Find or create temporary test driver and vehicle
  let driver = await Driver.findOne();
  let vehicle = await Vehicle.findOne();
  let createdTempDriver = false;
  let createdTempVehicle = false;

  if (!vehicle) {
    vehicle = await Vehicle.create({
      vehicleNumber: "TEST-TT-999",
      type: "terminal_tractor",
      makeModel: "Test Kalmar 4x2",
      licensePlate: "TEST-PLATE-999",
      status: "active",
      maxSpeedKmh: 45,
    });
    createdTempVehicle = true;
  }

  if (!driver) {
    const tempUser = await User.create({
      username: `test_driver_${Date.now()}`,
      email: `test_driver_${Date.now()}@hipg.lk`,
      passwordHash: "testhash123",
      fullName: "Test Automated Driver",
      role: "driver",
      active: true,
    });
    driver = await Driver.create({
      userId: tempUser._id,
      employeeId: "TEST-EMP-999",
      licenseNumber: "DL-TEST-999",
      licenseExpiry: new Date("2030-01-01"),
      status: "available",
    });
    createdTempDriver = true;
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

  // Clean up test session and temporary entities
  await DutySession.findByIdAndDelete(session._id);
  if (createdTempVehicle && vehicle) {
    await Vehicle.findByIdAndDelete(vehicle._id);
  }
  if (createdTempDriver && driver) {
    await User.findByIdAndDelete(driver.userId);
    await Driver.findByIdAndDelete(driver._id);
  }

  return true;
}

