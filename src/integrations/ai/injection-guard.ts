import { INamed } from "../../lib/named-class";
import { Ollama } from "./ollama";
import { ChatMessageInput } from "./prompt-providers/discord-chat";
import { InjectionGuardConversationPrompt, InjectionGuardMessagePrompt } from "./prompt-providers/injection-guard";
import { IPromptProvider } from "./prompt-providers/prompt-provider";

export class InjectionGuard extends Ollama implements INamed {

  protected readonly conversationProvider: IPromptProvider<unknown> = new InjectionGuardConversationPrompt();
  protected readonly chatMessageProvider: IPromptProvider<ChatMessageInput> = new InjectionGuardMessagePrompt();

  constructor() {
    super('InjectionGuard');
  }
}