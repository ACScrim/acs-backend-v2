import mongoose from "mongoose";

export interface ICard {
  title: string;
  description: string;
  imageUrl: string;
  frontAssetId?: mongoose.Schema.Types.ObjectId;
  borderAssetId?: mongoose.Schema.Types.ObjectId;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  createdBy: mongoose.Schema.Types.ObjectId;
  status: 'pending' | 'active' | 'inactive';
}

const cardSchema = new mongoose.Schema<ICard>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    frontAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'CardAsset' },
    borderAssetId: { type: mongoose.Schema.Types.ObjectId, ref: 'CardAsset' },
    rarity: {
      type: String,
      enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
      default: 'common',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'inactive'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

cardSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

cardSchema.virtual('frontAsset', {
  ref: 'CardAsset',
  localField: 'frontAssetId',
  foreignField: '_id',
  justOne: true,
})

cardSchema.virtual('borderAsset', {
  ref: 'CardAsset',
  localField: 'borderAssetId',
  foreignField: '_id',
  justOne: true,
})

const Card = mongoose.model<ICard>('Card', cardSchema);
export default Card;