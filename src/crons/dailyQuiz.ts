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

        answer.isCorrect = true;
      } else {
        answer.points = 0;
      }

      answer.processed = true;
      await answer.save();
    }
  });

  // Les lundis à 3h du matin 0 3 * * 1
  fastify.cron.schedule('0 3 * * 1', async () => {
    // Get last week's leaderboard from last monday to Sunday
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)
    const diffToLastMonday = (dayOfWeek + 6) % 7 + 7; // Days since last last Monday
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - diffToLastMonday);
    lastMonday.setHours(0, 0, 0, 0);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 7);

    const leaderboard = await fastify.models.QuizAnswer.aggregate([
      {
        $match: {
          answeredAt: { $gte: lastMonday, $lt: lastSunday },
          points: { $exists: true },
          processed: true
        }
      },
      {
        $group: {
          _id: "$userId",
          totalPoints: { $sum: "$points" }
        }
      },
      {
        $sort: { totalPoints: -1 }
      },
      {
        $limit: 3
      }
    ]);

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const userId = entry._id;
      if (i === 0) {
        await fastify.scrimiumRewardService.giveReward(userId, 'dailyquiz', 'weekly_winner');
      } else if (i === 1) {
        await fastify.scrimiumRewardService.giveReward(userId, 'dailyquiz', 'weekly_second_place');
      } else if (i === 2) {
        await fastify.scrimiumRewardService.giveReward(userId, 'dailyquiz', 'weekly_third_place');
      }
    }
  })
}