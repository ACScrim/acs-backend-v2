import mongoose, { Document, Schema } from "mongoose";

export interface IInactivePlayerListUser {
  userId: Schema.Types.ObjectId;
  username: string;
  discordId?: string;
  lastTournamentDate?: Date;
  messageSent: boolean;
}

export interface IInactivePlayerList extends Document {
  name: string;
  batchSize: number;
  users: IInactivePlayerListUser[];
  createdAt: Date;
  updatedAt: Date;
  status: 'pending' | 'sent' | 'archived';
  messageContent?: string;
  gameId?: Schema.Types.ObjectId;
}

const InactivePlayerListUserSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  discordId: { type: String },
  lastTournamentDate: { type: Date },
  messageSent: { type: Boolean, default: false }
}, { _id: false });

const InactivePlayerListSchema = new mongoose.Schema<IInactivePlayerList>({
  name: { type: String, required: true, trim: true },
  batchSize: { type: Number, required: true, default: 5 },
  users: [InactivePlayerListUserSchema],
  status: { type: String, enum: ['pending', 'sent', 'archived'], default: 'pending' },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
  messageContent: {
    type: String,
    trim: true,
    default: `Salut ! 👋

On a remarqué que ça fait un moment qu'on ne t'a pas vu sur nos tournois ACS. 😢

On espère que tout va bien de ton côté ! Si tu as un peu de temps, on serait ravis de te revoir participer à nos prochains événements. L'ambiance est toujours au rendez-vous et on a plein de nouveaux tournois en préparation ! 🎮

N'hésite pas si tu as des questions ou des suggestions.

À très bientôt sur le serveur ! 🚀

L'équipe ACS`
  }
}, { timestamps: true });

InactivePlayerListSchema.virtual('game', {
  ref: 'Game',
  localField: 'gameId',
  foreignField: '_id',
  justOne: true
});

InactivePlayerListSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // Garder game mais supprimer gameId du retour JSON pour éviter la duplication
    if (ret.gameId && ret.game) {
      delete ret.gameId;
    }
    return ret;
  }
});

export default mongoose.model<IInactivePlayerList>('InactivePlayerList', InactivePlayerListSchema);
