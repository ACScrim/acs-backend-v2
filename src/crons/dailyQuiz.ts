import {FastifyInstance} from "fastify";

export const startDailyQuizCron = async (fastify: FastifyInstance) => {
  fastify.cron.schedule('0 0 * * *', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const answersToProcess = await fastify.models.QuizAnswer.find({ processed: { $ne: true }, answeredAt: { $lte: today } });
    for (const answer of answersToProcess) {
      const question = await fastify.models.QuizQuestion.findById(answer.questionId);
      if (!question) {
        fastify.log.error({ answerId: answer._id }, 'Question not found for quiz answer processing');
        continue;
      }

      if (answer.userAnswer === question.correctAnswer) {
        let points = 10;
        if (answer.cheated) points -= 5;
        answer.points = Math.max(points, 0);
        answer.isCorrect = true;
      } else {
        answer.points = 0;
      }

      // Time bonus point
      if (answer.answeredAt && answer.discoveredAt) {
        const timeDiff = (answer.answeredAt.getTime() - answer.discoveredAt.getTime()) / 1000; // in seconds
        if (timeDiff <= 30) {
          answer.points += 5;
        } else if (timeDiff <= 60) {
          answer.points += 3;
        } else if (timeDiff <= 120) {
          answer.points += 1;
        }
      }

      answer.processed = true;
      await answer.save();
    }
  });

  //TODO: Cron pour la gestion des récompenses hebdomadaires
}