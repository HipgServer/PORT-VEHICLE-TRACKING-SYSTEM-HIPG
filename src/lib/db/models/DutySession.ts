import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { DutyStatus, GeoPoint } from "@/lib/types";

export interface IDutySession extends Document {
  driverId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  status: DutyStatus;
  startLocation?: GeoPoint;
  endLocation?: GeoPoint;
  interruptedAt?: Date;
  resumedAt?: Date;
  interruptionReason?: string;
  completedBySupervisorId?: Types.ObjectId | null;
  supervisorNotes?: string;
  totalDistanceMeters: number;
  durationSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

const DutySessionSchema = new Schema<IDutySession>(
  {
    driverId: { type: Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    startTime: { type: Date, required: true, default: Date.now, index: true },
    endTime: { type: Date },
    status: {
      type: String,
      enum: ["NOT_ON_DUTY", "DUTY_ACTIVE", "DUTY_INTERRUPTED", "DUTY_COMPLETED"],
      default: "DUTY_ACTIVE",
      index: true,
    },
    startLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: [Number],
    },
    endLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: [Number],
    },
    interruptedAt: { type: Date },
    resumedAt: { type: Date },
    interruptionReason: { type: String, trim: true },
    completedBySupervisorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    supervisorNotes: { type: String, trim: true },
    totalDistanceMeters: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
  },
  { timestamps: true }
);

DutySessionSchema.index({ vehicleId: 1, status: 1 });
DutySessionSchema.index({ driverId: 1, status: 1 });

export const DutySession: Model<IDutySession> =
  mongoose.models.DutySession ||
  mongoose.model<IDutySession>("DutySession", DutySessionSchema);

