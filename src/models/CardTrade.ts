import mongoose from "mongoose";

export interface ITradeProposal {
  _id?: mongoose.Types.ObjectId;
  proposedBy: mongoose.Schema.Types.ObjectId;
  proposedCards: {
    cardId: mongoose.Schema.Types.ObjectId;
    count: number;
  }[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface ICardTrade extends mongoose.Document {
  id: string;
  offeredBy: mongoose.Schema.Types.ObjectId;
  offeredCards: {
    cardId: mongoose.Schema.Types.ObjectId;
    count: number;
  }[];
  status: 'active' | 'completed' | 'cancelled';
  proposals: ITradeProposal[];
  createdAt: Date;
  updatedAt: Date;
}

const tradeProposalSchema = new mongoose.Schema({
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proposedCards: [
    {
      cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
      count: { type: Number, required: true, min: 1 }
    }
  ],
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const cardTradeSchema = new mongoose.Schema<ICardTrade>({
  offeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  offeredCards: [
    {
      cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Card', required: true },
      count: { type: Number, required: true, min: 1 }
    }
  ],
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  proposals: [tradeProposalSchema]
}, { timestamps: true });

cardTradeSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

cardTradeSchema.virtual('owner', {
  ref: "User",
  localField: 'offeredBy',
  foreignField: '_id',
  justOne: true,
});

const CardTrade = mongoose.model<ICardTrade>("CardTrade", cardTradeSchema);

export default CardTrade;
