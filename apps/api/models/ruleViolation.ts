import mongoose, { Schema, Document } from "mongoose";

export interface IRuleViolation extends Document {
  tenantId: mongoose.Types.ObjectId | null;
  sessionId: string;
  ruleIds: string[];
  category: string;
  triggerText: string;
  action: "allow" | "block" | "redirect_human" | "emergency";
  layer: "pre" | "post";
  createdAt: Date;
}

const ruleViolationSchema = new Schema<IRuleViolation>(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    sessionId:   { type: String, required: true, index: true },
    ruleIds:     { type: [String], required: true },
    category:    { type: String, required: true },
    triggerText: { type: String, maxlength: 300 },
    action:      { type: String, enum: ["allow","block","redirect_human","emergency"], required: true },
    layer:       { type: String, enum: ["pre","post"], required: true },
  },
  { timestamps: true }
);

export default mongoose.models.RuleViolation as mongoose.Model<IRuleViolation> ||
  mongoose.model<IRuleViolation>("RuleViolation", ruleViolationSchema);
