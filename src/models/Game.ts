import mongoose from "mongoose";

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String },
  imageUrl: { type: String, default: "" },
  roles: [
    {
      name: { type: String, required: true, trim: true },
      color: { type: String, default: "#6B7280" },
    },
  ],
}, { timestamps: true });

gameSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model("Game", gameSchema);