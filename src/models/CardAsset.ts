import mongoose from "mongoose";

export interface ICardAsset {
  name: string;
  category: 'background' | 'border';
  type: 'gradient' | 'solid' | 'image';
  color1?: string;
  color2?: string;
  angle?: number;
  solidColor?: string;
  imageBase64?: string;
  imageMimeType?: string;
  createdBy: mongoose.Schema.Types.ObjectId;
}

const cardAssetSchema = new mongoose.Schema<ICardAsset>(
  {
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['background', 'border'],
      required: true,
    },
    type: {
      type: String,
      enum: ['gradient', 'solid', 'image'],
      required: true,
    },
    color1: { type: String },
    color2: { type: String },
    angle: { type: Number },
    solidColor: { type: String },
    imageBase64: { type: String },
    imageMimeType: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

cardAssetSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const CardAsset = mongoose.model<ICardAsset>('CardAsset', cardAssetSchema);
export default CardAsset;

