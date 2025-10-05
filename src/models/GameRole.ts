import mongoose from "mongoose";

const GameRoleSchema = new mongoose.Schema({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

GameRoleSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('GameRole', GameRoleSchema);