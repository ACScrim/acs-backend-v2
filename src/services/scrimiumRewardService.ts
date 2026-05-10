import {FastifyInstance} from "fastify";

class ScrimiumRewardService {
  readonly REWARDS = {
    // Daily Quiz
    dailyquiz: {
      participation: 50,
      weekly_winner: 250,
      weekly_second_place: 150,
      weekly_third_place: 100,
      good_answer: 50
    },
    // Acsdle
    acsdle: {
      participation: 50,
      completion: 100
    },
    // Tournaments
    tournaments: {
      participation: 1000,
      first_place: 2000,
      top25: 1000
    },
    threeboxes: {
      reward_50: 50,
      reward_100: 100
    },
    dailygames: {
      completed: 100
    }
  }

  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  private getReward(activityType: keyof typeof this.REWARDS, rewardType: keyof typeof this.REWARDS.acsdle | keyof typeof this.REWARDS.tournaments | keyof typeof this.REWARDS.dailyquiz | keyof typeof this.REWARDS.threeboxes): number | null {
    const activityRewards = this.REWARDS[activityType];
    if (activityRewards && rewardType in activityRewards) {
      return activityRewards[rewardType as keyof typeof activityRewards];
    }
    return null;
  }

  private async ensureRewardNotAlreadyGiven(userId: string, activityType: keyof typeof this.REWARDS, rewardType: keyof typeof this.REWARDS.acsdle | keyof typeof this.REWARDS.tournaments | keyof typeof this.REWARDS.dailyquiz | keyof typeof this.REWARDS.threeboxes, date: Date): Promise<boolean> {
    const description = `${activityType} | ${rewardType}`;
    const exists = await this.fastify.models.Scrimium.exists({
      userId,
      transactions: {
        $elemMatch: {
          description,
          date: {
            $gte: new Date(date.setHours(0, 0, 0, 0)),
            $lt: new Date(date.setHours(23, 59, 59, 999))
          }
        }
      }
    });
    return !exists;
  }

  async giveReward(userId: string, activityType: keyof typeof this.REWARDS, rewardType: keyof typeof this.REWARDS.acsdle | keyof typeof this.REWARDS.tournaments | keyof typeof this.REWARDS.dailyquiz | keyof typeof this.REWARDS.threeboxes): Promise<void> {
    const rewardPoints = this.getReward(activityType, rewardType);
    if (rewardPoints !== null && await this.ensureRewardNotAlreadyGiven(userId, activityType, rewardType, new Date())) {
      await this.fastify.models.Scrimium.updateOne({ userId }, {
        $inc: { balance: rewardPoints },
        $push: { transactions: { amount: rewardPoints, date: new Date(), description: `${activityType} | ${rewardType}` }}
      });
    }

    // Check if user did all games today for dailygames reward
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const hasDailyQuiz = await this.fastify.models.Scrimium.exists({
      userId,
      transactions: {
        $elemMatch: {
          description: 'dailyquiz | participation',
          date: { $gte: startOfDay, $lt: endOfDay }
        }
      }
    });

    const hasAcsdle = await this.fastify.models.Scrimium.exists({
      userId,
      transactions: {
        $elemMatch: {
          description: 'acsdle | completion',
          date: { $gte: startOfDay, $lt: endOfDay }
        }
      }
    });

    const hasThreeboxes = await this.fastify.models.ThreeBoxesDay.exists({
      date: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
      },
      choices: {
        $elemMatch: {
          userId: userId
        }
      }
    });

    if (hasDailyQuiz && hasAcsdle && hasThreeboxes) {
      const rewardPoints2 = this.getReward('dailygames' as any, 'completed' as any);
      if (rewardPoints2 !== null && await this.ensureRewardNotAlreadyGiven(userId, 'dailygames' as any, 'completed' as any, new Date())) {
        await this.fastify.models.Scrimium.updateOne({ userId }, {
          $inc: { balance: rewardPoints2 },
          $push: { transactions: { amount: rewardPoints2, date: new Date(), description: 'dailygames | completed' } }
        });
      }
    }
  }
}

export default ScrimiumRewardService;