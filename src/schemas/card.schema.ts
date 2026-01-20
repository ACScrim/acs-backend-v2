/**
 * Schémas de validation pour les routes cartes
 */

export const createCardSchema = {
  body: {
    type: 'object',
    required: ['name', 'categoryId'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      categoryId: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{24}$' // MongoDB ObjectId pattern
      },
      imageBase64: {
        type: 'string',
        // Limite à environ 6MB en base64
        // Base64 augmente la taille de ~33% (4/3): 6MB * 1.33 ≈ 8MB base64
        maxLength: 8 * 1024 * 1024
      },
      imageMimeType: {
        type: 'string',
        enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      },
      imageUrl: {
        type: 'string',
        format: 'uri'
      },
      rarity: {
        type: 'string',
        enum: ['common', 'rare', 'epic', 'legendary']
      }
    }
  }
};

export const updateCardSchema = {
  body: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      categoryId: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{24}$'
      },
      imageBase64: {
        type: 'string',
        // Limite à environ 6MB en base64
        // Base64 augmente la taille de ~33% (4/3): 6MB * 1.33 ≈ 8MB base64
        maxLength: 8 * 1024 * 1024
      },
      imageMimeType: {
        type: 'string',
        enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      },
      imageUrl: {
        type: 'string',
        format: 'uri'
      },
      rarity: {
        type: 'string',
        enum: ['common', 'rare', 'epic', 'legendary']
      }
    }
  },
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        pattern: '^[0-9a-fA-F]{24}$'
      }
    }
  }
};
