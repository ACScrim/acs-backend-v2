import mongoose from "mongoose";

export interface CardCollection extends mongoose.Document {
  id: string;
  userId: mongoose.Schema.Types.ObjectId;
  cards: mongoose.Schema.Types.ObjectId[];
}

const cardCollectionSchema = new mongoose.Schema<CardCollection>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  cards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Card' }],
});

cardCollectionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

cardCollectionSchema.virtual('user', {
  ref: "User",
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

const CardCollection = mongoose.model<CardCollection>("CardCollection", cardCollectionSchema);

export default CardCollection;