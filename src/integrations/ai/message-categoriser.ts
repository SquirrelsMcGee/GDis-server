import { Logger } from "../../helpers/logger";
import { INamed } from "../../lib/named-class";
import { Ollama, ResponseData } from "./ollama";
import { ChatMessageInput } from "./prompt-providers/discord-chat";
import { BasicMessagePrompt, CategoriserConversationPrompt } from "./prompt-providers/message-categoriser";
import { IPromptProvider } from "./prompt-providers/prompt-provider";

export class OllamaCategoriser extends Ollama implements INamed {
  public readonly name: string = 'MessageCategoriser';

  private readonly contextKey = Date.now().toString();

  private logger: Logger = new Logger();

  constructor() {
    super();
    this.logger.setInfo(this.name);
  }

  public override async getResponse(input: ChatMessageInput): Promise<string> {
    const r = await super.getResponse(input);
    this.logger.info(r);
    return Promise.resolve(r);
  }

  protected readonly conversationProvider: IPromptProvider<unknown> = new CategoriserConversationPrompt();
  protected readonly chatMessageProvider: IPromptProvider<ChatMessageInput> = new BasicMessagePrompt();

  protected override getContext(_: string): string | undefined {
    return this.contextMap.get(this.contextKey);
  }

  protected override setContext(_: string, initial: ResponseData): void {
    this.contextMap.set(this.contextKey, initial.context);
  }
}