import * as dotenv from 'dotenv';
import {IUser} from "../src/models/User";
import mongoose from "mongoose";
import {ITournament} from "../src/models/Tournament";

dotenv.config({ path: '.env' });

const dbUri = process.env.NEW_MONGODB_URI || 'mongodb://localhost:27017/acs-v2';
const db = mongoose.createConnection(dbUri);

const fetchImageAsBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';

  return { base64, mimeType };
};

const createCardPayload = async (user: IUser) => {

  const joinDate = user.createdAt ? new Date(user.createdAt) : new Date();
  const formattedJoinDate = `${joinDate.getDate().toString().padStart(2, '0')}/${(joinDate.getMonth() + 1).toString().padStart(2, '0')}/${joinDate.getFullYear()}`;

  const { base64: imageBase64, mimeType: imageMimeType } = user.avatarUrl
    ? await fetchImageAsBase64(user.avatarUrl)
    : { base64: '', mimeType: 'image/webp' };

  if (!imageBase64 || imageBase64.length === 0) {
    throw new Error(`User ${user.username} does not have a valid avatar URL.`);
  }

  const userTournaments = await db.db!.collection('tournaments').find({ 'players.user': user._id, 'finished': true }).toArray() as ITournament[];
  const victories = userTournaments.filter(t => {
    const team = t.teams.find(team => team.users.some(u => u.toString() === (user._id as any).toString()));
    return team && team.ranking === 1;
  });

  return ({
    title: user.username,
    imageBase64,
    imageMimeType,
    frontAssetId: new mongoose.Types.ObjectId("695db3eabd92f87757877928"),
    categoryId: new mongoose.Types.ObjectId("6957eb47cd0cfd4a74cbcc06"),
    titlePosX: 50,
    titlePosY: 8,
    titleAlign: "center",
    titleWidth: "w-auto",
    titleFontSize: 18,
    removeImageBg: false, holographicEffect: false,
    holographicIntensity: 0.2,
    titleColor: "#ffffff",
    imagePosX: 50,
    imagePosY: 38,
    imageScale: 0.7,
    imageWidth: 160,
    imageHeight: 160,
    imageObjectFit: "cover",
    rarity: "common",
    customTexts: [
      {
        content: `Membre depuis le ${formattedJoinDate}`,
        posX: 54,
        posY: 65,
        align: "left",
        color: "#ffffff",
        width: "w-full",
        fontSize: 15
      },
      {
        content: `${userTournaments.length} tournois joués`,
        posX: 54,
        posY: 73,
        align: "left",
        color: "#ffffff",
        width: "w-full",
        fontSize: 15
      },
      {
        content: `${victories.length} victoires`,
        posX: 54,
        posY: 81,
        align: "left",
        color: "#ffffff",
        width: "w-full",
        fontSize: 15
      }
    ]
  })
}

const startCreations = async () => {
  try {
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB');

    const UserModel = mongoose.model<IUser>('User', new mongoose.Schema({}, { strict: false }));

    const users = await UserModel.find({ isDefaultCardCreated: { $ne: true } }).exec();
    console.log(`Found ${users.length} users without default card.`);

    for (const user of users) {
      try {
        const cardPayload = await createCardPayload(user);
        console.log(`Creating default card for user: ${user.username}`);

        await mongoose.connection.db!.collection('cards').insertOne({
          ...cardPayload,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: new mongoose.Types.ObjectId('67dc214e5e31992fcc4f7da8'),
          status: 'active'
        });

        await UserModel.updateOne({ _id: user._id }, { $set: { isDefaultCardCreated: true } }).exec();

        console.log(`Default card created for user: ${user.username}`);
      } catch (err) {
        console.error(`Error creating card for user ${user.username}:`, err);
      }
    }

    console.log('Default card creation process completed.');
    process.exit(0);
  }
  catch (err) {
    console.error('Error connecting to MongoDB or during processing:', err);
    process.exit(1);
  }
}
startCreations();