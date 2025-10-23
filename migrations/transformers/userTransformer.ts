export function transformUser(oldUser: any, createdAt?: string) {
  return {
    email: oldUser.email?.toLowerCase().trim(),
    username: oldUser.username || 'Anonymous',
    role: oldUser.role || 'user',
    discordId: oldUser.discordId,
    avatarUrl: oldUser.avatarUrl,
    twitchUsername: oldUser.profile?.twitchUsername || null,
    twitchSubscriptionId: oldUser.profile?.twitchSubscriptionId || null,
    // Garder le même _id si possible
    _id: oldUser._id,
    createdAt: createdAt ? new Date(createdAt) : new Date(),
    updatedAt: new Date()
  };
}