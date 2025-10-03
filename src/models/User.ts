import mongoose from "mongoose";

  const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    role: { type: String, enum: ['superadmin', 'admin', 'user'], default: 'user' },
    discordId: { type: String },
    avatarUrl: { type: String },
    twitchUsername: { type: String },
    twitchSubscriptionId: { type: String }
  });
  export default mongoose.model('User', UserSchema);