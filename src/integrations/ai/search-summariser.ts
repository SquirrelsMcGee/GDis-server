import { ISearchResult } from "../../lib/interfaces/web-search-api-response";
import { OllamaBase } from "./ollama";
import { WebSearchSummaryConversationPrompt, WebSearchSummaryMessagePrompt } from "./prompt-providers/search-summary";

export class SearchSummariser extends OllamaBase<ISearchResult[]> {

  private readonly contextKey: string = Date.now().toString();
  constructor() {
    super(
      'SearchSummariser',
      new WebSearchSummaryConversationPrompt(),
      new WebSearchSummaryMessagePrompt());
  }

  getContextKey(_: ISearchResult[]): string {
    return this.contextKey;
  }
}