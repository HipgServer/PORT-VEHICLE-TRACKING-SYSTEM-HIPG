import mongoose, { Schema, Document, Model } from "mongoose";
import { YardCategory, GeoPolygon } from "@/lib/types";

export interface IYard extends Document {
  name: string;
  code: string;
  category: YardCategory;
  capacity: number;
  currentCount: number;
  speedLimitKmh: number;
  color: string;
  active: boolean;
  boundary: GeoPolygon;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const YardSchema = new Schema<IYard>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    category: {
      type: String,
      enum: ["roro", "container", "bulk", "customs", "maintenance", "gate", "service"],
      required: true,
      index: true,
    },
    capacity: { type: Number, required: true, default: 500 },
    currentCount: { type: Number, default: 0 },
    speedLimitKmh: { type: Number, default: 30 },
    color: { type: String, default: "#3b82f6" },
    active: { type: Boolean, default: true, index: true },
    boundary: {
      type: {
        type: String,
        enum: ["Polygon"],
        required: true,
        default: "Polygon",
      },
      coordinates: {
        type: [[[Number]]],
        required: true,
      },
    },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

YardSchema.index({ boundary: "2dsphere" });

export const Yard: Model<IYard> =
  mongoose.models.Yard || mongoose.model<IYard>("Yard", YardSchema);

