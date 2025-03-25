import { INamed } from "../../lib/named-class";
import { Ollama } from "./ollama";
import { ChatSummaryConversationPrompt, ChatSummaryMessagePrompt } from "./prompt-providers/chat-summary";
import { ChatMessageInput } from "./prompt-providers/discord-chat";
import { IPromptProvider } from "./prompt-providers/prompt-provider";

export class ChatHistorySummariser extends Ollama implements INamed {
  public readonly name: string = 'ChatHistorySummariser';

  protected readonly conversationProvider: IPromptProvider<unknown> = new ChatSummaryConversationPrompt();
  protected readonly chatMessageProvider: IPromptProvider<ChatMessageInput> = new ChatSummaryMessagePrompt();

  constructor() {
    super();
  }

  public override async getResponse(input: ChatMessageInput): Promise<string> {
    return super.getResponse(input);
  }
} 