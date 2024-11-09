import { Channel, ChannelType, Client, GatewayIntentBits, Guild, GuildChannel, Message, PermissionsBitField, TextChannel } from "discord.js";
import { config } from "./config";
import { Logger } from "./helpers/logger";
import { PermissionCheck } from "./helpers/permission-checker";
import { PromiseFactory } from "./helpers/promise-factory";
import { Ollama } from "./integrations/ollama";
import { INamed } from "./lib/named-class";

export type FileUploadData = {
  attachment: string;
  name: string;
  description?: string;
};

export class ClientManager implements INamed {
  public readonly name: string = 'ClientManager';

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
      this.messageCache.push(message);

      // Dont do anything if it's me
      if (message.author.id === this.client.user?.id)
        return;

      // Sandbox to this channel
      // Replace with whatever channel Id you want
      // Or remove idc
      if (message.channel.id !== '1302754124147855380')
        return;

      if (!this.isMention(message) && !await this.isReply(message))
        return;

      this.sendLLMResponse(message);
    });

    this.client.once("ready", (client) => {
      Logger.log(this.name, 'Discord bot is ready', client.user.username);
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

  public async sendReply(replyTo: Message, content: string): Promise<Message> {
    if (!PermissionCheck.isChannelType(replyTo.channel, [ChannelType.GuildText]))
      return PromiseFactory.reject(this.name, ['fn sendReply', 'Channel type is not GuildText', replyTo.channel.type]);

    if (!PermissionCheck.hasChannelPerms(replyTo.channel as GuildChannel, [PermissionsBitField.Flags.SendMessages]))
      return PromiseFactory.reject(this.name, ['fn sendReply', 'Does not have SendMessages permission']);

    return replyTo.reply(content);
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

      }
      catch (error) {
        Logger.error(this.name, 'fn isReply', error);
      } finally {
        return Promise.resolve(false);
      }
    }

    return Promise.resolve(false);
  }

  private async sendLLMResponse(message: Message) {
    const content = message.cleanContent.replace(`@BotsByDre`, '');
    try {
      const ollamaResponse = await this.ollama.getResponse(message.channel.id, message.author.displayName, content);
      await this.sendReply(message, ollamaResponse);
    }
    catch (error) {
      Logger.error(this.name, 'fn sendLLMResponse', error);
    }
  }
}