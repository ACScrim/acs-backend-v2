import { SessionStore } from '@fastify/session';
import { MongoClient, Collection, Db } from 'mongodb';

interface SessionDocument {
  _id: string;
  session: string;
  expires: Date;
}

class MongoSessionStore implements SessionStore {
  private client: MongoClient;
  private db: Db;
  private collection!: Collection<SessionDocument>;
  private connectPromise: Promise<void>;

  constructor(mongoUrl: string, dbName: string) {
    this.client = new MongoClient(mongoUrl);
    this.db = this.client.db(dbName);
    this.connectPromise = this.init();
  }

  private async init(): Promise<void> {
    await this.client.connect();
    this.collection = this.db.collection<SessionDocument>('sessions');
    await this.collection.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
  }

  set(sessionId: string, session: any, callback: (err?: any) => void): void {
    this.connectPromise
      .then(async () => {
        const expires = session.cookie?.expires
          ? new Date(session.cookie.expires)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await this.collection.updateOne(
          { _id: sessionId },
          { $set: { session: JSON.stringify(session), expires } },
          { upsert: true }
        );
        callback();
      })
      .catch(callback);
  }

  get(sessionId: string, callback: (err: any, session?: any) => void): void {
    this.connectPromise
      .then(async () => {
        const doc = await this.collection.findOne({ _id: sessionId });
        if (!doc || !doc.session) {
          callback(null, null);
          return;
        }

        // Vérifier l'expiration
        if (doc.expires && new Date(doc.expires) < new Date()) {
          await this.collection.deleteOne({ _id: sessionId });
          callback(null, null);
          return;
        }

        try {
          const session = JSON.parse(doc.session);
          callback(null, session);
        } catch (parseErr) {
          // Session corrompue, la supprimer
          await this.collection.deleteOne({ _id: sessionId });
          callback(null, null);
        }
      })
      .catch(callback);
  }

  destroy(sessionId: string, callback: (err?: any) => void): void {
    this.connectPromise
      .then(async () => {
        await this.collection.deleteOne({ _id: sessionId });
        callback();
      })
      .catch(callback);
  }
}

export default MongoSessionStore;
