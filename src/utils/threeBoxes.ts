import crypto from 'crypto';

const PERMS: number[][] = [
  [0, 50, 100],
  [0, 100, 50],
  [50, 0, 100],
  [50, 100, 0],
  [100, 0, 50],
  [100, 50, 0],
];

export function getPermutationFor(userId: string, dateString: string, salt?: string): number[] {
  const usedSalt = salt ?? process.env.THREEBOX_SALT ?? '';
  const h = crypto.createHash('sha256').update(`${userId}|${dateString}|${usedSalt}`).digest('hex');
  const idx = parseInt(h.slice(0, 8), 16) % PERMS.length;
  return PERMS[idx];
}

export function computeRewardFromPermutation(permutation: number[], chosenIndex: number): number {
  if (chosenIndex == null || chosenIndex < 0 || chosenIndex >= permutation.length) return 0;
  return permutation[chosenIndex];
}
