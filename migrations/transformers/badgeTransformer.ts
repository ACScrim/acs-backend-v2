export function transformBadge(oldBadge: any) {
  return {
    title: oldBadge.title,
    imageUrl: oldBadge.imageUrl,
    description: oldBadge.description,
    category: oldBadge.categoryType,
    gameId: oldBadge.categoryId,
    users: oldBadge.users || [],
    _id: oldBadge._id // Conserver l'ID original pour la migration
  };
}