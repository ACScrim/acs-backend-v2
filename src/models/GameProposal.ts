import mongoose, { Document, Query, Schema } from "mongoose";

export interface IGameProposalVote extends Document {
  user: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGameProposal extends Document {
  name: string;
  description?: string;
  imageUrl?: string | null;
  rawgId?: number | null;
  proposedBy: Schema.Types.ObjectId;
  status: 'pending' | 'approved';
  votes: IGameProposalVote[];
  discordMessageId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  populateData(): Promise<IGameProposal>;
}

const GameProposalVoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

const gameProposalSchema = new mongoose.Schema<IGameProposal>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  imageUrl: { type: String, default: null },
  rawgId: { type: Number, default: null },
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  votes: [GameProposalVoteSchema],
  discordMessageId: { type: String, default: null },
}, { timestamps: true });

gameProposalSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

gameProposalSchema.methods.populateData = async function() {
  await this.populate('votes.user', 'username avatarUrl');
  await this.populate('proposedBy', 'username');
  return this;
}

// @ts-ignore
gameProposalSchema.query.populateData = function(this: Query<any, IGameProposal>) {
  return this.populate('votes.user', 'username avatarUrl').populate('proposedBy', 'username');
}

export default mongoose.model<IGameProposal>('GameProposal', gameProposalSchema);