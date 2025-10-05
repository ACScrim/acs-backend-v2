import mongoose from "mongoose";

const SeasonSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  tournaments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
})

SeasonSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Season', SeasonSchema);