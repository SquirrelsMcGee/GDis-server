import { ChannelType, Client, GuildChannel, Message, PermissionsBitField, TextChannel } from "discord.js";
import { lastValueFrom } from "rxjs";
import { ENV_CONFIG } from "../config";
import { Logger } from "../helpers/logger";
import { PromiseFactory } from "../helpers/promise-factory";
import { sleep } from "../helpers/sleep";
import { splitStringIntoChunks } from "../helpers/string-functions";
import { OllamaCategoriser } from "../integrations/ai/message-categoriser";
import { Ollama } from "../integrations/ai/ollama";
import { ChatMessageInput } from "../integrations/ai/prompt-providers/discord-chat";
import { SearchSummarizer } from "../integrations/ai/search-summarizer";
import { BraveSearch } from "../integrations/web-search/brave-search";
import { ISearchResult } from "../lib/interfaces/web-search-api-response";
import { INamed } from "../lib/named-class";
import { runWithPreconditions } from "./precondition-decorator";
import { ClientActionPreconditions, PreconditionInfo } from "./preconditions";


export class ClientFunctions implements INamed {
  public readonly name: string = 'ClientFunctions';

  private messageCache: Message[] = [];

  private readonly ollama = new Ollama();
  private readonly categoriser = new OllamaCategoriser();
  private readonly summariser = new SearchSummarizer();

  private readonly preconditions: ClientActionPreconditions;
  private readonly braveSearch: BraveSearch = new BraveSearch();

  constructor(
    private readonly client: Client,
    private readonly cacheMessages: boolean
  ) {
    this.preconditions = new ClientActionPreconditions(
      ['673908382809325620', '820763406389870642'],
      this.client
    );
  }

  public async onMessage(message: Message) {
    try {
      if (this.cacheMessages)
        this.messageCache.push(message);

      // If the message is from me, stop
      if (await this.preconditions.authorIsMe(message))
        return Promise.resolve();

      const category = await this.categoriseMessage(message);
      const isWebSearch = category.includes('[Web Search]');
      if (isWebSearch && ENV_CONFIG.ENABLE_WEB_SEARCH) {
        const webResults = await this.doWebSearch(category);
        const summary = await this.summariser.getResponse(webResults);
        await this.trySendLLMResponse(message, summary);
      }
      else
        await this.trySendLLMResponse(message);
    }
    catch (error) {
      Logger.error(this.name, error);
    }
  }

  private async doWebSearch(category: string): Promise<ISearchResult[]> {
    Logger.log(this.name, 'Using Websearch for this request');

    const searchTerm = category.slice('[Web Search]'.length);

    return lastValueFrom(this.braveSearch.search(searchTerm));
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

  private async trySendLLMResponse(message: Message, optionalContext?: string) {
    // Define conditions for this action
    const preconditions: PreconditionInfo[] = [
      { name: 'isNotSystemMessage', execute: () => this.preconditions.isNotSystemMessage(message) },
      { name: 'isThreadOrDirect', execute: () => this.preconditions.isThreadOrDirect(message) },
      { name: 'isSandboxed', execute: () => this.preconditions.isSandboxed(message) }
    ];

    try {
      return runWithPreconditions(
        this.sendLLMResponse.bind(this, message, optionalContext),
        preconditions
      );
    }
    catch (error) {
      Logger.error(this.name, 'fn sendLLMResponse', error);
      return PromiseFactory.reject(this.name, ['fn sendLLMResponse', error]);
    }
  }

  private async sendLLMResponse(message: Message, optionalContext?: string) {
    const channel = message.thread ?? (message.channel as TextChannel);

    // Start typing...
    await channel.sendTyping();

    // Remove the bot mention from the message
    const content = message.cleanContent.replace(`@BotsByDre`, '');

    // Get the response from Ollama
    const input: ChatMessageInput = {
      channelId: message.channel.id,
      username: message.author.displayName,
      message: content,
      context: optionalContext
    }

    // Get the ai generated content
    const ollamaResponse = await this.ollama.getResponse(input);

    // Wait a second to make the response a bit nicer :)
    await sleep(1000);

    // Send the reply
    return this.sendReply(message, ollamaResponse);
  }


  public async sendReply(replyTo: Message, content: string): Promise<Message> {
    const preconditions: PreconditionInfo[] = [
      {
        name: 'isCorrectChannelType',
        execute: () =>
          this.preconditions.isChannelType(
            replyTo,
            [ChannelType.GuildText, ChannelType.PrivateThread])
      },
      {
        name: 'hasGuildChannelPermissions',
        execute: () =>
          this.preconditions.hasGuildChannelPermissions(
            replyTo.channel as GuildChannel,
            [PermissionsBitField.Flags.SendMessages])
      }
    ]

    const isThread = await this.preconditions.isThread(replyTo);

    const sendText = async (txt: string) => {
      return isThread
        ? (replyTo.channel as TextChannel).send(txt)
        : replyTo.reply(txt);
    };

    const sendMultiple = async (txts: string[]) => {
      for (let txt of txts.slice(0, txts.length - 1)) {
        await sleep(500);
        await sendText(txt);
      }

      return sendText(txts.pop() ?? '');
    }

    return runWithPreconditions(
      () => {
        if (content.length >= 2000)
          return sendMultiple(splitStringIntoChunks(content, 1000))
        else
          return sendText(content);
      },
      preconditions
    );

  }
}