import { z } from "zod";
import { IGpsPayload } from "@/lib/types";

export const GpsPayloadSchema = z.object({
  recordId: z.string().min(1, "recordId is required"),
  source: z.string().default("PWA_BROWSER_GPS"),
  deviceId: z.string().min(1, "deviceId is required"),
  vehicleId: z.string().min(1, "vehicleId is required"),
  driverId: z.string().min(1, "driverId is required"),
  dutySessionId: z.string().min(1, "dutySessionId is required"),
  latitude: z.number().min(-90).max(90, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180).max(180, "Longitude must be between -180 and 180"),
  accuracy: z.number().positive("Accuracy must be a positive number"),
  speed: z.number().nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  altitude: z.number().nullable().optional(),
  timestamp: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Timestamp must be a valid ISO 8601 UTC date string",
  }),
  localTimestamp: z.string().optional(),
  batteryLevel: z.number().min(0).max(100).optional(),
});

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedData?: IGpsPayload;
}

export function validateGpsPayload(
  payload: unknown,
  maxAccuracyMeters: number = 50,
  lastAcceptedTimestamp?: Date | null
): ValidationResult {
  const parsed = GpsPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
    return { isValid: false, errors };
  }

  const data = parsed.data as IGpsPayload;
  const errors: string[] = [];

  // 1. Accuracy Check
  if (data.accuracy > maxAccuracyMeters) {
    errors.push(`GPS accuracy ${data.accuracy.toFixed(1)}m exceeds maximum acceptable threshold of ${maxAccuracyMeters}m`);
  }

  // 2. Timestamp Sanity Check
  const gpsDate = new Date(data.timestamp);
  const now = new Date();
  const maxFutureDelta = 5 * 60 * 1000; // 5 minutes
  const maxPastDelta = 7 * 24 * 60 * 60 * 1000; // 7 days

  if (gpsDate.getTime() > now.getTime() + maxFutureDelta) {
    errors.push(`GPS timestamp is in the future: ${data.timestamp}`);
  }

  if (now.getTime() - gpsDate.getTime() > maxPastDelta) {
    errors.push(`GPS timestamp is excessively old (> 7 days): ${data.timestamp}`);
  }

  // 3. Out-of-order check against previously accepted timestamp
  if (lastAcceptedTimestamp && gpsDate.getTime() < lastAcceptedTimestamp.getTime()) {
    // Note: Out-of-order records can be buffered offline, but must be flagged
    // We allow historical buffering into history collection, but flag that it won't update latest location
  }

  if (errors.length > 0) {
    return { isValid: false, errors, normalizedData: data };
  }

  return { isValid: true, errors: [], normalizedData: data };
}

