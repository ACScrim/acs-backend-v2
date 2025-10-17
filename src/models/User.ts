import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  username: string;
  role: 'superadmin' | 'admin' | 'user';
  discordId?: string;
  avatarUrl?: string;
  twitchUsername?: string;
  twitchSubscriptionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, 'invalid email'] },
  username: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin', 'user'], default: 'user' },
  discordId: { type: String },
  avatarUrl: { type: String },
  twitchUsername: { type: String },
  twitchSubscriptionId: { type: String }
}, { timestamps: true });

UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<IUser>('User', UserSchema);