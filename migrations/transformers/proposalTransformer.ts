export function transformProposal(oldProposal: any, mapPlayerIdToUserId: { [key: string]: string }): any {
  return {
    _id: oldProposal._id, // Conserver l'ID original pour la migration
    name: oldProposal.name,
    description: oldProposal.description,
    imageUrl: oldProposal.imageUrl || null,
    rawgId: oldProposal.rawgId || null,
    proposedBy: oldProposal.proposedBy,
    status: oldProposal.status || 'pending',
    votes: oldProposal.votes ? oldProposal.votes.map((vote: any) => ({
      userId: mapPlayerIdToUserId[vote.player.toString()] || null,
      value: vote.value,
      _id: vote._id // Conserver l'ID original pour la migration
    })) : [],
    totalVotes: oldProposal.totalVotes || 0
  };
};