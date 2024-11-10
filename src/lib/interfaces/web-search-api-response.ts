export interface IWebSearchApiResponse {
  type: 'search';
  discussions: unknown;
  faq: unknown;
  infobox: unknown;
  locations: unknown;
  news: unknown;
  query: unknown;
  videos: unknown;
  web: ISearch;
  summarizer: unknown;
}

export interface ISearch {
  type: 'search';
  results: ISearchResult[];
}

export interface ISearchResult {
  title: string;
  url: string;
  description: string;
}

export class SearchResult implements ISearchResult {
  title: string;
  url: string;
  description: string;

  constructor(title: string, url: string, description: string) {
    this.title = title;
    this.url = url;
    this.description = description;
  }

  toString(): string {
    return `<searchResponse>
<title> ${this.title} </title>
<url> ${this.url} </url>
<description> ${this.description} </description>`;
  }
}