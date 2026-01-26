import { FastifyInstance } from "fastify";
import mongoose from 'mongoose';
import { log } from "../utils/utils";
import { getPermutationFor, computeRewardFromPermutation } from '../utils/threeBoxes';

class ThreeBoxesService {
  private fastify: FastifyInstance;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  private getTodayDateNormalized(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setMilliseconds(0);
    return today;
  }

  async getTodayChoice(userId: string) {
    const today = this.getTodayDateNormalized();
    const modelsAny = (this.fastify as any).models;

    // Ensure the day document exists (create if missing)
    try {
      await modelsAny.ThreeBoxesDay.findOneAndUpdate(
        { date: today },
        { $setOnInsert: { date: today } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).exec();
    } catch (e) {
      log(this.fastify, `Erreur lors de la création ThreeBoxesDay: ${e}`, 'error');
      // Pas bloquant pour la lecture
    }

    // Find user's choice subdocument
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const found = await modelsAny.ThreeBoxesDay.findOne({ date: today, 'choices.userId': userObjectId }, { 'choices.$': 1 }).lean();
    if (!found || !found.choices || found.choices.length === 0) return null;
    const choice = found.choices[0];
    // Normalize returned shape to previous API if needed
    return {
      choice: (choice.chosenIndex != null) ? (choice.chosenIndex + 1) : null,
      reward: choice.reward ?? null,
      permutation: choice.permutation,
      credited: choice.credited ?? false,
      date: today,
    };
  }

  async chooseBox(userId: string, choiceNumber: number) {
    const today = this.getTodayDateNormalized();

    // Validate choice
    if (![1,2,3].includes(choiceNumber)) {
      throw new Error('Choix invalide');
    }

    const modelsAny = (this.fastify as any).models;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Compute permutation deterministically and reward
    const perm = getPermutationFor(userId, today.toDateString());
    const chosenIndex = Math.max(0, Math.min(2, choiceNumber - 1));
    const reward = computeRewardFromPermutation(perm, chosenIndex);

    const userChoiceSubDoc = {
      userId: userObjectId,
      permutation: perm,
      chosenIndex,
      reward,
      credited: reward <= 0,
    } as any;

    // Try atomic upsert: create the day and push the choice only if user doesn't have one yet
    try {
      const filter = { date: today, 'choices.userId': { $ne: userObjectId } };
      const update = {
        $setOnInsert: { date: today },
        $push: { choices: userChoiceSubDoc }
      };
      const options = { upsert: true, new: true, setDefaultsOnInsert: true } as any;

      const doc = await modelsAny.ThreeBoxesDay.findOneAndUpdate(filter, update, options).exec();

      // If doc is null, fallback to find existing user's choice
      let userChoice: any | null = null;
      if (doc) {
        // Try to find the pushed/existing subdoc inside returned doc
        if (doc.choices && doc.choices.length) {
          // Search for userId match
          userChoice = doc.choices.find((c: any) => String(c.userId) === String(userObjectId));
        }
      }

      if (!userChoice) {
        // The user likely already had a choice; fetch it explicitly
        const existing = await modelsAny.ThreeBoxesDay.findOne({ date: today, 'choices.userId': userObjectId }, { 'choices.$': 1 }).lean();
        if (existing && existing.choices && existing.choices.length) userChoice = existing.choices[0];
      }

      if (!userChoice) {
        throw new Error('Impossible de créer ou récupérer la sélection.');
      }

      // If already chosen earlier (chosenIndex set) return existing
      if (userChoice.chosenIndex != null && userChoice.chosenIndex !== chosenIndex) {
        // Return existing without modifying
        return {
          choice: (userChoice.chosenIndex != null) ? (userChoice.chosenIndex + 1) : null,
          reward: userChoice.reward ?? null,
          permutation: userChoice.permutation,
          credited: userChoice.credited ?? false,
          date: today,
        };
      }

      // If reward > 0 and not credited, credit scrimiums
      if ((userChoice.reward as number) > 0 && !userChoice.credited) {
        try {
          await this.fastify.scrimiumRewardService.giveReward(userId, "threeboxes", userChoice.reward === 50 ? "reward_50" : "reward_100");

          // mark credited true on the specific subdocument
          await modelsAny.ThreeBoxesDay.updateOne({ date: today, 'choices.userId': userObjectId, 'choices.credited': false }, { $set: { 'choices.$.credited': true } });
        } catch (e) {
          log(this.fastify, `Erreur lors du crédit scrimiums pour user ${userId}: ${e}`, 'error');
        }
      }

      return {
        choice: (userChoice.chosenIndex != null) ? (userChoice.chosenIndex + 1) : null,
        reward: userChoice.reward ?? null,
        permutation: userChoice.permutation,
        credited: userChoice.credited ?? false,
        date: today,
      };
    } catch (e: any) {
      // Handle duplicate key error (race): fetch existing user's choice
      if (e && e.code === 11000) {
        const existing = await modelsAny.ThreeBoxesDay.findOne({ date: today, 'choices.userId': userObjectId }, { 'choices.$': 1 }).lean();
        if (existing && existing.choices && existing.choices.length) {
          const uc = existing.choices[0];
          return {
            choice: (uc.chosenIndex != null) ? (uc.chosenIndex + 1) : null,
            reward: uc.reward ?? null,
            permutation: uc.permutation,
            credited: uc.credited ?? false,
            date: today,
          };
        }
      }

      log(this.fastify, `Erreur three-boxes choose: ${e}`, 'error');
      throw e;
    }
  }
}

export default ThreeBoxesService;
