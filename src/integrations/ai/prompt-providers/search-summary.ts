import { FatalException } from "../../../lib/custom-error";
import { ISearchResult, SearchResult } from "../../../lib/interfaces/web-search-api-response";
import { IPromptProvider } from "./prompt-provider";

export class WebSearchSummaryConversationPrompt implements IPromptProvider<unknown> {

  public provide(values?: unknown): string {
    return `You are an automated tool for summarizing web search results.
You will receive these results in XML-like format where there may be multiple searchContext objects
<searchContext>
  <title> web page title </title>
  <url> web page url </url>
  <description> web page summary </description>
</searchContext>
Pick a result to summarize including links where possible, your response will be used in an automated context so only include your summary.`;
  }
}

export class WebSearchSummaryMessagePrompt implements IPromptProvider<ISearchResult[]> {

  public provide(values?: ISearchResult[]): string {
    if (!values)
      throw new FatalException('Cannot generate prompt, argument values not provided');

    const contextObjects = values.map(SearchResult.fromObject).map(r => r.toString()).join('\r\n');

    return contextObjects;
  }
}