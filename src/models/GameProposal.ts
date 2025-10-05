import mongoose from "mongoose";

const GameProposalVoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  value: { type: Number, enum: [1, -1] }
}, { timestamps: true });

const gameProposalSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  imageUrl: { type: String, default: null },
  rawgId: { type: Number, default: null },
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  votes: [GameProposalVoteSchema],
  totalVotes: { type: Number, default: 0 }
}, { timestamps: true });

gameProposalSchema.pre('save', function(next) {
  this.totalVotes = (this.votes || []).reduce((s: number, v: any) => s + v.value, 0);
  next();
})

gameProposalSchema.methods.calculateTotalVotes = function() {
  this.totalVotes = this.votes.reduce((sum: number, vote: any) => sum + vote.value, 0);
  return this.totalVotes;
};

gameProposalSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('GameProposal', gameProposalSchema);