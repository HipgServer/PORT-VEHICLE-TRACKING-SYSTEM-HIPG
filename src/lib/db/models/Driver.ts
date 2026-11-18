import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IDriver extends Document {
  userId: Types.ObjectId;
  employeeId: string;
  licenseNumber: string;
  licenseExpiry: Date;
  assignedVehicleId?: Types.ObjectId | null;
  currentDutySessionId?: Types.ObjectId | null;
  status: "available" | "on_duty" | "off_duty" | "suspended";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    employeeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    licenseNumber: { type: String, required: true, trim: true },
    licenseExpiry: { type: Date, required: true },
    assignedVehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", default: null },
    currentDutySessionId: { type: Schema.Types.ObjectId, ref: "DutySession", default: null },
    status: {
      type: String,
      enum: ["available", "on_duty", "off_duty", "suspended"],
      default: "off_duty",
      index: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Driver: Model<IDriver> =
  mongoose.models.Driver || mongoose.model<IDriver>("Driver", DriverSchema);

