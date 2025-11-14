import mongoose, { Document, Schema } from "mongoose";

export interface IPlayerGameLevel extends Document {
  userId: Schema.Types.ObjectId;
  gameId: Schema.Types.ObjectId;
  level: 'débutant' | 'intermédiaire' | 'avancé' | 'expert';
  gameUsername: string;
  isRanked: boolean;
  rank?: string;
  selectedRoles: string[];
  comment?: string;
  gameProfileLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const playerGameLevelSchema = new mongoose.Schema<IPlayerGameLevel>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  level: { type: String, enum: ['débutant', 'intermédiaire', 'avancé', 'expert'], required: true },
  gameUsername: { type: String, required: true, trim: true },
  isRanked: { type: Boolean, default: false },
  rank: { type: String, trim: true },
  selectedRoles: [{ type: String, trim: true }],
  comment: { type: String, trim: true },
  gameProfileLink: { type: String, trim: true }
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

playerGameLevelSchema.virtual('game', {
  ref: 'Game',
  localField: 'gameId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'id name imageUrl gameProfileLinkRegex roles' }
});

playerGameLevelSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'id username email discordId avatarUrl' }
});

export default mongoose.model<IPlayerGameLevel>('PlayerGameLevel', playerGameLevelSchema);