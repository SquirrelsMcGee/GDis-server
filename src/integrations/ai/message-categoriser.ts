import { Ollama, ResponseData } from "./ollama";
import { ChatMessageInput } from "./prompt-providers/discord-chat";
import { BasicMessagePrompt, CategoriserConversationPrompt } from "./prompt-providers/message-categoriser";
import { IPromptProvider } from "./prompt-providers/prompt-provider";

export class OllamaCategoriser extends Ollama {
  private readonly contextKey = Date.now().toString();

  protected readonly conversationProvider: IPromptProvider<unknown> = new CategoriserConversationPrompt();
  protected readonly chatMessageProvider: IPromptProvider<ChatMessageInput> = new BasicMessagePrompt();

  protected override getContext(_: string): string | undefined {
    return this.contextMap.get(this.contextKey);
  }

  protected override setContext(_: string, initial: ResponseData): void {
    this.contextMap.set(this.contextKey, initial.context);
  }
}