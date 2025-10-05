import mongoose from "mongoose";

const playerGameLevelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  level: { type: String, enum: ['débutant', 'intermédiaire', 'avancé', 'expert'], required: true },
  gameUsername: { type: String, required: true, trim: true },
  isRanked: { type: Boolean, default: false },
  rank: { type: String, trim: true },
  selectedRoles: [{ type: String, trim: true }],
  comment: { type: String, trim: true }
}, { timestamps: true });

playerGameLevelSchema.index({ userId: 1, gameId: 1 }, { unique: true });

playerGameLevelSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('PlayerGameLevel', playerGameLevelSchema);