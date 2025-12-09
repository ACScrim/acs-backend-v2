import mongoose from "mongoose";

export interface IAcsdleUser {
  id: string;
  username: string;
  createdAt: Date;
  tournamentsPlayed: number;
  victories: number;
  top25Finishes: number;
  mostGamePlayed: string;
}

export interface IAcsdle extends mongoose.Document {
  userId: mongoose.Schema.Types.ObjectId; // Joueur du jour à deviner,
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  completions: {
    userId: mongoose.Schema.Types.ObjectId;
    attempts: IAcsdleUser[];
    won: boolean;
    completedAt?: Date;
  }[];
}

const AcsdleSchema = new mongoose.Schema<IAcsdle>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true, unique: true },
  completions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    attempts: [{
      id: String,
      username: String,
      createdAt: Date,
      tournamentsPlayed: Number,
      victories: Number,
      top25Finishes: Number,
      mostGamePlayed: String
    }],
    won: { type: Boolean, required: true },
    completedAt: { type: Date, required: true, default: new Date() },
  }]
}, {
  timestamps: true
});

const AcsdleModel = mongoose.model<IAcsdle>('Acsdle', AcsdleSchema);
export default AcsdleModel;