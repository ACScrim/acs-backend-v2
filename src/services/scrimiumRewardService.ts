import {FastifyInstance} from "fastify";

class ScrimiumRewardService {
  readonly REWARDS = {
    // Daily Quiz
    dailyquiz: {
      participation: 50,
      weekly_winner: 250,
      weekly_second_place: 150,
      weekly_third_place: 100,
    },
    // Acsdle
    acsdle: {
      participation: 50,
      completion: 100
    },
    // Tournaments
    tournaments: {
      participation: 100,
      first_place: 250,
      top25: 150
    }
  }

  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  private getReward(activityType: keyof typeof this.REWARDS, rewardType: keyof typeof this.REWARDS.acsdle | keyof typeof this.REWARDS.tournaments | keyof typeof this.REWARDS.dailyquiz): number | null {
    const activityRewards = this.REWARDS[activityType];
    if (activityRewards && rewardType in activityRewards) {
      return activityRewards[rewardType as keyof typeof activityRewards];
    }
    return null;
  }

  private async ensureRewardNotAlreadyGiven(userId: string, activityType: keyof typeof this.REWARDS, rewardType: keyof typeof this.REWARDS.acsdle | keyof typeof this.REWARDS.tournaments | keyof typeof this.REWARDS.dailyquiz, date: Date): Promise<boolean> {
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

  async giveReward(userId: string, activityType: keyof typeof this.REWARDS, rewardType: keyof typeof this.REWARDS.acsdle | keyof typeof this.REWARDS.tournaments | keyof typeof this.REWARDS.dailyquiz): Promise<void> {
    const rewardPoints = this.getReward(activityType, rewardType);
    if (rewardPoints !== null && await this.ensureRewardNotAlreadyGiven(userId, activityType, rewardType, new Date())) {
      await this.fastify.models.Scrimium.updateOne({ userId }, {
        $inc: { balance: rewardPoints },
        $push: { transactions: { amount: rewardPoints, date: new Date(), description: `${activityType} | ${rewardType}` }}
      });
    }
  }
}

export default ScrimiumRewardService;