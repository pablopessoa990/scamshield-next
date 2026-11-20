import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["message", "link", "image"], required: true },
  content: { type: String, required: true, maxlength: 10000 },
  score: { type: Number, min: 0, max: 100, required: true },
  risk: { type: String, enum: ["BAIXO", "MEDIO", "ALTO"], required: true },
  verdict: { type: String, required: true },
  indicators: { type: [mongoose.Schema.Types.Mixed], default: [] },
  urls: { type: [mongoose.Schema.Types.Mixed], default: [] },
  recommendations: { type: [String], default: [] },
  explanation: { type: String, default: "" },
  engine: { type: String, default: "rules" }
}, { timestamps: true });

analysisSchema.index({ user: 1, createdAt: -1 });
export default mongoose.models.Analysis || mongoose.model("Analysis", analysisSchema);
