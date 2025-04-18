import { catchError, lastValueFrom, map, Observable, tap } from 'rxjs';
import { ENV_CONFIG } from '../../config';
import { Logger } from '../../helpers/logger';
import { PromiseFactory } from '../../helpers/promise-factory';
import { INamed } from '../../lib/named-class';
import { HttpService } from '../http';
import { ChatMessageInput, DiscordChatMessagePrompt, DiscordConversationPrompt } from './prompt-providers/discord-chat';
import { IPromptProvider } from './prompt-providers/prompt-provider';

export type RequestData = {
  model: string;
  stream: boolean;
  prompt: string;
  context: string | undefined;
  role: string;
};

export type ResponseData = {
  response: string;
  context: string;
};

export interface IOllama<PromptInputType> {
  getResponse(input: PromptInputType): Promise<string>;
}

export abstract class OllamaBase<ResponseInput> implements INamed, IOllama<ResponseInput> {
  public readonly name: string;

  protected readonly contextMap: Map<string, string> = new Map<string, string>();
  protected readonly http: HttpService;

  protected readonly conversationProvider: IPromptProvider<unknown>;
  protected readonly chatMessageProvider: IPromptProvider<ResponseInput>;

  protected readonly logger = new Logger();

  constructor(
    name: string = 'OllamaBase',
    conversationProvider: IPromptProvider<unknown>,
    chatMessageProvider: IPromptProvider<ResponseInput>) {

    this.conversationProvider = conversationProvider;
    this.chatMessageProvider = chatMessageProvider;

    this.http = new HttpService(ENV_CONFIG.OLLAMA_SERVER_URL, ENV_CONFIG.OLLAMA_SERVER_PORT);

    this.name = name;
    this.logger.setInfo(this.name);
  }

  public async getResponse(input: ResponseInput): Promise<string> {
    // Get the context for the conversation
    const contextKey = this.getContextKey(input);
    let context = this.getContext(contextKey);

    // If conversation hasn't started yet, start one and update
    if (!context)
      context = await this.startConversation(contextKey);

    const prompt = this.getMessagePrompt(input);
    return lastValueFrom(this.sendPrompt(prompt, false, context)
      .pipe(
        tap(ollamaResponse => {
          //Loggerlog(this.name, 'Received Response', ollamaResponse.response.slice(0, 100), '...');
          this.setContext(contextKey, ollamaResponse);
        }),
        map(ollamaResponse => ollamaResponse.response),
        catchError(error => {
          //Loggererror(this.name, 'fn getResponse', error);
          return PromiseFactory.throwErrorObservable(this.name, ['fn sendPostRequest', error]);
        })
      ));
  }

  abstract getContextKey(input: ResponseInput): string;

  protected getContext(contextKey: string): string | undefined {
    return this.contextMap.get(contextKey);
  }

  protected setContext(contextKey: string, initial: ResponseData): void {
    this.contextMap.set(contextKey, initial.context);
  }

  protected sendPrompt(prompt: string, isSystem: boolean, context?: string): Observable<ResponseData> {
    const postBody: RequestData = {
      model: ENV_CONFIG.OLLAMA_MODEL_NAME,
      stream: false,
      prompt: prompt,
      context: context,
      role: isSystem ? 'system' : 'user'
    };

    ////Loggerlog(this.name, 'Sending Prompt to ollama', postBody);

    return this.http.post<ResponseData>('api/generate', postBody, undefined, { 'Content-Type': 'application/json' });
  }

  protected getMessagePrompt(input: ResponseInput): string {
    return this.chatMessageProvider.provide(input);
  }

  /**
   * Start a conversation and return the context
   */
  protected async startConversation(contextKey: string) {
    // Get the prompt
    const prompt = this.conversationProvider.provide();
    // Send to the LLM
    const initial = await lastValueFrom(this.sendPrompt(prompt, true, undefined));
    // Update our context map
    this.setContext(contextKey, initial);

    return Promise.resolve(initial.context);
  }

}

export class Ollama extends OllamaBase<ChatMessageInput> {
  constructor(name: string) {
    super(
      name,
      new DiscordConversationPrompt(),
      new DiscordChatMessagePrompt());
  }

  public override async getResponse(input: ChatMessageInput): Promise<string> {
    let res = await super.getResponse(input);
    res = res.replace('dre:', '');
    res = res.replace('Dre:', '');

    return Promise.resolve(res);
  }

  getContextKey(input: ChatMessageInput): string {
    return input.channelId;
  }
}
