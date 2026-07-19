import mongoose, { Schema, Document } from "mongoose";

export type CommandType = "SYSTEM_PROMPT_ADDON" | "AUTO_REPLY" | "SALES_STRATEGY";

export interface ICustomCommand extends Document {
  tenantId:       mongoose.Types.ObjectId;
  commandType:    CommandType;
  label:          string;          // Human-readable name shown in dashboard
  triggerKeywords: string[];       // Trigger words/phrases (used for AUTO_REPLY matching)
  commandContent: string;          // Injected text (may contain {{shop_name}}, {{bot_name}})
  priority:       number;          // Higher = earlier in Layer 3 injection (1–100)
  isActive:       boolean;
  validationWarning?: string;      // Set if commandContent triggered a rules pre-scan warning
  createdBy:      string;
  updatedBy:      string;
  createdAt:      Date;
  updatedAt:      Date;
}

const customCommandSchema = new Schema<ICustomCommand>(
  {
    tenantId: {
      type: Schema.Types.ObjectId, ref: "Tenant",
      required: true, index: true,
    },
    commandType: {
      type: String,
      enum: ["SYSTEM_PROMPT_ADDON", "AUTO_REPLY", "SALES_STRATEGY"],
      required: true,
    },
    label: { type: String, required: true, maxlength: 200 },
    triggerKeywords: { type: [String], default: [] },
    commandContent: {
      type: String, required: true, maxlength: 3000,
    },
    priority:  { type: Number, default: 50, min: 1, max: 100 },
    isActive:  { type: Boolean, default: true, index: true },
    validationWarning: { type: String, default: "" },
    createdBy: { type: String, default: "admin" },
    updatedBy: { type: String, default: "admin" },
  },
  { timestamps: true }
);

// Compound index: tenant + active commands sorted by priority
customCommandSchema.index({ tenantId: 1, isActive: 1, priority: -1 });

export default mongoose.models.CustomCommand as mongoose.Model<ICustomCommand> ||
  mongoose.model<ICustomCommand>("CustomCommand", customCommandSchema);
