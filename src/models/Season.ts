import mongoose, { Document, Schema } from "mongoose";

export interface ISeason extends Document {
  number: number;
  tournaments: Schema.Types.ObjectId[];
  winner?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SeasonSchema = new mongoose.Schema<ISeason>({
  number: { type: Number, required: true, unique: true },
  tournaments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

SeasonSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<ISeason>('Season', SeasonSchema);