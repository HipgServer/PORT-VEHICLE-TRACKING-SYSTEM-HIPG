import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISystemSetting extends Document {
  key: string;
  value: any;
  description?: string;
  updatedAt: Date;
}

const SystemSettingSchema = new Schema<ISystemSetting>(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

export const SystemSetting: Model<ISystemSetting> =
  mongoose.models.SystemSetting ||
  mongoose.model<ISystemSetting>("SystemSetting", SystemSettingSchema);

