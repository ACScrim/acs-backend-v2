export function transformSeason(oldSeason: any) {
  return {
    _id: oldSeason._id, // Conserver l'ID original pour la migration
    number: oldSeason.numero,
    tournaments: oldSeason.tournois || [],
    winner: null
  }
}