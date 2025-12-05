import mongoose from "mongoose";

export interface IScrimium extends mongoose.Document {
  userId: string;
  balance: number;
  transactions: Array<{
    amount: number;
    date: Date;
    description: string;
  }>;
}

const scrimiumSchema = new mongoose.Schema<IScrimium>({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, required: true, default: 0 },
  transactions: [
    {
      amount: { type: Number, required: true },
      date: { type: Date, required: true, default: Date.now },
      description: { type: String, required: true },
    },
  ],
});

scrimiumSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

scrimiumSchema.virtual('user', {
  ref: "User",
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
})

scrimiumSchema.statics.findOrCreateByUserId = async function(userId: string) {
  let scrimium = await this.findOne({ userId }).select('-id -_id -userId');
  if (!scrimium) {
    scrimium = await this.create({ userId, balance: 0, transactions: [] });
  }
  return scrimium;
};

const Scrimium = mongoose.model<IScrimium>("Scrimium", scrimiumSchema);

export default Scrimium;