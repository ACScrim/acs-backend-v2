import mongoose from "mongoose";

const BadgeSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  imageUrl: { type: String, required: true },
  description: { type: String },
  category: { type: String, enum: ['acs', 'game'], default: 'acs' },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: function () { return this.category === 'game' } },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});

BadgeSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Badge', BadgeSchema);