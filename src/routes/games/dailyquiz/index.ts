import {FastifyPluginAsync} from "fastify";
import {IQuizQuestion} from "../../../models/QuizQuestion";
import {authGuard} from "../../../middleware/authGuard";
import {IQuizAnswer} from "../../../models/QuizAnswer";
import { log } from "../../../utils/utils";

const dailyquizRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/today", { preHandler: [authGuard] }, async (req, resp) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let selectFields = 'question category dailyQuizDate options image';

    const existingQuestion = await fastify.models.QuizQuestion.findOne({ dailyQuizDate: { $gte: today } }).select(selectFields) as IQuizQuestion;
    if (existingQuestion) {
      return existingQuestion;
    }
    const availableQuestions = await fastify.models.QuizQuestion.find({ $or: [{ dailyQuizDate: { $exists: false } }, { dailyQuizDate: null }] }).select(selectFields) as IQuizQuestion[];
    if (availableQuestions.length === 0) {
      log(fastify, "Aucune question disponible pour le quiz quotidien", 'error', 404);
      return resp.status(404).send({ message: "Aucune question disponible pour le quiz quotidien." });
    }

    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const selectedQuestion = availableQuestions[randomIndex];

    selectedQuestion.dailyQuizDate = new Date();
    await selectedQuestion.save();

    return selectedQuestion;
  });

  fastify.get("/yesterday", { preHandler: [authGuard] }, async (req, resp) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const question = await fastify.models.QuizQuestion.findOne({ dailyQuizDate: { $gte: yesterday, $lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000) } }) as IQuizQuestion;
    if (!question) {
      return null;
    }

    const answer = await fastify.models.QuizAnswer.findOne({ userId: req.session.userId, questionId: question._id }) as IQuizAnswer;
    if (answer) {
      (question as any)._doc.userAnswer = answer;
    }

    return question;
  });

  fastify.get("/today-answer", { preHandler: [authGuard] }, async (req, resp) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const answer = await fastify.models.QuizAnswer.findOne({ userId: req.session.userId, discoveredAt: { $gte: today } }) as IQuizAnswer;
    if (!answer) {
      return null;
    }

    return answer;
  });

  // Return the weekly leaderboard from monday to sunday
  fastify.get("/weekly-leaderboard", { preHandler: [authGuard] }, async (req, resp) => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)
    const diffToMonday = (dayOfWeek + 6) % 7; // Days since last Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);

    const leaderboard = await fastify.models.QuizAnswer.aggregate([
      {
        $match: {
          answeredAt: { $gte: monday, $lt: sunday },
          points: { $exists: true }
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
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          username: "$user.username",
          avatarUrl: "$user.avatarUrl",
          totalPoints: 1
        }
      }
    ]);

    return leaderboard;
  });

  fastify.patch("/answer/:questionId", { preHandler: [authGuard] }, async (req, resp) => {
    const { questionId } = req.params as { questionId: string };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const question = await fastify.models.QuizQuestion.findById(questionId) as IQuizQuestion;
    if (!question) {
      log(fastify, `Question de quiz quotidienne introuvable pour l'identifiant ${questionId}`, 'error', 404);
      return resp.status(404).send({ message: "Question introuvable pour ce quiz quotidien." });
    }

    let answer = await fastify.models.QuizAnswer.findOne({ userId: req.session.userId, discoveredAt: { $gte: today } }) as IQuizAnswer;
    if (!answer) {
      answer = new fastify.models.QuizAnswer({});
    }
    const { cheated, userAnswer, discoveredAt } = req.body as { cheated?: boolean, userAnswer?: string, discoveredAt?: string };

    if (cheated !== undefined) answer.cheated = cheated;
    if (userAnswer !== undefined) {
      answer.userAnswer = userAnswer;
      answer.answeredAt = new Date();
      if (req.session.userId) await fastify.scrimiumRewardService.giveReward(req.session.userId, 'dailyquiz', 'participation');
    }
    if (discoveredAt !== undefined) answer.discoveredAt = new Date(discoveredAt);

    answer.userId = req.session.userId as any;
    answer.questionId = questionId as any;

    await answer.save();

    return answer;
  });
}

export default  dailyquizRoutes;
