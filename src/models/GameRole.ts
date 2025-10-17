import mongoose, { Document, Schema } from "mongoose";

export interface IGameRole extends Document {
  gameId: Schema.Types.ObjectId;
  users: Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const GameRoleSchema = new mongoose.Schema<IGameRole>({
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

GameRoleSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<IGameRole>('GameRole', GameRoleSchema);