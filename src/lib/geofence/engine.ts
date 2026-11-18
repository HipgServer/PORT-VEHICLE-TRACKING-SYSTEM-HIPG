import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import { Yard, YardEvent, IYard } from "../db/models";
import { YardEventType, GeoPolygon } from "../types";
import { Types } from "mongoose";

interface GeofenceCandidate {
  vehicleId: string;
  detectedYardId: string | null;
  count: number;
  lastReadingTime: number;
}

// In-memory candidate tracker for consecutive reading hysteresis
const hysteresisCache = new Map<string, GeofenceCandidate>();

export interface GeofenceResult {
  eventType: YardEventType | null;
  currentYardId: Types.ObjectId | null;
  previousYardId: Types.ObjectId | null;
  yardName?: string;
  confirmed: boolean;
}

/**
 * Checks which yard polygon contains the given coordinate [lng, lat]
 */
export async function findContainingYard(
  coordinates: [number, number],
  allYards?: IYard[]
): Promise<IYard | null> {
  const pt = point(coordinates);
  const yards = allYards || (await Yard.find({ active: true }));

  for (const yard of yards) {
    if (yard.boundary && yard.boundary.coordinates) {
      try {
        const poly = polygon(yard.boundary.coordinates);
        if (booleanPointInPolygon(pt, poly)) {
          return yard;
        }
      } catch (e) {
        // Continue if polygon geometry is malformed
      }
    }
  }

  return null;
}

/**
 * Executes geofence detection with consecutive reading confirmation (hysteresis)
 * to prevent GPS drift from causing erroneous yard entry/exit events.
 */
export async function evaluateGeofence(
  vehicleId: string,
  driverId: string | null,
  dutySessionId: string | null,
  deviceId: string | undefined,
  coordinates: [number, number],
  accuracy: number,
  timestamp: Date,
  previousYardId: Types.ObjectId | null,
  hysteresisThreshold: number = 2
): Promise<GeofenceResult> {
  // If accuracy is too poor (> 40m), do not trigger state changes across borders
  if (accuracy > 40) {
    return {
      eventType: null,
      currentYardId: previousYardId,
      previousYardId,
      confirmed: false,
    };
  }

  const detectedYard = await findContainingYard(coordinates);
  const detectedYardIdStr = detectedYard ? detectedYard._id.toString() : null;
  const previousYardIdStr = previousYardId ? previousYardId.toString() : null;

  // Retrieve existing hysteresis candidate
  let candidate = hysteresisCache.get(vehicleId);

  if (!candidate || candidate.detectedYardId !== detectedYardIdStr) {
    // New potential yard detected - begin consecutive reading evaluation
    candidate = {
      vehicleId,
      detectedYardId: detectedYardIdStr,
      count: 1,
      lastReadingTime: Date.now(),
    };
    hysteresisCache.set(vehicleId, candidate);
  } else {
    // Candidate matches previous reading - increment consecutive confirmation
    candidate.count += 1;
    candidate.lastReadingTime = Date.now();
  }

  // If detected yard is already confirmed as current yard, no event needed
  if (detectedYardIdStr === previousYardIdStr) {
    return {
      eventType: null,
      currentYardId: previousYardId,
      previousYardId,
      yardName: detectedYard?.name,
      confirmed: true,
    };
  }

  // Check if consecutive readings meet the hysteresis threshold
  if (candidate.count >= hysteresisThreshold) {
    let eventType: YardEventType;

    if (previousYardId && detectedYard) {
      eventType = "YARD_CHANGED";
    } else if (!previousYardId && detectedYard) {
      eventType = "YARD_ENTERED";
    } else {
      eventType = "YARD_EXITED";
    }

    const currentYardId = detectedYard ? (detectedYard._id as Types.ObjectId) : null;

    // Persist YardEvent in DB
    const validVehicleId = Types.ObjectId.isValid(vehicleId)
      ? new Types.ObjectId(vehicleId)
      : new Types.ObjectId();

    await YardEvent.create({
      vehicleId: validVehicleId,
      driverId: driverId && Types.ObjectId.isValid(driverId) ? new Types.ObjectId(driverId) : null,
      dutySessionId: dutySessionId && Types.ObjectId.isValid(dutySessionId) ? new Types.ObjectId(dutySessionId) : null,
      yardId: currentYardId,
      previousYardId,
      eventType,
      timestamp,
      location: {
        type: "Point",
        coordinates,
      },
      accuracy,
      deviceId,
      processedAt: new Date(),
    });

    // Update Yard occupancy counters
    if (previousYardId) {
      await Yard.findByIdAndUpdate(previousYardId, { $inc: { currentCount: -1 } });
    }
    if (currentYardId) {
      await Yard.findByIdAndUpdate(currentYardId, { $inc: { currentCount: 1 } });
    }

    return {
      eventType,
      currentYardId,
      previousYardId,
      yardName: detectedYard?.name,
      confirmed: true,
    };
  }

  // Pending confirmation: keep previous yard until threshold is reached
  return {
    eventType: null,
    currentYardId: previousYardId,
    previousYardId,
    confirmed: false,
  };
}
