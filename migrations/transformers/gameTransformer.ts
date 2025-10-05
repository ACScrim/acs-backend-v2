export function transformGame(oldGame: any) {
  return {
    name: oldGame.name,
    description: oldGame.description,
    imageUrl: oldGame.imageUrl || "",
    roles: oldGame.roles || [],
    _id: oldGame._id // Conserver l'ID original pour la migration
  }
}