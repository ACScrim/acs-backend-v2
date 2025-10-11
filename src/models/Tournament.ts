import mongoose from "mongoose";

const TournamentPlayerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inWaitlist: { type: Boolean, default: false },
  registrationDate: { type: Date, default: Date.now },
  hasCheckin: { type: Boolean, default: false },
  isCaster: { type: Boolean, default: false },
  isMvp: { type: Boolean, default: false },
  mvpVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  score: { type: Number, default: 0 },
  ranking: { type: Number, default: 0 }
});

const ClipSchema = new mongoose.Schema({
  url: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  addedAt: { type: Date, default: Date.now }
});

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  date: { type: Date, required: true },
  discordChannelName: { type: String, trim: true, required: true },
  players: [TournamentPlayerSchema],
  playerCap: { type: Number, required: true },
  teamPublished: { type: Boolean, default: false },
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
  justOne: true
})

export default mongoose.model('Tournament', tournamentSchema);