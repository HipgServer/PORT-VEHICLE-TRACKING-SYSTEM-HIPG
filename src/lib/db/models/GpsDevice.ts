import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { GpsSource } from "@/lib/types";

export interface IGpsDevice extends Document {
  deviceId: string;
  name: string;
  type: GpsSource;
  apiKeyHash?: string;
  assignedVehicleId?: Types.ObjectId | null;
  status: "active" | "inactive" | "revoked";
  lastHeartbeatAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const GpsDeviceSchema = new Schema<IGpsDevice>(
  {
    deviceId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["PWA_BROWSER_GPS", "ANDROID_GPS", "ESP32_GPS", "COMMERCIAL_GPS"],
      default: "PWA_BROWSER_GPS",
      index: true,
    },
    apiKeyHash: { type: String, select: false },
    assignedVehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", default: null, index: true },
    status: {
      type: String,
      enum: ["active", "inactive", "revoked"],
      default: "active",
      index: true,
    },
    lastHeartbeatAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const GpsDevice: Model<IGpsDevice> =
  mongoose.models.GpsDevice || mongoose.model<IGpsDevice>("GpsDevice", GpsDeviceSchema);

