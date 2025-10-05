export function transformLevel(oldLevel: any, mapPlayerIdToUserId: { [key: string]: string }): any {
  return {
    _id: oldLevel._id, // Conserver l'ID original pour la migration
    userId: mapPlayerIdToUserId[oldLevel.player.toString()] || null,
    gameId: oldLevel.game.toString(),
    level: oldLevel.level,
    gameUsername: oldLevel.gameUsername || 'Non défini',
    isRanked: oldLevel.isRanked || false,
    rank: oldLevel.rank || '',
    selectedRoles: oldLevel.selectedRoles || [],
    comment: oldLevel.comment || '',
    createdAt: oldLevel.createdAt,
    updatedAt: oldLevel.updatedAt
  }
}