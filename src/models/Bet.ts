import mongoose from "mongoose";

export interface IBet extends mongoose.Document {
  tournamentId: mongoose.Schema.Types.ObjectId;
  userId: mongoose.Schema.Types.ObjectId;
  challongeMatchId: string;
  amount: number;
  predictedWinner: string;
  won: boolean;
  isProcessed: boolean;
}

const BetSchema = new mongoose.Schema<IBet>({
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  challongeMatchId: { type: String, required: true },
  amount: { type: Number, required: true },
  predictedWinner: { type: String, required: true },
  won: { type: Boolean, default: false },
  isProcessed: { type: Boolean, default: false }
}, {
  timestamps: true
});

BetSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Bet = mongoose.model<IBet>('Bet', BetSchema);
export default Bet;