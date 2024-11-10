import { catchError, lastValueFrom, map, Observable, tap } from 'rxjs';

import { HttpService } from '../helpers/http';
import { Logger } from '../helpers/logger';
import { PromiseFactory } from '../helpers/promise-factory';
import { INamed } from '../lib/named-class';
import { ChatMessageInput, DiscordChatMessagePrompt, DiscordConversationPrompt, IPromptProvider } from './prompt-provider';

export type RequestData = {
  model: string;
  stream: boolean;
  prompt: string;
  context: string | undefined;
};

export type ResponseData = {
  response: string;
  context: string;
};

export class Ollama implements INamed {
  public readonly name: string = 'Ollama';

  protected readonly contextMap: Map<string, string> = new Map<string, string>();
  protected readonly http: HttpService;

  protected readonly conversationProvider: IPromptProvider<unknown> = new DiscordConversationPrompt();
  protected readonly chatMessageProvider: IPromptProvider<ChatMessageInput> = new DiscordChatMessagePrompt();

  constructor() {
    this.http = new HttpService('http://localhost', '11434');
  }

  public async getResponse(channelId: string, username: string, msg: string): Promise<string> {
    let context = this.getContext(channelId);

    if (!context) {
      const prompt = this.conversationProvider.provide();
      const initial = await lastValueFrom(this.sendPrompt(prompt, undefined));
      this.setContext(channelId, initial);
      context = initial.context;
    }

    const prompt = this.chatMessageProvider.provide({ message: msg, username: username });
    //console.log(prompt);
    return lastValueFrom(this.sendPrompt(prompt, context)
      .pipe(
        tap(ollamaResponse => {
          Logger.log(this.name, 'Received Response', ollamaResponse.response);
          this.contextMap.set(channelId, ollamaResponse.context);
        }),
        map(ollamaResponse => ollamaResponse.response),
        catchError(error => {
          Logger.error(this.name, 'fn getResponse', error);
          return PromiseFactory.throwErrorObservable(this.name, ['fn sendPostRequest', error]);
        })
      ));
  }

  protected getContext(contextKey: string): string | undefined {
    return this.contextMap.get(contextKey);
  }

  protected setContext(contextKey: string, initial: ResponseData): void {
    this.contextMap.set(contextKey, initial.context);
  }

  protected sendPrompt(prompt: string, context?: string): Observable<ResponseData> {
    const postBody: RequestData = {
      model: 'llama3.2',
      stream: false,
      prompt: prompt,
      context: context
    };

    Logger.log('Sending Prompt to ollama', prompt.slice(0, 100));

    return this.http.post<ResponseData>('api/generate', postBody, undefined, { 'Content-Type': 'application/json' });
  }
}