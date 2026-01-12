import { SessionStore } from '@fastify/session';
import { MongoClient } from 'mongodb';

class MongoSessionStore implements SessionStore {
  private client: MongoClient;
  private collection: any;

  constructor(mongoUrl: string, dbName: string) {
    this.client = new MongoClient(mongoUrl);
    this.collection = this.client.db(dbName).collection('sessions');
  }

  async set(sessionId: string, session: any, callback: (err?: any) => void) {
    try {
      await this.collection.updateOne(
        { _id: sessionId },
        { $set: { session, expires: session.cookie.expires } },
        { upsert: true }
      );
      callback();
    } catch (err) {
      callback(err);
    }
  }

  async get(sessionId: string, callback: (err: any, session?: any) => void) {
    try {
      const doc = await this.collection.findOne({ _id: sessionId });
      callback(null, doc?.session || null);
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sessionId: string, callback: (err?: any) => void) {
    try {
      await this.collection.deleteOne({ _id: sessionId });
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

export default MongoSessionStore;