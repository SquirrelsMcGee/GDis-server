import { ChatMessageInput } from "./discord-chat";
import { IPromptProvider } from "./prompt-provider";

export class CategoriserConversationPrompt implements IPromptProvider<unknown> {
  public provide(values?: unknown): string {
    return `You are an automated system for understand the intent behind a message Categorise messages as one of the following
[Chat]
[Web Search] 
If the category is [Web Search] give a suitable web search phrase (in human language) for the message alongside the category
Your response will be used in an automated process so only respond with these options Acknowledge these instructions with OKAY`;
  }
}

export class BasicMessagePrompt implements IPromptProvider<ChatMessageInput> {
  provide(values?: ChatMessageInput): string {
    if (!values)
      throw 'missing argument for prompt, values';
    return values.message;
  }
}