import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { GeoPoint, GpsSource } from "@/lib/types";

export interface ILocationHistory extends Document {
  recordId: string;
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
  receivedAt: Date;
  yardId?: Types.ObjectId | null;
  batteryLevel?: number;
}

const LocationHistorySchema = new Schema<ILocationHistory>(
  {
    recordId: { type: String, required: true, unique: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    dutySessionId: { type: Schema.Types.ObjectId, ref: "DutySession", default: null, index: true },
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
    receivedAt: { type: Date, default: Date.now },
    yardId: { type: Schema.Types.ObjectId, ref: "Yard", default: null, index: true },
    batteryLevel: { type: Number },
  },
  { timestamps: false }
);

LocationHistorySchema.index({ vehicleId: 1, gpsTimestamp: -1 });
LocationHistorySchema.index({ dutySessionId: 1, gpsTimestamp: 1 });
LocationHistorySchema.index({ location: "2dsphere" });

export const LocationHistory: Model<ILocationHistory> =
  mongoose.models.LocationHistory ||
  mongoose.model<ILocationHistory>("LocationHistory", LocationHistorySchema);

