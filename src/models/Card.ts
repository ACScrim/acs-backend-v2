import mongoose, { Document } from "mongoose";

export interface ICard extends Document {
  title: string;
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  frontAssetId?: mongoose.Schema.Types.ObjectId;
  borderAssetId?: mongoose.Schema.Types.ObjectId;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  createdBy: mongoose.Schema.Types.ObjectId;
  status: 'pending' | 'waiting' | 'active' | 'inactive';
  // Personnalisation - Position du titre
  titlePosX?: number;
  titlePosY?: number;
  titleAlign?: 'left' | 'center' | 'right';
  titleWidth?: 'w-full' | 'w-auto';
  // Personnalisation - Effets
  removeImageBg?: boolean;
  holographicEffect?: boolean;
  holographicIntensity?: number;
  // Personnalisation - Couleurs du texte
  titleColor?: string;
  // Personnalisation - Position et échelle de l'image
  imagePosX?: number;
  imagePosY?: number;
  imageScale?: number;
  imageWidth?: number;
  imageHeight?: number;
  imageObjectFit?: 'contain' | 'cover';
  customTexts?: Array<{
    content: string;
    posX: number;
    posY: number;
    align: 'left' | 'center' | 'right';
    color: string;
    width: 'w-full' | 'w-auto';
  }>;
  previewCardB64?: string;
}

const cardSchema = new mongoose.Schema<ICard>(
  {
    title: { type: String, required: true },
    imageUrl: { type: String },
    imageBase64: { type: String },
    imageMimeType: { type: String },
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
      enum: ['pending', 'active', 'inactive', 'waiting'],
      default: 'pending',
    },
    // Personnalisation - Position du titre
    titlePosX: { type: Number, default: 50 },
    titlePosY: { type: Number, default: 10 },
    titleAlign: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    titleWidth: { type: String, enum: ['w-full', 'w-auto'], default: 'w-full' },
    // Personnalisation - Effets
    removeImageBg: { type: Boolean, default: false },
    holographicEffect: { type: Boolean, default: true },
    holographicIntensity: { type: Number, default: 0.6, min: 0, max: 1 },
    // Personnalisation - Couleurs du texte
    titleColor: { type: String, default: '#ffffff' },
    // Personnalisation - Position et échelle de l'image
    imagePosX: { type: Number, default: 50 },
    imagePosY: { type: Number, default: 30 },
    imageScale: { type: Number, default: 1, min: 0.5, max: 2 },
    imageWidth: { type: Number, default: 160, min: 40, max: 300 },
    imageHeight: { type: Number, default: 160, min: 40, max: 300 },
    imageObjectFit: { type: String, enum: ['contain', 'cover'], default: 'cover' },
    customTexts: [{
      content: String,
      posX: Number,
      posY: Number,
      align: { type: String, enum: ['left', 'center', 'right'] },
      color: String,
      width: { type: String, enum: ['w-full', 'w-auto'], default: 'w-full' },
      _id: false
    }],
    previewCardB64: { type: String },
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