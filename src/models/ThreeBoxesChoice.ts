import mongoose from "mongoose";

export interface IThreeBoxesChoice extends mongoose.Document {
  userId: mongoose.Schema.Types.ObjectId;
  // permutation of [0,50,100] representing boxes 1..3
  permutation: number[];
  chosenIndex?: number | null; // 0 | 1 | 2
  reward?: number | null; // 0 | 50 | 100
  credited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ThreeBoxesChoiceSchema = new mongoose.Schema<IThreeBoxesChoice>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  permutation: [{ type: Number, required: true }],
  chosenIndex: { type: Number, required: false, default: null },
  reward: { type: Number, required: false, default: null },
  credited: { type: Boolean, required: true, default: false },
}, {
  timestamps: true,
  _id: true,
  id: false,
});

ThreeBoxesChoiceSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default ThreeBoxesChoiceSchema;
