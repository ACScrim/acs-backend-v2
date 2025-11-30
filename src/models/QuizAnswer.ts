import mongoose, { Document } from "mongoose";

export interface IQuizAnswer extends Document {
  questionId: mongoose.Schema.Types.ObjectId;
  userId: mongoose.Schema.Types.ObjectId;
  userAnswer?: string;
  isCorrect?: boolean;
  useHint?: boolean;
  cheated?: boolean;
  discoveredAt?: Date;
  answeredAt?: Date;
  points?: number;
  processed?: boolean;
}

const quizAnswerSchema = new mongoose.Schema<IQuizAnswer>({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuizQuestion', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userAnswer: { type: String },
  isCorrect: { type: Boolean },
  useHint: { type: Boolean },
  cheated: { type: Boolean },
  discoveredAt: { type: Date },
  answeredAt: { type: Date },
  points: { type: Number },
  processed: { type: Boolean, default: false }
}, { timestamps: true });

quizAnswerSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<IQuizAnswer>("QuizAnswer", quizAnswerSchema);