import mongoose from "mongoose";

export interface IAcsdleUser {
  id: string;
  username: string;
  firstTournament: { name: string, date:  Date } | null;
  tournamentsPlayed: number;
  victories: number;
  podiumCount: number;
  mostPlayedGames: string[];
}

export interface IAcsdleCompletion {
  userId: mongoose.Schema.Types.ObjectId;
  attempts: IAcsdleUser[];
  won: boolean;
  completedAt?: Date;
}

export interface IAcsdle extends mongoose.Document {
  userId: mongoose.Schema.Types.ObjectId; // Joueur du jour à deviner,
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  completions: IAcsdleCompletion[];
}

const AcsdleSchema = new mongoose.Schema<IAcsdle>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, unique: true },
  completions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attempts: [{
      id: String,
      username: String,
      firstTournament: { name: String, date: Date },
      tournamentsPlayed: Number,
      victories: Number,
      podiumCount: Number,
      mostPlayedGames: [{ type: String }]
    }],
    won: { type: Boolean, required: true },
    completedAt: { type: Date, required: true, default: new Date() },
  }]
}, {
  timestamps: true
});

const AcsdleModel = mongoose.model<IAcsdle>('Acsdle', AcsdleSchema);
export default AcsdleModel;