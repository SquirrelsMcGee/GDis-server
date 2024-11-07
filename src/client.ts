import { Channel, Client, GatewayIntentBits, Guild, Message, TextChannel } from "discord.js";
import { config } from "./config";

export type FileUploadData = {
  attachment: string;
  name: string;
  description?: string;
};

export class ClientManager {
  public client: Client;

  private messageCache: Message[] = [];

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
      ],
    });

    this.client.on('messageCreate', async (message) => {
      console.log('received message ', message.id);
      this.messageCache.push(message);
    });

    this.client.once("ready", (client) => {
      console.log("Discord bot is ready! 🤖");
      console.table([
        { a: 'Logged in as', b: client.user.username },
      ]);
    });

    this.client.login(config.DISCORD_TOKEN);
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
    //console.log(this.messageCache);
    return this.messageCache;
  }

  public clearMessageCache(): void {
    this.messageCache = [];
  }

  public async sendMessage(channelId: string, content: string, files: FileUploadData[] = []): Promise<Message> {
    const channel = await this.getChannel<TextChannel>(channelId);

    if (!channel)
      return Promise.reject();

    //console.log()

    let message: unknown;
    /*
    if (files.length > 0)
      message = {
        content: content,
        files: files
      }
    else {
      message = {
        content: content
      }
    }
    */
    message = {
      content: content,
      files: files
    }
    return channel.send(message as any).then((messageRes) => this.logSuccess('Sent message', messageRes.id))
      .catch((err) => this.logError('Failed to send message', err));
  }

  private logSuccess<T>(info: string, object: T) {
    //console.log(info, object);
    return object;
  }

  private logError<T>(info: string, object: T) {
    //console.error(info, object);
    return object
  }
}