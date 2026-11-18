import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { GeoPoint, GpsSource, VehicleTrackingStatus } from "@/lib/types";

export interface ILatestLocation extends Document {
  vehicleId: Types.ObjectId;
  driverId?: Types.ObjectId | null;
  dutySessionId?: Types.ObjectId | null;
  deviceId?: string;
  source: GpsSource;
  location: GeoPoint;
  accuracy: number;
  speed: number;
  heading: number;
  altitude?: number | null;
  gpsTimestamp: Date;
  lastReceivedGpsTime: Date;
  lastAcceptedGpsTime: Date;
  lastProcessedTime: Date;
  lastBroadcastTime?: Date;
  trackingStatus: VehicleTrackingStatus;
  currentYardId?: Types.ObjectId | null;
  isMoving: boolean;
  batteryLevel?: number;
  createdAt: Date;
  updatedAt: Date;
}

const LatestLocationSchema = new Schema<ILatestLocation>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, unique: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", default: null },
    dutySessionId: { type: Schema.Types.ObjectId, ref: "DutySession", default: null },
    deviceId: { type: String, trim: true },
    source: {
      type: String,
      enum: ["PWA_BROWSER_GPS", "ANDROID_GPS", "ESP32_GPS", "COMMERCIAL_GPS"],
      default: "PWA_BROWSER_GPS",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    accuracy: { type: Number, required: true },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    altitude: { type: Number, default: null },
    gpsTimestamp: { type: Date, required: true, index: true },
    lastReceivedGpsTime: { type: Date, required: true },
    lastAcceptedGpsTime: { type: Date, required: true },
    lastProcessedTime: { type: Date, required: true },
    lastBroadcastTime: { type: Date },
    trackingStatus: {
      type: String,
      enum: ["ONLINE", "STALE", "OFFLINE", "TRACKING_INTERRUPTED", "NOT_ON_DUTY"],
      default: "NOT_ON_DUTY",
      index: true,
    },
    currentYardId: { type: Schema.Types.ObjectId, ref: "Yard", default: null, index: true },
    isMoving: { type: Boolean, default: false },
    batteryLevel: { type: Number },
  },
  { timestamps: true }
);

LatestLocationSchema.index({ location: "2dsphere" });
LatestLocationSchema.index({ trackingStatus: 1, lastAcceptedGpsTime: -1 });

export const LatestLocation: Model<ILatestLocation> =
  mongoose.models.LatestLocation ||
  mongoose.model<ILatestLocation>("LatestLocation", LatestLocationSchema);

