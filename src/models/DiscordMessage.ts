import mongoose, { Document } from "mongoose";

export type DiscordMessageDirection = 'inbound' | 'outbound';
export type DiscordMessageTargetType = 'channel' | 'dm';
export type DiscordMessageKind = 'text' | 'embed';

export interface IDiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface IDiscordEmbedPayload {
  title?: string;
  description?: string;
  color?: string;
  imageUrl?: string;
  fields?: IDiscordEmbedField[];
  footer?: string;
}

export interface IDiscordMessage extends Document {
  direction: DiscordMessageDirection;
  targetType: DiscordMessageTargetType;
  messageType: DiscordMessageKind;
  discordUserId?: string;
  discordChannelId?: string;
  content?: string;
  embed?: IDiscordEmbedPayload;
  raw?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DiscordMessageSchema = new mongoose.Schema<IDiscordMessage>({
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  targetType: { type: String, enum: ['channel', 'dm'], required: true },
  messageType: { type: String, enum: ['text', 'embed'], required: true },
  discordUserId: { type: String },
  discordChannelId: { type: String },
  content: { type: String },
  embed: {
    title: { type: String },
    description: { type: String },
    color: { type: String },
    imageUrl: { type: String },
    footer: { type: String },
    fields: [{
      name: { type: String, required: true },
      value: { type: String, required: true },
      inline: { type: Boolean, default: false }
    }]
  },
  raw: { type: Object },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

DiscordMessageSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model<IDiscordMessage>('DiscordMessage', DiscordMessageSchema);

