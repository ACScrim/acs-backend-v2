import { v2 as cloudinary } from 'cloudinary';
import {MongoClient} from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: '.env' });

// 1. Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'votre_cloud_name',
  api_key: process.env.CLOUDINARY_API_KEY || 'votre_cloud_api_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'votre_cloud_secret',
});

async function startMigration() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('acs-v2');
    const cards = database.collection('cards');
    const users = database.collection('users');
    const assets = database.collection('cardassets');

    // On cherche les cartes qui ont encore du base64 (le champ imageBase64 existe)
    const cursor = cards.find({ imageBase64: { $exists: true } });
    const assetCursor = assets.find({ imageBase64: { $exists: true } });

    console.log("Début de la migration...");

    for await (const card of cursor) {
      try {
        let url = "";
        // Si c'est la catégorie ACSERS, on récupère l'url discord avatar
        if (card.categoryId && card.categoryId.toString() === "6957eb47cd0cfd4a74cbcc06") {
          url = await (async () => {
            const user = await users.findOne({ username: card.title });
            return user?.avatarUrl.replace("size=64", "size=256") || "";
          })();
        }
        else {
          const fullBase64 = `data:${card.imageMimeType};base64,${card.imageBase64}`;
          // Upload vers Cloudinary
          const uploadRes = await cloudinary.uploader.upload(fullBase64, {
            folder: "acs/cards/main",
          });
          url = uploadRes.secure_url;
        }

        // Mise à jour du document dans MongoDB
        await cards.updateOne(
          { _id: card._id },
          {
            $set: { imageUrl: url },
            $unset: { imageBase64: 1, imageMimeType: 1 } // Optionnel: pour nettoyer
          }
        );

        console.log(`✅ Carte ${card._id} mise à jour.`);
      } catch (err: any) {
        console.error(`❌ Erreur sur la carte ${card._id}:`, err.message);
      }
    }

    for await (const asset of assetCursor) {
      try {
        let url = "";
        const fullBase64 = `data:${asset.imageMimeType};base64,${asset.imageBase64}`;
        // Upload vers Cloudinary
        const uploadRes = await cloudinary.uploader.upload(fullBase64, {
          folder: `acs/cards/assets/${asset.category}s`,
        });
        url = uploadRes.secure_url;

        // Mise à jour du document dans MongoDB
        await assets.updateOne(
          { _id: asset._id },
          {
            $set: { imageUrl: url },
            $unset: { imageBase64: 1, imageMimeType: 1 } // Optionnel: pour nettoyer
          }
        );

        console.log(`✅ Asset ${asset._id} mise à jour.`);
      } catch (err: any) {
        console.error(`❌ Erreur sur l'asset ${asset._id}:`, err.message);
      }
    }

    console.log("Migration terminée !");
  } finally {
    await client.close();
  }
}

startMigration();