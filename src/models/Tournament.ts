import mongoose, { Document, Schema } from "mongoose";

export interface ITournamentPlayer extends Document {
  user: Schema.Types.ObjectId;
  inWaitlist: boolean;
  registrationDate: Date;
  hasCheckin: boolean;
  isCaster: boolean;
  isMvp: boolean;
  tier?: string;
  description?: string;
  mvpVotes: Schema.Types.ObjectId[];
}

export interface ITeam extends Document {
  name: string;
  users: Schema.Types.ObjectId[];
  score: number;
  ranking: number;
}

export interface IClip extends Document {
  url: string;
  addedBy?: Schema.Types.ObjectId;
  addedAt: Date;
}

export interface ITournament extends Document {
  name: string;
  gameId: Schema.Types.ObjectId;
  date: Date;
  discordChannelName: string;
  players: ITournamentPlayer[];
  playerCap: number;
  teamsPublished: boolean;
  finished: boolean;
  description?: string;
  discordReminderDate?: Date;
  privateReminderDate?: Date;
  reminderSent: boolean;
  reminderSentPlayers: boolean;
  messageId?: string | null;
  mvpVoteOpen: boolean;
  teams: ITeam[];
  clips: IClip[];
  createdAt: Date;
  updatedAt: Date;
}

const TournamentPlayerSchema = new mongoose.Schema<ITournamentPlayer>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inWaitlist: { type: Boolean, default: false },
  registrationDate: { type: Date, default: Date.now },
  hasCheckin: { type: Boolean, default: false },
  isCaster: { type: Boolean, default: false },
  isMvp: { type: Boolean, default: false },
  tier: { type: String, default: null },
  description: { type: String, default: null },
  mvpVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const TeamSchema = new mongoose.Schema<ITeam>({
  name: { type: String, required: true, trim: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  score: { type: Number, default: 0 },
  ranking: { type: Number, default: 0 }
});

const ClipSchema = new mongoose.Schema<IClip>({
  url: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  addedAt: { type: Date, default: Date.now }
});

const tournamentSchema = new mongoose.Schema<ITournament>({
  name: { type: String, required: true, trim: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  date: { type: Date, required: true },
  discordChannelName: { type: String, trim: true, required: true },
  players: [TournamentPlayerSchema],
  playerCap: { type: Number, required: true },
  teamsPublished: { type: Boolean, default: false },
  finished: { type: Boolean, default: false },
  description: { type: String, trim: true },
  discordReminderDate: { type: Date },
  privateReminderDate: { type: Date },
  reminderSent: { type: Boolean, default: false },
  reminderSentPlayers: { type: Boolean, default: false },
  messageId: { type: String, default: null },
  mvpVoteOpen: { type: Boolean, default: true },
  teams: [TeamSchema],
  clips: [ClipSchema]
}, { timestamps: true });

TournamentPlayerSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

tournamentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

tournamentSchema.virtual('game', {
  ref: 'Game',
  localField: 'gameId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'id name imageUrl' }
})

export default mongoose.model<ITournament>('Tournament', tournamentSchema);