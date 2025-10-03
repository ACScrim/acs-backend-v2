import 'fastify'
import type { Model } from 'mongoose'

declare module 'fastify' {
  interface FastifyInstance {
    models: {
      User: Model<any>
      // ajouter d'autres modèles ici
    }
  }
}