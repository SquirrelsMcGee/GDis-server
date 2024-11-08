import { Channel, Client, GatewayIntentBits, Guild, Message, TextChannel } from "discord.js";
import { config } from "./config";
import { Ollama } from "./integrations/ollama";

export type FileUploadData = {
  attachment: string;
  name: string;
  description?: string;
};

export class ClientManager {
  public client: Client;

  private readonly ollama: Ollama = new Ollama();

  private messageCache: Message[] = [];

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
    });

    this.client.on('messageCreate', async (message) => {
      //console.log('received message ', message.id);
      this.messageCache.push(message);

      // Dont do anything if it's me
      if (message.author.id === this.client.user?.id)
        return;

      // Sandbox to this channel
      // Replace with whatever channel Id you want
      // Or remove idc
      if (message.channel.id !== '820763406389870645')
        return;

      if (!this.isMention(message) && !await this.isReply(message))
        return;

      this.sendLLMResponse(message);
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

  private isMention(message: Message): boolean {
    return message.mentions.users.map(u => u.id).includes(this.client.user?.id ?? '');
  }

  private async isReply(message: Message): Promise<boolean> {
    // Check if the message is a reply to another message
    if (message.reference?.messageId) {
      try {
        // Fetch the original message being replied to
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

        // Check if the original message was sent by the bot
        if (referencedMessage.author.id === this.client.user?.id)
          return Promise.resolve(true);
      } catch (error) {
        return Promise.resolve(false);
      }
    }

    return Promise.resolve(false);
  }

  private async sendLLMResponse(message: Message) {
    console.log('getting ai llm response', message.cleanContent);

    this.ollama.getResponse(message.channel.id, message.author.displayName, message.cleanContent)
      .then(botResponse => {
        console.log('[REPLY]', botResponse);
        message.reply(botResponse);
      }).catch((err) => {
        console.log(err);
      });
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