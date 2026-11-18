import { Types } from "mongoose";
import { connectDB } from "../db/connection";
import {
  Vehicle,
  Driver,
  DutySession,
  LatestLocation,
  LocationHistory,
  GpsUploadRecord,
  SystemSetting,
} from "../db/models";
import { GpsAdapterFactory } from "./sourceAdapter";
import { validateGpsPayload } from "./validator";
import { evaluateGeofence } from "../geofence/engine";
import { evaluateVehicleTrackingStatus } from "./statusEngine";
import {
  broadcastVehicleLocation,
  broadcastYardEntered,
  broadcastYardExited,
} from "../socket/server";
import { GpsSource, IGpsPayload } from "@/lib/types";

export interface ProcessingResult {
  success: boolean;
  recordId: string;
  vehicleId: string;
  status: "accepted" | "duplicate" | "rejected";
  message?: string;
  error?: string;
  data?: any;
}

export async function processGpsRecord(rawPayload: any): Promise<ProcessingResult> {
  const receiveTime = new Date();
  await connectDB();

  // 1. Normalize Payload via Source Adapter
  const payload: IGpsPayload = GpsAdapterFactory.normalizePayload(rawPayload);

  // 2. Check Idempotency (Duplicate detection)
  const existingUpload = await GpsUploadRecord.findOne({ recordId: payload.recordId });
  if (existingUpload) {
    if (existingUpload.status === "processed") {
      return {
        success: true,
        recordId: payload.recordId,
        vehicleId: payload.vehicleId,
        status: "duplicate",
        message: "Record already processed (idempotent)",
      };
    }
  } else {
    await GpsUploadRecord.create({
      recordId: payload.recordId,
      vehicleId: Types.ObjectId.isValid(payload.vehicleId) ? new Types.ObjectId(payload.vehicleId) : null,
      dutySessionId: Types.ObjectId.isValid(payload.dutySessionId) ? new Types.ObjectId(payload.dutySessionId) : null,
      deviceId: payload.deviceId,
      source: payload.source,
      status: "received",
      receivedAt: receiveTime,
    });
  }

  // 3. Validate Vehicle Existence and Assignment
  const vehicle = await Vehicle.findById(payload.vehicleId);
  if (!vehicle) {
    await markUploadRejected(payload.recordId, `Vehicle not found: ${payload.vehicleId}`);
    return {
      success: false,
      recordId: payload.recordId,
      vehicleId: payload.vehicleId,
      status: "rejected",
      error: `Vehicle not found: ${payload.vehicleId}`,
    };
  }

  // 4. Validate Active Duty Session (for PWA / Driver sessions)
  let activeDutySession = null;
  if (payload.dutySessionId && payload.dutySessionId !== "HARDWARE_SESSION" && payload.dutySessionId !== "FLEET_PERMANENT") {
    activeDutySession = await DutySession.findById(payload.dutySessionId);
    if (!activeDutySession) {
      await markUploadRejected(payload.recordId, `Duty session not found: ${payload.dutySessionId}`);
      return {
        success: false,
        recordId: payload.recordId,
        vehicleId: payload.vehicleId,
        status: "rejected",
        error: "Duty session does not exist",
      };
    }

    // Never accept GPS uploads against completed duty sessions
    if (activeDutySession.status === "DUTY_COMPLETED" || activeDutySession.status === "NOT_ON_DUTY") {
      await markUploadRejected(payload.recordId, `Upload rejected: duty session status is ${activeDutySession.status}`);
      return {
        success: false,
        recordId: payload.recordId,
        vehicleId: payload.vehicleId,
        status: "rejected",
        error: `Cannot upload GPS against closed duty session (${activeDutySession.status})`,
      };
    }

    // Verify duty session belongs to this vehicle
    if (activeDutySession.vehicleId.toString() !== vehicle._id.toString()) {
      await markUploadRejected(payload.recordId, "Duty session does not match vehicle");
      return {
        success: false,
        recordId: payload.recordId,
        vehicleId: payload.vehicleId,
        status: "rejected",
        error: "Duty session vehicle mismatch",
      };
    }
  }

  // 5. Retrieve System Accuracy & Policy Settings
  const maxAccuracySetting = await SystemSetting.findOne({ key: "GPS_MIN_ACCURACY_METERS" });
  const maxAccuracy = maxAccuracySetting?.value ?? 50;

  // Retrieve current latest location for timestamp validation
  const existingLatest = await LatestLocation.findOne({ vehicleId: vehicle._id });

  // 6. Validate Coordinates, Accuracy, Timestamps
  const validation = validateGpsPayload(payload, maxAccuracy, existingLatest?.lastAcceptedGpsTime);
  if (!validation.isValid) {
    const errorMsg = validation.errors.join(", ");
    await markUploadRejected(payload.recordId, errorMsg);
    return {
      success: false,
      recordId: payload.recordId,
      vehicleId: payload.vehicleId,
      status: "rejected",
      error: errorMsg,
    };
  }

  const gpsDate = new Date(payload.timestamp);
  const coordinates: [number, number] = [payload.longitude, payload.latitude];
  const speed = payload.speed || 0;
  const heading = payload.heading || 0;
  const isMoving = speed > 2;

  // 7. Store Accepted Location in LocationHistory
  await LocationHistory.create({
    recordId: payload.recordId,
    vehicleId: vehicle._id,
    driverId: payload.driverId && Types.ObjectId.isValid(payload.driverId) ? new Types.ObjectId(payload.driverId) : null,
    dutySessionId: activeDutySession ? activeDutySession._id : null,
    deviceId: payload.deviceId,
    source: payload.source as GpsSource,
    location: {
      type: "Point",
      coordinates,
    },
    accuracy: payload.accuracy,
    speed,
    heading,
    altitude: payload.altitude,
    gpsTimestamp: gpsDate,
    receivedAt: receiveTime,
    batteryLevel: payload.batteryLevel,
  });

  // 8. Execute Geofencing Engine
  const previousYardId = existingLatest?.currentYardId || null;
  const geofenceResult = await evaluateGeofence(
    vehicle._id.toString(),
    payload.driverId || null,
    activeDutySession ? activeDutySession._id.toString() : null,
    payload.deviceId,
    coordinates,
    payload.accuracy,
    gpsDate,
    previousYardId
  );

  const currentYardId = geofenceResult.currentYardId;

  // Update vehicle's current yard
  if (currentYardId !== previousYardId) {
    await Vehicle.findByIdAndUpdate(vehicle._id, { currentYardId });
  }

  // 9. Update LatestLocation with Separate Timestamps
  const processTime = new Date();
  const broadcastTime = new Date();

  const dutyStatus = activeDutySession ? activeDutySession.status : "NOT_ON_DUTY";
  const statusEval = evaluateVehicleTrackingStatus({
    dutyStatus,
    lastAcceptedGpsTime: gpsDate,
    isTrackingInterrupted: false,
  });

  const updatedLatest = await LatestLocation.findOneAndUpdate(
    { vehicleId: vehicle._id },
    {
      vehicleId: vehicle._id,
      driverId: payload.driverId && Types.ObjectId.isValid(payload.driverId) ? new Types.ObjectId(payload.driverId) : null,
      dutySessionId: activeDutySession ? activeDutySession._id : null,
      deviceId: payload.deviceId,
      source: payload.source as GpsSource,
      location: {
        type: "Point",
        coordinates,
      },
      accuracy: payload.accuracy,
      speed,
      heading,
      altitude: payload.altitude,
      gpsTimestamp: gpsDate,
      lastReceivedGpsTime: receiveTime,
      lastAcceptedGpsTime: gpsDate,
      lastProcessedTime: processTime,
      lastBroadcastTime: broadcastTime,
      trackingStatus: statusEval.trackingStatus,
      currentYardId,
      isMoving,
      batteryLevel: payload.batteryLevel,
    },
    { upsert: true, new: true }
  );

  // If duty session is active and was previously interrupted, resume it!
  if (activeDutySession && activeDutySession.status === "DUTY_INTERRUPTED") {
    await DutySession.findByIdAndUpdate(activeDutySession._id, {
      status: "DUTY_ACTIVE",
      resumedAt: new Date(),
    });
  }

  // 10. Mark Upload Record as Processed
  await GpsUploadRecord.findOneAndUpdate(
    { recordId: payload.recordId },
    {
      status: "processed",
      processedAt: processTime,
    }
  );

  // 11. Broadcast Real-Time Updates via Socket.IO
  broadcastVehicleLocation({
    vehicleId: vehicle._id.toString(),
    vehicleNumber: vehicle.vehicleNumber,
    coordinates,
    speed,
    heading,
    accuracy: payload.accuracy,
    timestamp: gpsDate.toISOString(),
    trackingStatus: statusEval.trackingStatus,
    dutyStatus,
    currentYardId: currentYardId ? currentYardId.toString() : undefined,
    currentYardName: geofenceResult.yardName,
    driverId: payload.driverId,
  });

  if (geofenceResult.eventType === "YARD_ENTERED" && geofenceResult.yardName) {
    broadcastYardEntered({
      vehicleId: vehicle._id.toString(),
      yardId: currentYardId ? currentYardId.toString() : "",
      yardName: geofenceResult.yardName,
      timestamp: gpsDate.toISOString(),
      coordinates,
    });
  } else if (geofenceResult.eventType === "YARD_EXITED" && geofenceResult.yardName) {
    broadcastYardExited({
      vehicleId: vehicle._id.toString(),
      yardId: previousYardId ? previousYardId.toString() : "",
      yardName: geofenceResult.yardName,
      timestamp: gpsDate.toISOString(),
      coordinates,
    });
  }

  return {
    success: true,
    recordId: payload.recordId,
    vehicleId: vehicle._id.toString(),
    status: "accepted",
    data: {
      trackingStatus: statusEval.trackingStatus,
      yardEvent: geofenceResult.eventType,
      currentYardId,
    },
  };
}

async function markUploadRejected(recordId: string, reason: string) {
  await GpsUploadRecord.findOneAndUpdate(
    { recordId },
    {
      status: "rejected",
      rejectionReason: reason,
      processedAt: new Date(),
    },
    { upsert: true }
  );
}

