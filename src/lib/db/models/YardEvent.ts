import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { GeoPoint, YardEventType } from "@/lib/types";

export interface IYardEvent extends Document {
  vehicleId: Types.ObjectId;
  driverId?: Types.ObjectId | null;
  dutySessionId?: Types.ObjectId | null;
  yardId?: Types.ObjectId | null;
  previousYardId?: Types.ObjectId | null;
  eventType: YardEventType;
  timestamp: Date;
  location: GeoPoint;
  accuracy: number;
  deviceId?: string;
  processedAt: Date;
}

const YardEventSchema = new Schema<IYardEvent>(
  {
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", default: null, index: true },
    dutySessionId: { type: Schema.Types.ObjectId, ref: "DutySession", default: null, index: true },
    yardId: { type: Schema.Types.ObjectId, ref: "Yard", default: null, index: true },
    previousYardId: { type: Schema.Types.ObjectId, ref: "Yard", default: null },
    eventType: {
      type: String,
      enum: ["YARD_ENTERED", "YARD_EXITED", "YARD_CHANGED", "OUTSIDE_ALL_YARDS"],
      required: true,
      index: true,
    },
    timestamp: { type: Date, required: true, index: true },
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
    deviceId: { type: String, trim: true },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

YardEventSchema.index({ vehicleId: 1, timestamp: -1 });
YardEventSchema.index({ yardId: 1, eventType: 1, timestamp: -1 });

export const YardEvent: Model<IYardEvent> =
  mongoose.models.YardEvent || mongoose.model<IYardEvent>("YardEvent", YardEventSchema);

