import mongoose from "mongoose";

export interface ICardCollection extends mongoose.Document {
  id: string;
  userId: mongoose.Schema.Types.ObjectId;
  cards: {
    cardId: mongoose.Schema.Types.ObjectId;
    count: number;
  }[];
}

const cardCollectionSchema = new mongoose.Schema<ICardCollection>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  cards: [
    {
      cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
      count: { type: Number, required: true, default: 1 }
    }
  ],
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

const CardCollection = mongoose.model<ICardCollection>("CardCollection", cardCollectionSchema);

export default CardCollection;