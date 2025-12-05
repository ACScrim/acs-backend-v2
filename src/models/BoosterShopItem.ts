import mongoose from "mongoose";

export interface IBoosterShopItem extends mongoose.Document {
  name: string;
  price: number;
  cardsCount: number;
  description: string;
  epicCardGuarantee: number;
  legendaryCardGuarantee: number;
}

const boosterShopItemSchema = new mongoose.Schema<IBoosterShopItem>({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  cardsCount: { type: Number, required: true },
  description: { type: String, required: true },
  epicCardGuarantee: { type: Number, required: true },
  legendaryCardGuarantee: { type: Number, required: true },
});

boosterShopItemSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const BoosterShopItem = mongoose.model<IBoosterShopItem>("BoosterShopItem", boosterShopItemSchema);

export default BoosterShopItem;

