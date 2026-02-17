import {FastifyInstance} from "fastify";
import {fetchImageAsBase64, log} from "../utils/utils";
import mongoose from "mongoose";
import {IUser} from "../models/User";
import {ITournament} from "../models/Tournament";

const createCardPayload = async (user: IUser, fastify: FastifyInstance) => {
  const joinDate = user.createdAt ? new Date(user.createdAt) : new Date();
  const formattedJoinDate = `${joinDate.getDate().toString().padStart(2, '0')}/${(joinDate.getMonth() + 1).toString().padStart(2, '0')}/${joinDate.getFullYear()}`;

  const userTournaments = await fastify.models.Tournament.find({ 'players.user': user._id, 'finished': true }) as ITournament[];
  const victories = userTournaments.filter(t => {
    const team = t.teams.find(team => team.users.some(u => u.toString() === (user._id as any).toString()));
    return team && team.ranking === 1;
  });

  if (!user.avatarUrl) {
    throw new Error(`L'utilisateur ${user.username} n'a pas d'avatar valide.`);
  }

  return ({
    title: user.username,
    imageUrl: user.avatarUrl,
    frontAssetId: new mongoose.Types.ObjectId("695db3eabd92f87757877928"),
    categoryId: new mongoose.Types.ObjectId("6957eb47cd0cfd4a74cbcc06"),
    titlePosX: 50,
    titlePosY: 8,
    titleAlign: "center",
    titleWidth: "w-auto",
    titleFontSize: 18,
    removeImageBg: false, holographicEffect: false,
    holographicIntensity: 0.2,
    titleColor: "#ffffff",
    imagePosX: 50,
    imagePosY: 38,
    imageScale: 0.7,
    imageWidth: 160,
    imageHeight: 160,
    imageObjectFit: "cover",
    rarity: "common",
    customTexts: [
      {
        content: `Membre depuis le ${formattedJoinDate}`,
        posX: 54,
        posY: 65,
        align: "left",
        color: "#ffffff",
        width: "w-full",
        fontSize: 15
      },
      {
        content: `${userTournaments.length} tournois joués`,
        posX: 54,
        posY: 73,
        align: "left",
        color: "#ffffff",
        width: "w-full",
        fontSize: 15
      },
      {
        content: `${victories.length} victoires`,
        posX: 54,
        posY: 81,
        align: "left",
        color: "#ffffff",
        width: "w-full",
        fontSize: 15
      }
    ],
    status: 'active'
  })
}

export const startUpdateAcsersCardCron = async (fastify: FastifyInstance) => {
  fastify.cron.schedule('0 1 * * 2', async () => {
    try {
      const users = await fastify.models.User.find({}).exec();
      const categoryObjectId = new mongoose.Types.ObjectId('6957eb47cd0cfd4a74cbcc06');
      const cards = await fastify.models.Card.find({ categoryId: categoryObjectId }).exec();

      const tournamentsPlayedByUser = await fastify.models.Tournament.aggregate([
        { $match: { finished: true } },
        { $unwind: "$players" },
        { $group: { _id: "$players.user", count: { $sum: 1 } } }
      ]);

      const userTournamentCountMap = tournamentsPlayedByUser.reduce((acc, curr) => {
        acc[curr._id.toString()] = curr.count;
        return acc;
      }, {} as Record<string, number>);

      // Filter users who have played at least three tournament
      const filteredUsers = users.filter(user => userTournamentCountMap[user._id.toString()] && userTournamentCountMap[user._id.toString()] >= 3);

      for (const user of filteredUsers) {
        try {
          const cardPayload = await createCardPayload(user, fastify);

          const existingCard = cards.find(c => c.title === user.username);
          if (existingCard) {
            await fastify.models.Card.updateOne(
              { title: user.username },
              {
                $set: {
                  _id: existingCard._id,
                  ...cardPayload,
                  updatedAt: new Date(),
                }
              }
            );
          } else {
            await fastify.models.Card.create({
              ...cardPayload,
              categoryId: categoryObjectId,
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: new mongoose.Types.ObjectId('67dc214e5e31992fcc4f7da8'),
            });
            log(fastify, `Carte par défaut créée pour l'utilisateur : ${user.username}`, 'info');
          }
        } catch (error: any) {
          log(fastify, `Erreur lors de la création/mise à jour de la carte pour l'utilisateur ${user.username} : ` + error, 'error');
        }
      }
      log(fastify, "Cron updateAcsersCard exécuté avec succès.", 'info');
    } catch (error: any) {
      log(fastify, "Erreur lors de l'exécution du cron updateAcsersCard : " + error, 'error');
    }
  })
}