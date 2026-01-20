/**
 * Schémas de validation pour les routes utilisateurs
 */

export const updateUserRoleSchema = {
  body: {
    type: 'object',
    required: ['role'],
    properties: {
      role: {
        type: 'string',
        enum: ['superadmin', 'admin', 'user', 'user;card']
      }
    }
  },
  params: {
    type: 'object',
    required: ['userId'],
    properties: {
      userId: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{24}$' // MongoDB ObjectId pattern
      }
    }
  }
};

export const updateTwitchUsernameSchema = {
  body: {
    type: 'object',
    required: ['twitchUsername'],
    properties: {
      twitchUsername: {
        type: 'string',
        minLength: 0,
        maxLength: 25 // Twitch username max length
      }
    }
  }
};

export const getUserProfileSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{24}$' // MongoDB ObjectId pattern
      }
    }
  }
};
