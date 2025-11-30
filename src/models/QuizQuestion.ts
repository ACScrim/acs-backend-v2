import mongoose, { Document } from "mongoose";

export interface IQuizQuestion extends Document  {
  category: string;
  question: string;
  options: string[];
  correctAnswer: string;
  anecdote?: string;
  dailyQuizDate?: Date;
}

const quizQuestionSchema = new mongoose.Schema<IQuizQuestion>({
  category: { type: String, required: true },
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },
  anecdote: { type: String },
  dailyQuizDate: { type: Date, unique: true, sparse: true }
}, { timestamps: true });

quizQuestionSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<IQuizQuestion>("QuizQuestion", quizQuestionSchema);

