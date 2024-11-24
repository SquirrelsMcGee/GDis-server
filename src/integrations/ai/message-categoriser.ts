import { ENV_CONFIG } from "../../config";
import { INamed } from "../../lib/named-class";
import { Ollama, ResponseData } from "./ollama";
import { ChatMessageInput } from "./prompt-providers/discord-chat";
import { BasicMessagePrompt, CategoriserConversationPrompt } from "./prompt-providers/message-categoriser";
import { IPromptProvider } from "./prompt-providers/prompt-provider";

export class OllamaCategoriser extends Ollama implements INamed {
  public readonly name: string = 'MessageCategoriser';

  protected readonly conversationProvider: IPromptProvider<unknown> = new CategoriserConversationPrompt();
  protected readonly chatMessageProvider: IPromptProvider<ChatMessageInput> = new BasicMessagePrompt();

  private readonly contextKey = Date.now().toString();

  constructor() {
    super();
  }

  public override async getResponse(input: ChatMessageInput): Promise<string> {
    if (!ENV_CONFIG.ENABLE_WEB_SEARCH)
      return Promise.resolve('[Chat]');

    const r = await super.getResponse(input);
    this.logger.info(r);
    return Promise.resolve(r);
  }

  protected override getContext(_: string): string | undefined {
    return this.contextMap.get(this.contextKey);
  }

  protected override setContext(_: string, initial: ResponseData): void {
    this.contextMap.set(this.contextKey, initial.context);
  }
}