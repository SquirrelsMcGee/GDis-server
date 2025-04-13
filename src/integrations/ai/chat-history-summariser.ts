import { INamed } from "../../lib/named-class";
import { Ollama } from "./ollama";
import { ChatSummaryConversationPrompt, ChatSummaryMessagePrompt } from "./prompt-providers/chat-summary";
import { ChatMessageInput } from "./prompt-providers/discord-chat";
import { IPromptProvider } from "./prompt-providers/prompt-provider";

export class ChatHistorySummariser extends Ollama implements INamed {
  public override readonly name: string = 'ChatHistorySummariser';

  protected readonly conversationProvider: IPromptProvider<unknown> = new ChatSummaryConversationPrompt();
  protected readonly chatMessageProvider: IPromptProvider<ChatMessageInput> = new ChatSummaryMessagePrompt();

  constructor(private readonly username: string) {
    super('ChatHistorySummariser');
  }

  public override async getResponse(input: ChatMessageInput): Promise<string> {
    const result = await super.getResponse(input);
    if (input.username === this.username)
      this.logger.info(result);

    return Promise.resolve(result);
  }
} 