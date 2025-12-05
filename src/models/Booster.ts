import mongoose from "mongoose";

export interface IBooster {
  userId: string;
  cardIds: mongoose.Schema.Types.ObjectId[];
  buyDate: Date;
  price: number;
}

const boosterSchema = new mongoose.Schema<IBooster>({
  userId: { type: String, required: true, unique: true },
  cardIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Card", required: true }],
  buyDate: { type: Date, required: true, default: Date.now },
  price: { type: Number, required: true },
});

boosterSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

boosterSchema.virtual('cards', {
  ref: "Card",
  localField: 'cardIds',
  foreignField: '_id',
  justOne: false,
})

const Booster = mongoose.model<IBooster>("Booster", boosterSchema);

export default Booster;