import { ChannelType, Client, Guild, Message, PermissionsBitField, TextChannel, VoiceBasedChannel } from "discord.js";
import { lastValueFrom } from "rxjs";

import { ENV_CONFIG } from "../config";
import { Logger } from "../helpers/logger";
import { PromiseFactory } from "../helpers/promise-factory";
import { sleep } from "../helpers/sleep";
import { splitStringIntoChunks } from "../helpers/string-functions";
import { ChatHistorySummariser } from "../integrations/ai/chat-history-summariser";
import { InjectionGuard } from "../integrations/ai/injection-guard";
import { OllamaCategoriser } from "../integrations/ai/message-categoriser";
import { Ollama } from "../integrations/ai/ollama";
import { ChatMessageInput } from "../integrations/ai/prompt-providers/discord-chat";
import { SearchSummariser } from "../integrations/ai/search-summariser";
import { CoquiTTS } from "../integrations/tts/coqui";
import { BraveSearch } from "../integrations/web-search/brave-search";
import { Exception, NonFatalException } from "../lib/custom-error";
import { ISearchResult } from "../lib/interfaces/web-search-api-response";
import { INamed } from "../lib/named-class";
import { ClientVoiceController } from "./client-voice";
import { ClientActionConditionMap, PreconditionType } from "./precondition-map";

export class ClientFunctions implements INamed {
  public readonly name: string = 'ClientFunctions';

  private messageCache: Message[] = [];

  // Logging
  private readonly logger = new Logger();

  // Integrations
  private readonly braveSearch: BraveSearch = new BraveSearch();

  // LLM layers
  /**
   * LLM Layers
   * 
   * The way this works is that multiple LLM conversations happen in sequence
   * 1. InjectionGuard
   *    This returns a simple 'yes' or 'no' if the input is detected as an injection attack
   * 2. Categoriser
   *    This returns an intent for the input, currently supports 'Chat' and 'WebSearch'
   * 3. SearchSummariser
   *    If the intent is 'WebSearch' this summarises the search results (badly)
   * 4. Ollama - TODO Change name
   *    Main LLM conversation for the chatbot
   * 5. ChatHistorySummariser
   *    Creates a sort of "memory" for the chatbot by summarising the conversation thus far
   *    TODO - unfinished and currently disabled
   */

  // InjectionGuard hopefully should block most people from affecting later models
  private readonly injectionGuard = new InjectionGuard();
  private readonly chatbot = new Ollama('Ollama Core');
  private readonly categoriser = new OllamaCategoriser();
  private readonly searchSummariser = new SearchSummariser();
  private readonly chatHistorySummariser: ChatHistorySummariser;

  private readonly clientVoice: ClientVoiceController;

  private readonly preconditionMap: ClientActionConditionMap;

  constructor(
    private readonly client: Client,
    private readonly cacheMessages: boolean
  ) {
    this.logger.setInfo(this.name);

    this.chatHistorySummariser = new ChatHistorySummariser(this.client.user?.username ?? '');

    this.preconditionMap = new ClientActionConditionMap(
      ['673908382809325620', '1302754124147855380', '1355678852445114683'],
      this.client
    );

    this.clientVoice = new ClientVoiceController(new CoquiTTS());

    this.clientVoice.OnAudioInteraction.subscribe(async (interaction) => {

      if (ENV_CONFIG.ENABLE_WEB_SEARCH) {
        const categoryInput = this.getChatMessageInputRaw(
          interaction.channel.id,
          (await interaction.guild.members.fetch(interaction.metadata.userId)).displayName,
          interaction.metadata.transcript
        );

        const category = await this.categoriser.getResponse(categoryInput);
        this.logger.info(category);
        const isWebSearch = category.toLocaleLowerCase().includes('[web search]');

        let summary: string | undefined;

        if (isWebSearch) {
          const webResults = await this.doWebSearch(category);
          summary = await this.searchSummariser.getResponse(webResults);

          const responseInput = this.getChatMessageInputRaw(
            interaction.channel.id,
            (await interaction.guild.members.fetch(interaction.metadata.userId)).displayName,
            interaction.metadata.transcript,
            summary
          );
          this.logger.info('summary', summary);
          const response = await this.chatbot.getResponse(responseInput);
          this.sayTTS(interaction.guild, interaction.channel, response);
        }
      }
      else {
        const responseInput = this.getChatMessageInputRaw(
          interaction.channel.id,
          (await interaction.guild.members.fetch(interaction.metadata.userId)).displayName,
          interaction.metadata.transcript
        );
        const response = await this.chatbot.getResponse(responseInput);
        this.sayTTS(interaction.guild, interaction.channel, response);
      }
    });
  }

  public async onMessage(message: Message) {
    try {
      if (this.cacheMessages)
        this.messageCache.push(message);

      // If the message is from me, stop
      if (await this.preconditionMap.test(PreconditionType.authorIsMe, message))
        return Promise.resolve('Author was me, ignoring message');

      if (message.content.startsWith('.join') && ENV_CONFIG.ENABLE_TTS) {
        this.sendReply(message, 'Okay joining the voice channel now')
        const guild = message.guild;
        const channel = message.member?.voice.channel as VoiceBasedChannel;
        return this.sayTTS(guild!, channel!, 'Ding, ding!')
      }

      if (!await this.guardInput(message)) {
        return Promise.resolve('Input was bad, ignoring');
      }


      if (await this.preconditionMap.assert(PreconditionType.isNotSystemMessage, message) === false)
        return new NonFatalException('Was system message, ignoring');

      const isThreadOrDirect = await this.preconditionMap.test(PreconditionType.isThreadOrDirect, message);
      const isSandboxed = await this.preconditionMap.test(PreconditionType.sandboxed, message);
      const isAcceptableChannel = isThreadOrDirect || isSandboxed;

      if (!isAcceptableChannel)
        return Promise.resolve('Message ignored');

      const category = await this.categoriseMessage(message);
      const isWebSearch = category.toLocaleLowerCase().includes('[web search]');
      this.logger.info('msg isWebSearch', isWebSearch, category);
      if (isWebSearch && ENV_CONFIG.ENABLE_WEB_SEARCH) {
        const webResults = await this.doWebSearch(category);
        const summary = await this.searchSummariser.getResponse(webResults);
        await this.reply(message, summary);
      }
      else
        await this.reply(message);
    }
    catch (error: unknown) {
      const exception = error as Exception;
      if (exception.isFatal === undefined)
        this.logger.error(error as string);
      else if (exception.isFatal)
        this.logger.error(exception.message);
      else
        this.logger.warn('Caught in onMessage', exception.message);
    }
  }

  private async reply(message: Message, optionalContext?: string) {
    const sent = await this.trySendLLMResponse(message, optionalContext);
    const contentForSpeech = sent.cleanContent;

    this.summarySoFar({
      channelId: sent.channel.id,
      username: this.client.user?.username ?? '',
      message: contentForSpeech
    });

    const guild = message.guild;
    const channel = message.member?.voice.channel as VoiceBasedChannel;
    if (channel)
      this.sayTTS(guild!, channel!, contentForSpeech);
  }

  private async doWebSearch(category: string): Promise<ISearchResult[]> {
    this.logger.info('Using websearch for this request');
    const searchTerm = category.slice('[Web Search]'.length);

    return lastValueFrom(this.braveSearch.search(searchTerm));
  }

  private async guardInput(message: Message): Promise<boolean> {
    this.logger.info('Checking input is acceptable', message.cleanContent);
    const input = this.getChatMessageInput(message);
    const ollamaResponse = (await this.injectionGuard.getResponse(input)).toLocaleLowerCase();
    const result = ollamaResponse.startsWith('no'); // 'no' when input is not bad
    this.logger.info(ollamaResponse);

    return Promise.resolve(result);
  }

  private async categoriseMessage(message: Message): Promise<string> {
    try {
      const input = this.getChatMessageInput(message);
      const ollamaResponse = (await this.categoriser.getResponse(input)).toLocaleLowerCase();

      return Promise.resolve(ollamaResponse);
    }
    catch (error) {
      this.logger.error('Caught in categoriseMessage', error);
      return PromiseFactory.reject(this.name, ['fn categoriseMessage', error]);
    }
  }

  private async trySendLLMResponse(message: Message, optionalContext?: string) {
    try {
      return this.sendLLMResponse(message, optionalContext);
    }
    catch (error) {
      this.logger.error('Caught in trySendLLMResponse', error);
      return PromiseFactory.reject(this.name, ['fn sendLLMResponse', error]);
    }
  }

  private async sayTTS(guild: Guild, channel: VoiceBasedChannel, myReplyContent: string) {
    if (!ENV_CONFIG.ENABLE_TTS)
      return Promise.resolve('TTS Disabled');

    return this.clientVoice.doVoiceInteraction(guild!, channel!, () => Promise.resolve(myReplyContent));
  }

  private async sendLLMResponse(message: Message, optionalContext?: string) {
    // Get channel
    const channel = message.thread ?? (message.channel as TextChannel);

    // Start typing...
    await channel.sendTyping();

    // Get the response from Ollama
    const input = this.getChatMessageInput(message, optionalContext);

    // Add to the running summary
    this.summarySoFar(input);

    // Get the ai generated content
    const ollamaResponse = await this.chatbot.getResponse(input);

    // Wait a second to make the response a bit nicer :)
    await sleep(500);

    // Send the reply
    return this.sendReply(message, ollamaResponse);
  }

  public async sendReply(replyTo: Message, content: string): Promise<Message> {
    await this.preconditionMap.assert(PreconditionType.isChannelType, replyTo,
      ChannelType.GuildText, ChannelType.PrivateThread);

    await this.preconditionMap.assert(PreconditionType.hasGuildChannelPermissions, replyTo,
      PermissionsBitField.Flags.SendMessages);

    const isThread = await this.preconditionMap.test(PreconditionType.isThread, replyTo);

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

    if (content.length >= 2000)
      return sendMultiple(splitStringIntoChunks(content, 1900))
    else
      return sendText(content);
  }

  private getChatMessageInput(message: Message, context?: string) {
    return this.getChatMessageInputRaw(
      message.channel.id,
      message.member?.nickname ?? message.author.displayName,
      message.cleanContent,
      context
    );
  }

  private getChatMessageInputRaw(channelId: string, username: string, message: string, context?: string) {
    const input: ChatMessageInput = {
      channelId: channelId,
      // Get the user's nickname or displayname
      username: username,
      // Remove the bot mention from the message
      message: message.replace(`@BotsByDre`, ''),
      context: context
    };
    return input;
  }

  private summarySoFar(input: ChatMessageInput): void {
    if (!ENV_CONFIG.ENABLE_CHAT_HISTORY_SUMMARY)
      return;

    // Run this asynchronously
    this.chatHistorySummariser.getResponse(input);
  }
}