import mongoose from "mongoose";

const SeasonSchema = new mongoose.Schema({
  number: { type: Number, required: true, unique: true },
  tournaments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' }],
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
})

export default mongoose.model('Season', SeasonSchema);