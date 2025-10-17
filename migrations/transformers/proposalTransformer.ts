export function transformProposal(oldProposal: any): any {
  return {
    _id: oldProposal._id, // Conserver l'ID original pour la migration
    name: oldProposal.name,
    description: oldProposal.description,
    imageUrl: oldProposal.imageUrl || null,
    rawgId: oldProposal.rawgId || null,
    proposedBy: oldProposal.proposedBy,
    status: oldProposal.status || 'pending',
    votes: oldProposal.votes ? oldProposal.votes.map((vote: any) => ({
      user: vote.player.toString() || null,
      _id: vote._id // Conserver l'ID original pour la migration
    })) : [],
    createdAt: oldProposal.createdAt || new Date(),
    updatedAt: oldProposal.updatedAt || new Date(),
  };
};