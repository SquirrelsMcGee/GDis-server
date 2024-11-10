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

  private messageCache: Message[] = [];

  private readonly functions: ClientFunctions;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
    });

    this.client.on('messageCreate', async (message) => this.functions.onMessage(message));

    this.functions = new ClientFunctions(this.client, true);

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

}

type PreconditionInfo = {
  name: string;
  condition: Precondition;
}

type Precondition = () => Promise<boolean>;

export class ClientFunctions implements INamed {
  public readonly name: string = 'ClientFunctions';

  private messageCache: Message[] = [];

  private readonly ollama: Ollama = new Ollama();

  private readonly sandboxChannelId = '1302754124147855380';

  constructor(
    private readonly client: Client,
    private readonly cacheMessages: boolean
  ) { }

  public async onMessage(message: Message) {
    if (this.cacheMessages)
      this.messageCache.push(message);

    this.sendLLMResponse(message);
  }


  private async sendLLMResponse(message: Message) {
    try {
      const preconditions: PreconditionInfo[] = [
        { name: 'authorIsNotMe', condition: this.authorIsNotMe.bind(this, message) },
        { name: 'isMention or isReply', condition: this.isMentionOrReply.bind(this, message) },
        // Sandbox to this channel
        // Replace with whatever channel Id you want
        { name: 'sandbox channel', condition: this.isSandboxChannel.bind(this, message) }
      ];

      const okay = await this.assertPreconditions(preconditions);
      if (!okay)
        throw '';

      const content = message.cleanContent.replace(`@BotsByDre`, '');

      const ollamaResponse = await this.ollama.getResponse(message.channel.id, message.author.displayName, content);
      await this.sendReply(message, ollamaResponse);
    }
    catch (error) {
      Logger.error(this.name, 'fn sendLLMResponse', error);
    }
  }


  public async sendReply(replyTo: Message, content: string): Promise<Message> {
    if (!PermissionCheck.isChannelType(replyTo.channel, [ChannelType.GuildText]))
      return PromiseFactory.reject(this.name, ['fn sendReply', 'Channel type is not GuildText', replyTo.channel.type]);

    if (!PermissionCheck.hasChannelPerms(replyTo.channel as GuildChannel, [PermissionsBitField.Flags.SendMessages]))
      return PromiseFactory.reject(this.name, ['fn sendReply', 'Does not have SendMessages permission']);

    return replyTo.reply(content);
  }

  private async assertPreconditions(preconditions: PreconditionInfo[]): Promise<boolean> {
    let allOkay = true;

    for (let i = 0; i < preconditions.length; i++) {
      const result = await preconditions[i].condition();
      //if (result)
      //  Logger.log(this.name, 'fn assertPreconditions', 'passed', preconditions[i].name)
      //if (!result)
      //  Logger.error(this.name, 'fn assertPreconditions', 'failed', preconditions[i].name);
      allOkay = allOkay && result;
    }

    return Promise.resolve(allOkay);
  }

  /**
   * Helpers
   */
  private async authorIsNotMe(message: Message): Promise<boolean> {
    const isMe = message.author.id !== this.client.user?.id;
    console.log(isMe);
    return Promise.resolve<boolean>(isMe);
  }

  private async isMentionOrReply(message: Message): Promise<boolean> {
    const isMention = await this.isMention(message);
    const isReply = await this.isReply(message);

    return Promise.resolve((isMention || isReply));
  }

  private async isMention(message: Message): Promise<boolean> {
    const isMention = message.mentions.users.map(u => u.id).includes(this.client.user?.id ?? '');
    return Promise.resolve(isMention);
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

  private async isSandboxChannel(message: Message): Promise<boolean> {
    return Promise.resolve(message.channel.id === this.sandboxChannelId);
  }
}