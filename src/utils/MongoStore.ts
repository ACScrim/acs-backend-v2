import { SessionStore } from '@fastify/session';
import { MongoClient, Collection, Db } from 'mongodb';

interface SessionDocument {
  _id: string;
  session: string; // JSON string, pas un objet
  expires: Date;
}

class MongoSessionStore implements SessionStore {
  private client: MongoClient;
  private db: Db;
  private collection!: Collection<SessionDocument>;
  private connected: boolean = false;

  constructor(mongoUrl: string, dbName: string) {
    this.client = new MongoClient(mongoUrl);
    this.db = this.client.db(dbName);
    this.init();
  }

  private async init() {
    await this.client.connect();
    this.collection = this.db.collection<SessionDocument>('sessions');
    await this.collection.createIndex({ expires: 1 }, { expireAfterSeconds: 0 });
    this.connected = true;
  }

  private async ensureConnected(): Promise<any> {
    if (!this.connected) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.ensureConnected();
    }
  }

  set(sessionId: string, session: any, callback: (err?: any) => void) {
    this.ensureConnected().then(async () => {
      try {
        const expires = session.cookie?.expires
          ? new Date(session.cookie.expires)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await this.collection.updateOne(
          { _id: sessionId },
          {
            $set: {
              session: JSON.stringify(session), // Stocker comme string JSON
              expires
            }
          },
          { upsert: true }
        );
        callback();
      } catch (err) {
        callback(err);
      }
    });
  }

  get(sessionId: string, callback: (err: any, session?: any) => void) {
    this.ensureConnected().then(async () => {
      try {
        const doc = await this.collection.findOne({ _id: sessionId });
        if (!doc) {
          callback(null, null);
          return;
        }
        // Parser le JSON string
        const session = typeof doc.session === 'string'
          ? JSON.parse(doc.session)
          : doc.session;
        callback(null, session);
      } catch (err) {
        callback(err);
      }
    });
  }

  destroy(sessionId: string, callback: (err?: any) => void) {
    this.ensureConnected().then(async () => {
      try {
        await this.collection.deleteOne({ _id: sessionId });
        callback();
      } catch (err) {
        callback(err);
      }
    });
  }
}

export default MongoSessionStore;
