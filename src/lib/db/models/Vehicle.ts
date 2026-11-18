import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { VehicleType } from "@/lib/types";

export interface IVehicle extends Document {
  vehicleNumber: string;
  type: VehicleType;
  makeModel: string;
  status: "active" | "maintenance" | "inactive";
  assignedDriverId?: Types.ObjectId | null;
  currentYardId?: Types.ObjectId | null;
  licensePlate: string;
  maxSpeedKmh: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema = new Schema<IVehicle>(
  {
    vehicleNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: {
      type: String,
      enum: ["terminal_tractor", "reach_stacker", "forklift", "shuttle_bus", "pickup", "patrol_car"],
      required: true,
      index: true,
    },
    makeModel: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "maintenance", "inactive"],
      default: "active",
      index: true,
    },
    assignedDriverId: { type: Schema.Types.ObjectId, ref: "Driver", default: null },
    currentYardId: { type: Schema.Types.ObjectId, ref: "Yard", default: null },
    licensePlate: { type: String, required: true, trim: true, uppercase: true },
    maxSpeedKmh: { type: Number, default: 60 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

VehicleSchema.index({ status: 1, type: 1 });

export const Vehicle: Model<IVehicle> =
  mongoose.models.Vehicle || mongoose.model<IVehicle>("Vehicle", VehicleSchema);

