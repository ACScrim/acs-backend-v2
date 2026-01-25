import mongoose from 'mongoose';
import ThreeBoxesChoiceSchema, { IThreeBoxesChoice } from './ThreeBoxesChoice';

export interface IThreeBoxesDay extends mongoose.Document {
  date: string; // normalized YYYY-MM-DD
  choices: IThreeBoxesChoice[];
  createdAt: Date;
  updatedAt: Date;
}

const ThreeBoxesDaySchema = new mongoose.Schema<IThreeBoxesDay>({
  date: { type: String, required: true },
  choices: { type: [ThreeBoxesChoiceSchema], default: [] },
}, {
  timestamps: true,
});

// Unique day
ThreeBoxesDaySchema.index({ date: 1 }, { unique: true });
// Prevent same user to have multiple choices for the same day
ThreeBoxesDaySchema.index({ date: 1, 'choices.userId': 1 }, { unique: true, sparse: true });

ThreeBoxesDaySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const ThreeBoxesDay = mongoose.model<IThreeBoxesDay>('ThreeBoxesDay', ThreeBoxesDaySchema);
export default ThreeBoxesDay;
