import mongoose from "mongoose";

const GameProposalVoteSchema = new mongoose.Schema({
  player: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  value: { type: Number, enum: [1, -1] },
  createdAt: { type: Date, default: Date.now }
});

const gameProposalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  imageUrl: { type: String, default: null },
  rawgId: { type: Number, default: null },
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  votes: [GameProposalVoteSchema],
  totalVotes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

gameProposalSchema.methods.calculateTotalVotes = function() {
  this.totalVotes = this.votes.reduce((sum: number, vote: any) => sum + vote.value, 0);
  return this.totalVotes;
};

export default mongoose.model('GameProposal', gameProposalSchema);