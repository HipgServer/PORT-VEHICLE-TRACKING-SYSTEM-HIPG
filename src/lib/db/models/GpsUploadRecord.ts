import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IGpsUploadRecord extends Document {
  recordId: string;
  vehicleId?: Types.ObjectId | null;
  dutySessionId?: Types.ObjectId | null;
  deviceId?: string;
  source: string;
  status: "received" | "processed" | "rejected";
  rejectionReason?: string;
  receivedAt: Date;
  processedAt?: Date;
}

const GpsUploadRecordSchema = new Schema<IGpsUploadRecord>(
  {
    recordId: { type: String, required: true, unique: true, index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", default: null, index: true },
    dutySessionId: { type: Schema.Types.ObjectId, ref: "DutySession", default: null, index: true },
    deviceId: { type: String, trim: true },
    source: { type: String, default: "PWA_BROWSER_GPS" },
    status: {
      type: String,
      enum: ["received", "processed", "rejected"],
      default: "received",
      index: true,
    },
    rejectionReason: { type: String, trim: true },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: false }
);

export const GpsUploadRecord: Model<IGpsUploadRecord> =
  mongoose.models.GpsUploadRecord ||
  mongoose.model<IGpsUploadRecord>("GpsUploadRecord", GpsUploadRecordSchema);

