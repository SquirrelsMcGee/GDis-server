import { ISearchResult } from "../../lib/interfaces/web-search-api-response";
import { OllamaBase } from "./ollama";
import { WebSearchSummaryConversationPrompt, WebSearchSummaryMessagePrompt } from "./prompt-providers/search-summary";

export class SearchSummarizer extends OllamaBase<ISearchResult[]> {
  private readonly contextKey: string = Date.now().toString();
  constructor() {
    super('SearchSummarizer', new WebSearchSummaryConversationPrompt(), new WebSearchSummaryMessagePrompt());
  }

  getContextKey(_: ISearchResult[]): string {
    return this.contextKey;
  }
}