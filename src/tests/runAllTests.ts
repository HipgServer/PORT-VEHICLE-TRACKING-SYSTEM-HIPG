import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { testAuthentication } from "./auth.test";
import { testGpsValidation } from "./gpsValidation.test";
import { testDutySession } from "./dutySession.test";
import { testGeofencing } from "./geofence.test";
import { testStatusEngine } from "./statusEngine.test";

async function runAllTests() {
  console.log("\n=======================================================");
  console.log("🧪 PERI TRACKER - AUTOMATED TEST SUITE EXECUTION");
  console.log("=======================================================\n");

  const startTime = Date.now();
  let passed = 0;
  let total = 5;

  try {
    await testAuthentication();
    passed++;
    console.log();

    await testGpsValidation();
    passed++;
    console.log();

    await testDutySession();
    passed++;
    console.log();

    await testGeofencing();
    passed++;
    console.log();

    await testStatusEngine();
    passed++;
    console.log();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("=======================================================");
    console.log(`🎉 ALL ${passed}/${total} TEST SUITES PASSED SUCCESSFULLY! (${duration}s)`);
    console.log("=======================================================\n");
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ TEST SUITE FAILED:");
    console.error(error.message);
    console.error("=======================================================\n");
    process.exit(1);
  }
}

runAllTests();
