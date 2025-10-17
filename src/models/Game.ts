import mongoose, { Document, Schema } from "mongoose";

export interface IGameRole {
  name: string;
  color: string;
}

export interface IGame extends Document {
  name: string;
  description?: string;
  imageUrl: string;
  roles: IGameRole[];
  createdAt: Date;
  updatedAt: Date;
}

const gameSchema = new mongoose.Schema<IGame>({
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

export default mongoose.model<IGame>("Game", gameSchema);