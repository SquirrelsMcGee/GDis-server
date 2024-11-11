import { Channel, Client, GatewayIntentBits, Guild, Message, TextChannel } from "discord.js";
import { ENV_CONFIG } from "../config";
import { Logger } from "../helpers/logger";
import { INamed } from "../lib/named-class";
import { ClientFunctions } from "./client-functions";


export type FileUploadData = {
  attachment: string;
  name: string;
  description?: string;
};

export class ClientManager implements INamed {
  public readonly name: string = 'ClientManager';

  public client: Client;

  private messageCache: Message[] = [];

  private readonly functions: ClientFunctions;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
      ],
    });

    this.client.on('messageCreate', async (message) => this.functions.onMessage(message));

    this.functions = new ClientFunctions(this.client, true);

    this.client.once("ready", (client) => {
      Logger.log(this.name, 'Discord bot is ready', client.user.username);
    });

    this.client.login(ENV_CONFIG.DISCORD_TOKEN);
  }

  public async getChannel<T extends Channel>(id: string, assertSendable: boolean = true): Promise<T | null> {
    const channel = await this.client.channels.fetch(id);

    if (channel && (assertSendable && !channel.isSendable()))
      return null;

    return channel as T;
  }

  public async getGuild(id: string): Promise<Guild> {
    const guild = await this.client.guilds.fetch(id);
    return guild;
  }

  public async getMessageHistory(channelId: string) {
    const channel = await this.getChannel<TextChannel>(channelId);
    const msgs = await channel?.messages.fetch({ limit: 50 });
    return msgs;
  }

  public getMessages(): Message[] {
    return this.messageCache;
  }

  public clearMessageCache(): void {
    this.messageCache = [];
  }

  public async sendMessage(channelId: string, content: string, files: FileUploadData[] = []): Promise<Message> {
    const channel = await this.getChannel<TextChannel>(channelId);

    if (!channel)
      return Promise.reject('Failed to sendMessage, no channel');

    let message = {
      content: content,
      files: files
    }

    return channel.send(message as any);
  }

}
