import { evaluateVehicleTrackingStatus } from "../lib/gps/statusEngine";

export async function testStatusEngine(): Promise<boolean> {
  console.log("▶ Testing Vehicle Tracking Status Engine & Confidence Thresholds...");

  const now = Date.now();

  // 1. ONLINE status (< 60s)
  const onlineResult = evaluateVehicleTrackingStatus({
    dutyStatus: "DUTY_ACTIVE",
    lastAcceptedGpsTime: new Date(now - 15 * 1000), // 15s ago
    staleThresholdSeconds: 60,
    offlineThresholdSeconds: 180,
  });

  if (onlineResult.trackingStatus !== "ONLINE" || onlineResult.isLive !== true) {
    throw new Error(`Expected ONLINE/isLive=true, got: ${onlineResult.trackingStatus}`);
  }
  console.log("  ✔ ONLINE Classification (< 60s) passed");

  // 2. STALE status (60s - 180s)
  // CRITICAL REQUIREMENT: Never present stale locations as live data!
  const staleResult = evaluateVehicleTrackingStatus({
    dutyStatus: "DUTY_ACTIVE",
    lastAcceptedGpsTime: new Date(now - 90 * 1000), // 90s ago
    staleThresholdSeconds: 60,
    offlineThresholdSeconds: 180,
  });

  if (staleResult.trackingStatus !== "STALE" || staleResult.isLive === true) {
    throw new Error("Stale coordinate was improperly marked as live data");
  }
  console.log("  ✔ STALE Classification (60s-180s) & isLive=false passed");

  // 3. OFFLINE status (> 180s)
  const offlineResult = evaluateVehicleTrackingStatus({
    dutyStatus: "DUTY_ACTIVE",
    lastAcceptedGpsTime: new Date(now - 300 * 1000), // 5 mins ago
    staleThresholdSeconds: 60,
    offlineThresholdSeconds: 180,
  });

  if (offlineResult.trackingStatus !== "OFFLINE" || offlineResult.confidence !== "LOW") {
    throw new Error(`Expected OFFLINE, got: ${offlineResult.trackingStatus}`);
  }
  console.log("  ✔ OFFLINE Classification (> 180s) passed");

  // 4. TRACKING_INTERRUPTED status
  const interruptedResult = evaluateVehicleTrackingStatus({
    dutyStatus: "DUTY_INTERRUPTED",
    lastAcceptedGpsTime: new Date(now - 10 * 1000),
    isTrackingInterrupted: true,
  });

  if (interruptedResult.trackingStatus !== "TRACKING_INTERRUPTED" || interruptedResult.isLive === true) {
    throw new Error("Interrupted tracking was improperly marked live");
  }
  console.log("  ✔ TRACKING_INTERRUPTED Classification passed");

  // 5. NOT_ON_DUTY status
  const notOnDutyResult = evaluateVehicleTrackingStatus({
    dutyStatus: "NOT_ON_DUTY",
    lastAcceptedGpsTime: new Date(now - 10 * 1000),
  });

  if (notOnDutyResult.trackingStatus !== "NOT_ON_DUTY") {
    throw new Error("Expected NOT_ON_DUTY when no active duty session exists");
  }
  console.log("  ✔ NOT_ON_DUTY Separation passed");

  return true;
}

