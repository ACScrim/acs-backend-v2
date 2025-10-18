
export function transformTournament(oldTournament: any, mapPlayerIdToUserId: { [key: string]: string }): any {
  return {
    _id: oldTournament._id, // Conserver l'ID original pour la migration
    name: oldTournament.name,
    gameId: oldTournament.game,
    date: oldTournament.date,
    discordChannelName: oldTournament.discordChannelName,
    players: oldTournament.players.map((player: any) => ({
      user: mapPlayerIdToUserId[player?.toString()],
      inWaitlist: oldTournament.waitlistPlayers ? oldTournament.waitlistPlayers.map((id: any) => id?.toString()).includes(player?.toString()) : false,
      registrationDate: oldTournament.registrationDates ? oldTournament.registrationDates[player?.toString()] || null : null,
      hasCheckin: oldTournament.checkIns ? oldTournament.checkIns[player?.toString()] || false : false,
      isCaster: oldTournament.casters ? oldTournament.casters.map((id: any) => id?.toString()).includes(player?.toString()) : false,
      isMvp: oldTournament.mvps ? oldTournament.mvps.find((vote: any) => vote.player?.toString() === player?.toString())?.isMvp || false : false,
      mvpVotes: oldTournament.mvps ? oldTournament.mvps.find((vote: any) => vote.player?.toString() === player?.toString())?.votes || [] : []
    })),
    playerCap: oldTournament.playerCap || 0,
    teamPublished: oldTournament.teamPublished || false,
    finished: oldTournament.finished || false,
    description: oldTournament.description || '',
    discordReminderDate: oldTournament.discordReminderDate || null,
    privateReminderDate: oldTournament.privateReminderDate || null,
    reminderSent: oldTournament.reminderSent || false,
    reminderSentPlayers: oldTournament.reminderSentPlayers || false,
    messageId: oldTournament.messageId || null,
    mvpVoteOpen: oldTournament.mvpVoteOpen !== undefined ? oldTournament.mvpVoteOpen : true,
    teams: oldTournament.teams ? oldTournament.teams.map((team: any) => ({
      name: team.name,
      users: team.players.map((playerId: any) => mapPlayerIdToUserId[playerId?.toString()]),
      score: team.score || 0,
      ranking: team.ranking || 0
    })) : [],
    clips: oldTournament.clips || []
  }
}