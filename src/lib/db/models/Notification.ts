import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { UserRole } from "@/lib/types";

export interface INotification extends Document {
  recipientRoles?: UserRole[];
  recipientUserId?: Types.ObjectId | null;
  type:
    | "TRACKING_INTERRUPTED"
    | "DEVICE_OFFLINE"
    | "YARD_ENTRY"
    | "YARD_EXIT"
    | "DUTY_INTERRUPTED"
    | "GPS_WARNING"
    | "SYSTEM_ALERT";
  title: string;
  message: string;
  data?: Record<string, any>;
  readBy: Types.ObjectId[];
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientRoles: [{ type: String, enum: ["admin", "supervisor", "operator", "driver"] }],
    recipientUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "TRACKING_INTERRUPTED",
        "DEVICE_OFFLINE",
        "YARD_ENTRY",
        "YARD_EXIT",
        "DUTY_INTERRUPTED",
        "GPS_WARNING",
        "SYSTEM_ALERT",
      ],
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    data: { type: Schema.Types.Mixed, default: {} },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

NotificationSchema.index({ recipientRoles: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

