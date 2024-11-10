
import { first, map, Observable } from "rxjs";
import { config } from "../config";
import { HttpService } from "../helpers/http";
import { ISearchResult, IWebSearchApiResponse } from "../lib/interfaces/web-search-api-response";
import { INamed } from "../lib/named-class";

export class BraveSearch implements INamed {
  public readonly name: string = 'BraveSearch';

  private readonly apiKey = config.BRAVE_API_KEY;

  private readonly http: HttpService;

  constructor() {
    this.http = new HttpService('https://api.search.brave.com');
  }

  public search(query: string): Observable<ISearchResult[]> {
    return this.doSearch(query).pipe(map(result => result.web.results));
  }

  private doSearch(query: string): Observable<IWebSearchApiResponse> {
    const headers = {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': this.apiKey,
    };

    const params = new URLSearchParams({
      'q': encodeURIComponent(query),
      'count': '5',
      'safesearch': 'off'
    });

    return this.http.get<IWebSearchApiResponse>('res/v1/web/search', params, headers)
      .pipe(first());
  }
}