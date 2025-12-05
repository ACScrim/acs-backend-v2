import mongoose from "mongoose";

export interface IBooster {
  userId: mongoose.Schema.Types.ObjectId;
  cards: mongoose.Schema.Types.ObjectId[];
  buyDate: Date;
  boosterId: mongoose.Schema.Types.ObjectId;
}

const boosterSchema = new mongoose.Schema<IBooster>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: "Card", required: true }],
  buyDate: { type: Date, required: true, default: Date.now },
  boosterId: { type: mongoose.Schema.Types.ObjectId, ref: "BoosterShopItem", required: true },
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

boosterSchema.virtual('booster', {
  ref: "BoosterShopItem",
  localField: 'boosterId',
  foreignField: '_id',
  justOne: true,
})

const Booster = mongoose.model<IBooster>("Booster", boosterSchema);

export default Booster;