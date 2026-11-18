import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  User,
  Vehicle,
  Driver,
  GpsDevice,
  Yard,
  LatestLocation,
  LocationHistory,
  YardEvent,
  DutySession,
  GpsUploadRecord,
  AuditLog,
  Notification,
  SystemSetting,
} from "../lib/db/models";

dotenv.config({ path: ".env.local" });
dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/peri_tracker";

async function clearSampleData() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected successfully.\n");

  console.log("--- Clearing Sample / Dummy Fleet Data ---");

  const deletedVehicles = await Vehicle.deleteMany({});
  console.log(`✔ Removed ${deletedVehicles.deletedCount} sample vehicles.`);

  const deletedLocations = await LatestLocation.deleteMany({});
  console.log(`✔ Removed ${deletedLocations.deletedCount} sample latest-location records.`);

  const deletedHistory = await LocationHistory.deleteMany({});
  console.log(`✔ Removed ${deletedHistory.deletedCount} sample history tracks.`);

  const deletedSessions = await DutySession.deleteMany({});
  console.log(`✔ Removed ${deletedSessions.deletedCount} sample duty sessions.`);

  const deletedDrivers = await Driver.deleteMany({});
  console.log(`✔ Removed ${deletedDrivers.deletedCount} sample driver profiles.`);

  const deletedDevices = await GpsDevice.deleteMany({});
  console.log(`✔ Removed ${deletedDevices.deletedCount} sample GPS devices.`);

  const deletedYardEvents = await YardEvent.deleteMany({});
  console.log(`✔ Removed ${deletedYardEvents.deletedCount} sample yard events.`);

  const deletedUploads = await GpsUploadRecord.deleteMany({});
  console.log(`✔ Removed ${deletedUploads.deletedCount} sample GPS upload records.`);

  const deletedNotifications = await Notification.deleteMany({});
  console.log(`✔ Removed ${deletedNotifications.deletedCount} sample notifications.`);

  const deletedAudits = await AuditLog.deleteMany({});
  console.log(`✔ Removed ${deletedAudits.deletedCount} sample audit logs.`);

  // Remove non-admin sample users, preserve admin
  const deletedUsers = await User.deleteMany({ role: { $ne: "admin" } });
  console.log(`✔ Removed ${deletedUsers.deletedCount} sample user accounts (preserved Administrator).`);

  // Verify Yards and SystemSettings are preserved
  const yardCount = await Yard.countDocuments();
  const settingCount = await SystemSetting.countDocuments();
  const adminUser = await User.findOne({ role: "admin" });

  console.log("\n--- Active Infrastructure Preserved ---");
  console.log(`✔ Hambantota Port Geofenced Yards: ${yardCount} active zones`);
  console.log(`✔ Port System Operational Settings: ${settingCount} rules`);
  console.log(`✔ Administrator Account: ${adminUser?.username || "admin"} (${adminUser?.email})`);

  console.log("\n=======================================================");
  console.log("CLEANUP COMPLETE: SYSTEM READY FOR 100% REAL PRODUCTION DATA!");
  console.log("=======================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

clearSampleData().catch((err) => {
  console.error("Error clearing sample data:", err);
  process.exit(1);
});

