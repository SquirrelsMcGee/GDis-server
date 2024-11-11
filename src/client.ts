import { Channel, ChannelType, Client, GatewayIntentBits, Guild, GuildChannel, Message, PermissionsBitField, TextChannel } from "discord.js";
import { first } from "rxjs";
import { ENV_CONFIG } from "./config";
import { Logger } from "./helpers/logger";
import { PermissionCheck } from "./helpers/permission-checker";
import { PromiseFactory } from "./helpers/promise-factory";
import { OllamaCategoriser } from "./integrations/ai/message-categoriser";
import { Ollama } from "./integrations/ai/ollama";
import { ChatMessageInput } from "./integrations/ai/prompt-providers/discord-chat";
import { SearchSummarizer } from "./integrations/ai/search-summarizer";
import { BraveSearch } from "./integrations/web-search/brave-search";
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

type PreconditionInfo = {
  name: string;
  condition: Precondition;
}

type Precondition = () => Promise<boolean>;

export class ClientFunctions implements INamed {
  public readonly name: string = 'ClientFunctions';

  private messageCache: Message[] = [];

  private readonly ollama = new Ollama();
  private readonly categoriser = new OllamaCategoriser();
  private readonly summariser = new SearchSummarizer();

  private readonly braveSearch: BraveSearch = new BraveSearch();

  private readonly sandboxGuildIds = ['673908382809325620', '820763406389870642'];

  constructor(
    private readonly client: Client,
    private readonly cacheMessages: boolean
  ) { }

  public async onMessage(message: Message) {
    try {
      if (this.cacheMessages)
        this.messageCache.push(message);

      const category = await this.categoriseMessage(message);
      //console.log('category', category);
      if (category.includes('[Web Search]') && await this.authorIsNotMe(message)) {
        Logger.log(this.name, 'Using Websearch for this request');
        const searchTerm = category.slice('[Web Search]'.length);

        this.braveSearch.search(searchTerm)
          .pipe(first())
          .subscribe(async results => {
            if (results.length === 0)
              return;

            const summary = await this.summariser.getResponse(results);
            await this.sendLLMResponse(message, summary);
          });
      }
      else {
        await this.sendLLMResponse(message);
      }

    }
    catch (error) {
      // Logger.error(this.name, error);
    }
  }

  private async categoriseMessage(message: Message): Promise<string> {
    try {
      // Remove the bot mention from the message
      const content = message.cleanContent.replace(`@BotsByDre`, '');
      // Get the response from Ollama
      const input: ChatMessageInput = {
        channelId: message.channel.id,
        username: message.author.displayName,
        message: content
      }
      const ollamaResponse = await this.categoriser.getResponse(input);

      return Promise.resolve(ollamaResponse);
    }
    catch (error) {
      Logger.error(this.name, 'fn categoriseMessage', error);
      return PromiseFactory.reject(this.name, ['fn categoriseMessage', error]);
    }
  }

  private async sendLLMResponse(message: Message, optionalContext?: string) {

    // Define conditions for this action
    const preconditions: PreconditionInfo[] = [
      { name: 'isNotSystemMessage', condition: this.isNotSystemMessage.bind(this, message) },
      { name: 'authorIsNotMe', condition: this.authorIsNotMe.bind(this, message) },
      { name: 'isThreadOrDirect', condition: this.isThreadOrDirect.bind(this, message) },
      // Sandbox to this channel
      // Replace with whatever channel Id you want
      { name: 'isSandboxed', condition: this.isSandboxed.bind(this, message) }
    ];

    try {
      // Assert preconditions
      const okay = await this.assertPreconditions(preconditions);
      if (!okay)
        throw ['Preconditions not met for user', message.author.username];

      const channel = message.thread ?? (message.channel as TextChannel);

      // Start typing...
      await channel.sendTyping();

      // Remove the bot mention from the message
      const content = message.cleanContent.replace(`@BotsByDre`, '');

      // Get the response from Ollama
      //console.log('contextual', contextualContent);
      const input: ChatMessageInput = {
        channelId: message.channel.id,
        username: message.author.displayName,
        message: content,
        context: optionalContext
      }
      const ollamaResponse = await this.ollama.getResponse(input);

      // Send the reply
      return this.sendReply(message, ollamaResponse);
    }
    catch (error) {
      Logger.error(this.name, 'fn sendLLMResponse', error);
      return PromiseFactory.reject(this.name, ['fn sendLLMResponse', error]);
    }
  }


  public async sendReply(replyTo: Message, content: string): Promise<Message> {
    if (!PermissionCheck.isChannelType(replyTo.channel, [ChannelType.GuildText, ChannelType.PrivateThread]))
      return PromiseFactory.reject(this.name, ['fn sendReply', 'Channel type is not GuildText', replyTo.channel.type]);

    if (!PermissionCheck.hasChannelPerms(replyTo.channel as GuildChannel, [PermissionsBitField.Flags.SendMessages]))
      return PromiseFactory.reject(this.name, ['fn sendReply', 'Does not have SendMessages permission']);

    return replyTo.reply(content);
  }

  private async assertPreconditions(preconditions: PreconditionInfo[]): Promise<boolean> {
    let allOkay = true;

    for (let i = 0; i < preconditions.length; i++) {
      const result = await preconditions[i].condition();
      allOkay = allOkay && result;

      //if (result)
      //  Logger.log(this.name, 'fn assertPreconditions', 'passed', preconditions[i].name)
      //if (!result)
      //  Logger.error(this.name, 'fn assertPreconditions', 'failed', preconditions[i].name);
    }

    return Promise.resolve(allOkay);
  }

  /**
   * Helpers
   */

  private async isNotSystemMessage(message: Message): Promise<boolean> {
    const isSystemMessage = !message.thread && message.system;
    return Promise.resolve(!isSystemMessage);
  }

  private async authorIsNotMe(message: Message): Promise<boolean> {
    const isMe = message.author.id !== this.client.user?.id;
    return Promise.resolve<boolean>(isMe);
  }

  private async isThreadOrDirect(message: Message): Promise<boolean> {
    const isThread = await this.isThread(message);
    if (isThread)
      return Promise.resolve(isThread);

    const isMentionOrReply = await this.isMentionOrReply(message);
    return Promise.resolve(isMentionOrReply);
  }

  private async isMentionOrReply(message: Message): Promise<boolean> {
    const isMention = await this.isMention(message);
    const isReply = await this.isReply(message);
    return Promise.resolve(isMention || isReply);
  }

  private async isMention(message: Message): Promise<boolean> {
    const isMention = message.mentions.users.map(u => u.id).includes(this.client.user?.id ?? '');
    return Promise.resolve(isMention);
  }

  private async isThread(message: Message): Promise<boolean> {
    const isValid = PermissionCheck.isChannelType(message.channel, [ChannelType.PrivateThread]);
    return Promise.resolve(isValid);
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
      }
      finally {
        return Promise.resolve(false);
      }
    }

    return Promise.resolve(false);
  }

  private async isSandboxed(message: Message): Promise<boolean> {
    const isInSandbox = this.sandboxGuildIds.includes(message.guild?.id ?? '');
    return Promise.resolve(isInSandbox);
  }
}