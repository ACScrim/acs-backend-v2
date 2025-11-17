import mongoose, {Document} from "mongoose";

export interface IGameRole {
  name: string;
  color: string;
}

export interface IGame extends Document {
  name: string;
  description?: string;
  imageUrl: string;
  roles: IGameRole[];
  gameProfileLinkRegex?: string;
  gameUsernameRegex?: string;
  createdAt: Date;
  updatedAt: Date;
}

const gameSchema = new mongoose.Schema<IGame>({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String },
  imageUrl: { type: String, default: "" },
  roles: [
    {
      name: { type: String, required: true, trim: true },
      color: { type: String, default: "#6B7280" },
    },
  ],
  gameProfileLinkRegex: { type: String },
  gameUsernameRegex: { type: String },
}, { timestamps: true });

gameSchema.virtual('currentPlayerLevel', {
  ref: 'PlayerGameLevel',
  localField: '_id',
  foreignField: 'gameId',
  justOne: true,
  match: function(this: any) {
    return { userId: this._currentUserId };
  }
});

gameSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    
    // Retourne le niveau ou "débutant" par défaut
    ret.currentPlayerLevel = ret.currentPlayerLevel || null;
    return ret;
  }
});

export default mongoose.model<IGame>("Game", gameSchema);