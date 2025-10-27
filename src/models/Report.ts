import mongoose, { Document, Schema } from "mongoose";

export interface IReport extends Document {
  id: string;
  user: Schema.Types.ObjectId;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true, trim: true },
}, {
  timestamps: true,
});

ReportSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<IReport>('Report', ReportSchema);