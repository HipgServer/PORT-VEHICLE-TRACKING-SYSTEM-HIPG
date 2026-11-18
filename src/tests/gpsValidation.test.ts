import { validateGpsPayload } from "../lib/gps/validator";
import { GpsAdapterFactory } from "../lib/gps/sourceAdapter";

export async function testGpsValidation(): Promise<boolean> {
  console.log("▶ Testing GPS Validation & Source Adapters...");

  // 1. Valid Coordinate reading
  const validPayload = {
    recordId: "rec-valid-001",
    source: "PWA_BROWSER_GPS",
    deviceId: "DEV-PWA-001",
    vehicleId: "VEH-101",
    driverId: "DRV-101",
    dutySessionId: "SESS-101",
    latitude: 6.1225,
    longitude: 81.1155,
    accuracy: 8.5,
    speed: 18.2,
    heading: 145,
    timestamp: new Date().toISOString(),
  };

  const validRes = validateGpsPayload(validPayload, 50);
  if (!validRes.isValid) {
    throw new Error(`Valid GPS payload failed validation: ${validRes.errors.join(", ")}`);
  }
  console.log("  ✔ Valid Coordinates & Attributes passed");

  // 2. Impossible Latitude & Longitude
  const impossibleCoords = {
    ...validPayload,
    recordId: "rec-invalid-coords",
    latitude: 95.1234, // Impossible (> 90)
    longitude: -195.1234, // Impossible (< -180)
  };
  const invalidCoordRes = validateGpsPayload(impossibleCoords, 50);
  if (invalidCoordRes.isValid) {
    throw new Error("Impossible coordinates [-195, 95] were accepted");
  }
  console.log("  ✔ Impossible Lat/Lng Rejection passed");

  // 3. Excessively Inaccurate Reading
  const inaccuratePayload = {
    ...validPayload,
    recordId: "rec-poor-acc",
    accuracy: 95.0, // 95m > 50m max
  };
  const poorAccRes = validateGpsPayload(inaccuratePayload, 50);
  if (poorAccRes.isValid) {
    throw new Error("GPS accuracy of 95m was accepted when max threshold is 50m");
  }
  console.log("  ✔ Poor GPS Accuracy Filter (> 50m) passed");

  // 4. Future Timestamp Rejection (> 5 mins into future)
  const futurePayload = {
    ...validPayload,
    recordId: "rec-future",
    timestamp: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour into future
  };
  const futureRes = validateGpsPayload(futurePayload, 50);
  if (futureRes.isValid) {
    throw new Error("Future timestamp (+1h) was unexpectedly accepted");
  }
  console.log("  ✔ Future Timestamp Rejection passed");

  // 5. Source Normalization: ESP32 Hardware Adapter
  const rawEsp32 = {
    dev: "ESP32-CHIP-99",
    lat: 6.124,
    lng: 81.119,
    spd: 12.0,
    cog: 180,
    vehicleId: "VEH-102",
  };
  const normalizedEsp = GpsAdapterFactory.normalizePayload({
    ...rawEsp32,
    source: "ESP32_GPS",
  });

  if (
    normalizedEsp.source !== "ESP32_GPS" ||
    normalizedEsp.latitude !== 6.124 ||
    normalizedEsp.longitude !== 81.119
  ) {
    throw new Error("ESP32 hardware source adapter failed normalization");
  }
  console.log("  ✔ Hardware Source Normalizer (ESP32) passed");

  return true;
}

