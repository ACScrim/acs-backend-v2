import mongoose from "mongoose";

export interface ICardCategory extends mongoose.Document {
  id: string;
  name: string;
  description?: string;
  createdBy: mongoose.Schema.Types.ObjectId;
}

const cardCategorySchema = new mongoose.Schema<ICardCategory>(
  {
    name: { type: String, required: true },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

cardCategorySchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

cardCategorySchema.virtual('creator', {
  ref: "User",
  localField: 'createdBy',
  foreignField: '_id',
  justOne: true,
});

const CardCategory = mongoose.model<ICardCategory>("CardCategory", cardCategorySchema);

export default CardCategory;

