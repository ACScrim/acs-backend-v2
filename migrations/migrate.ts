import Badge from "@models/Badge";
import Game from "@models/Game";
import GameProposal from "@models/GameProposal";
import GameRole from "@models/GameRole";
import PlayerGameLevel from "@models/PlayerGameLevel";
import Season from "@models/Season";
import Tournament from "@models/Tournament";
import User from "@models/User";
import mongoose from "mongoose";
import { transformBadge } from "./transformers/badgeTransformer";
import { transformGame } from "./transformers/gameTransformer";
import { transformLevel } from "./transformers/levelTransformer";
import { transformProposal } from "./transformers/proposalTransformer";
import { transformSeason } from "./transformers/seasonTransformer";
import { transformTournament } from "./transformers/tournamentTransformer";
import { transformUser } from "./transformers/userTransformer";
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const oldDbUri = process.env.OLD_MONGODB_URI || 'mongodb://localhost:27017/acs';
const newDbUri = process.env.NEW_MONGODB_URI || 'mongodb://localhost:27017/acs-v2';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || '';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || '';


async function migrate() {
  const oldDb = mongoose.createConnection(oldDbUri);
  const newDb = mongoose.createConnection(newDbUri);

  await mongoose.connect(newDbUri);

  try {
    console.log('🚀 Début de la migration...\n');

    await oldDb.asPromise();
    await newDb.asPromise();

    console.log('🔗 Connecté aux bases de données.');

    // Collections anciennes
    const oldUsersCollection = oldDb.db!.collection('users');
    const oldPlayersCollection = oldDb.db!.collection('players');
    const oldBadgesCollection = oldDb.db!.collection('badges');
    const oldProposalsCollection = oldDb.db!.collection('gameproposals');
    const oldGamesCollection = oldDb.db!.collection('games');
    const oldPlayerGameLevelsCollection = oldDb.db!.collection('playergamelevels');
    const oldSeasonsCollection = oldDb.db!.collection('saisons');
    const oldTournamentsCollection = oldDb.db!.collection('tournaments');

    const oldUsers = await oldUsersCollection.find({}).toArray();
    const oldPlayers = await oldPlayersCollection.find({}).toArray();
    const oldBadges = await oldBadgesCollection.find({}).toArray();
    const oldProposals = await oldProposalsCollection.find({}).toArray();
    const oldGames = await oldGamesCollection.find({}).toArray();
    const oldPlayerGameLevels = await oldPlayerGameLevelsCollection.find({}).toArray();
    const oldSeasons = await oldSeasonsCollection.find({}).toArray();
    const oldTournaments = await oldTournamentsCollection.find({}).toArray();

    // Collections nouvelles
    const newUsersCollection = newDb.db!.collection('users');
    const newBadgesCollection = newDb.db!.collection('badges');
    const newProposalsCollection = newDb.db!.collection('gameproposals');
    const newGamesCollection = newDb.db!.collection('games');
    const newPlayerGameLevelsCollection = newDb.db!.collection('playergamelevels');
    const newSeasonsCollection = newDb.db!.collection('seasons');
    const newTournamentsCollection = newDb.db!.collection('tournaments');
    const newGameRolesCollection = newDb.db!.collection('gameroles');

    const mapPlayerIdToUserId: { [key: string]: string } = {};
    oldPlayers.forEach(player => {
      if (player.userId) {
        mapPlayerIdToUserId[player._id.toString()] = player.userId.toString();
      } else {
        console.log(`    ⚠️ Le joueur ${player._id} n'a pas d'userId associé.`);
        const newId = new mongoose.Types.ObjectId();
        mapPlayerIdToUserId[player._id.toString()] = newId.toString();
        oldUsers.push({
          _id: newId,
          username: player.username || `user_${player._id}`,
          email: `notdefined_${newId}@mail.com`,
          role: 'user',
          discordId: null,
          avatarUrl: null,
          profile: {}
        });
      }
    });

    if (await oldPlayersCollection.countDocuments() === await newUsersCollection.countDocuments()) {
      console.log('✅ Les utilisateurs ont déjà été migrés. Passage à l\'étape suivante.\n');
    } else {
      console.log('📝 Migration des utilisateurs...');
      const usersMerged = oldUsers.map(user => {
        const player = oldPlayers.find(p => p.userId?.toString() === user._id.toString());
        if (!player) return user;
        return { ...user, ...player };
      });
      console.log(`    Trouvé ${usersMerged.length} utilisateurs.`);
      for (const oldUser of oldUsers) {
        try {
          const response = await fetch(
            `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/members/${oldUser.discordId}`,
            { headers: { Authorization: `Bot ${DISCORD_TOKEN}` } }
          );
          const member = await response.json() as any;
          const newUserData = transformUser(oldUser, member.joined_at);
          await User.create(newUserData);
        } catch (error: any) {
          console.error(`    ❌ Erreur lors de la migration de l'utilisateur ${oldUser._id}: ${error.message}`);
        }
      }
    }

    if (await oldBadgesCollection.countDocuments() === await newBadgesCollection.countDocuments()) {
      console.log('✅ Les badges ont déjà été migrés. Passage à l\'étape suivante.\n');
    } else {
      console.log('📝 Migration des badges...');
      const badgesWithUsers = oldBadges.map(badge => {
        const users = [];
        for (const player of oldPlayers) {
          if (player.badges && player.badges.map((b: any) => b.toString()).includes(badge._id.toString())) {
            if (player.userId) users.push(player.userId);
          }
        }
        return { ...badge, users };
      });
      console.log(`    Trouvé ${badgesWithUsers.length} badges.`);
      for (const oldBadge of badgesWithUsers) {
        try {
          const newBadgeData = transformBadge(oldBadge);
          await Badge.create(newBadgeData);
        } catch (error: any) {
          console.error(`    ❌ Erreur lors de la migration du badge ${oldBadge._id}: ${error.message}`);
        }
      }
    }

    if (await oldGamesCollection.countDocuments() === await newGamesCollection.countDocuments()) {
      console.log('✅ Les jeux ont déjà été migrés. Passage à l\'étape suivante.\n');
    } else {
      console.log('📝 Migration des jeux...');
      for (const oldGame of oldGames) {
        try {
          const newGameData = transformGame(oldGame);
          await Game.create(newGameData);
        } catch (error: any) {
          console.error(`    ❌ Erreur lors de la migration du jeu ${oldGame._id}: ${error.message}`);
        }
      }
    }

    if (await oldProposalsCollection.countDocuments() === await newProposalsCollection.countDocuments()) {
      console.log('✅ Les propositions ont déjà été migrées. Passage à l\'étape suivante.\n');
    } else {
      console.log('📝 Migration des propositions...');
      for (const oldProposal of oldProposals) {
        try {
          const newGameProposalData = transformProposal(oldProposal);
          await GameProposal.create(newGameProposalData);
        } catch (error: any) {
          console.error(`    ❌ Erreur lors de la migration de la proposition ${oldProposal._id}: ${error.message}`);
        }
      }
    }

    console.log('📝 Migration des roles...');
    const gameRoles: { _id: string, gameId: string, users: string[] }[] = [];
    for (const oldUser of oldUsers) {
      try {
        if (!oldUser.profile?.gameRoles) continue;
        for (const roleEntry of oldUser.profile.gameRoles) {
          const existingRole = gameRoles.find(gr => gr.gameId.toString() === roleEntry.gameId.toString());
          if (existingRole) {
            if (oldUser._id && !existingRole.users.includes(oldUser._id.toString())) {
              existingRole.users.push(oldUser._id.toString());
            }
          } else {
            gameRoles.push({ _id: roleEntry.gameId.toString(), gameId: roleEntry.gameId.toString(), users: [oldUser._id.toString()] });
          }
        }
      } catch (error: any) {
        console.error(`    ❌ Erreur lors de la migration des roles de l'utilisateur ${oldUser._id}: ${error.message}`);
      }
    }
    if (gameRoles.length === await newGameRolesCollection.countDocuments()) {
      console.log('✅ Les roles de jeu ont déjà été migrés. Passage à l\'étape suivante.\n');
    } else {
      try {
        console.log(`    Trouvé ${gameRoles.length} rôles de jeu.`);
        await GameRole.create(gameRoles);
      } catch (error: any) {
        console.error(`    ❌ Erreur lors de la migration des roles : ${error.message}`);
      }
    }

    if (await oldPlayerGameLevelsCollection.countDocuments() === await newPlayerGameLevelsCollection.countDocuments()) {
      console.log('✅ Les levels ont déjà été migrés. Passage à l\'étape suivante.\n');
    } else {
      console.log('📝 Migration des levels...');
      for (const oldLevel of oldPlayerGameLevels) {
        try {
          const newLevelData = transformLevel(oldLevel, mapPlayerIdToUserId);
          await PlayerGameLevel.create(newLevelData);
        } catch (error: any) {
          console.error(`    ❌ Erreur lors de la migration du level ${oldLevel._id}: ${error.message}`);
        }
      }
    }

    if (await oldSeasonsCollection.countDocuments() === await newSeasonsCollection.countDocuments()) {
      console.log('✅ Les saisons ont déjà été migrées. Passage à l\'étape suivante.\n');
    } else {
      console.log('📝 Migration des saisons...');
      for (const oldSeason of oldSeasons) {
        try {
          const newSeason = transformSeason(oldSeason);
          await Season.create(newSeason);
        } catch (error: any) {
          console.error(`    ❌ Erreur lors de la migration de la saison ${oldSeason._id}: ${error.message}`);
        }
      }
    }

    if (await oldTournamentsCollection.countDocuments() === await newTournamentsCollection.countDocuments()) {
      console.log('✅ Les tournois ont déjà été migrés. Passage à l\'étape suivante.\n');
    } else {
      console.log('📝 Migration des tournois...');
      for (const oldTournament of oldTournaments) {
        try {
          const newTournament = transformTournament(oldTournament, mapPlayerIdToUserId);
          await Tournament.create(newTournament);
        } catch (error: any) {
          console.error(`    ❌ Erreur lors de la migration du tournoi ${oldTournament._id}: ${error.message}`);
        }
      }
    }

  } catch (error: any) {
    console.error(`    ❌ Erreur lors de la migration: ${error.message}`);
    throw error;
  } finally {
    await oldDb.close();
    await newDb.close();
    console.log('\n✅ Migration terminée.');
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });