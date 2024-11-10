import axios, { AxiosResponse, RawAxiosRequestHeaders } from "axios";
import { catchError, from, Observable } from "rxjs";
import { INamed } from "../lib/named-class";
import { Logger } from "./logger";
import { PromiseFactory } from "./promise-factory";


export class HttpService implements INamed {
  public readonly name: string = 'HttpService';

  constructor(
    private readonly host: string,
    private readonly port?: string
  ) {
    if (!host)
      throw 'HttpService failed to construct, hostname not provided';
  }

  public post<T>(path: string, body?: unknown, params?: URLSearchParams, headers?: RawAxiosRequestHeaders): Observable<T> {
    return from(axios.post(this.getUrl(path), body, { params, headers }).then(r => this.handleResult<T>(r)))
      .pipe(catchError((error) => this.handleError<T>('post', error)));
  }

  public get<T>(path: string, params?: URLSearchParams, headers?: RawAxiosRequestHeaders): Observable<T> {
    return from(axios.get(this.getUrl(path), { params, headers }).then(r => this.handleResult<T>(r)))
      .pipe(catchError(e => this.handleError<T>('post', e)));
  }

  private getUrl(path: string): string {
    const portString = this.port ? `:${this.port}` : '';
    const pathString = `/${path}`;

    return `${this.host}${portString}${pathString}`;
  }


  private handleResult<T>(response: AxiosResponse): T {
    if (response.status >= 200 && response.status <= 299)
      return response.data as T;
    else
      throw response.statusText;
  }

  private handleError<T>(method: string, error: unknown): Observable<T> {
    Logger.error(this.name, method, error);
    return PromiseFactory.throwErrorObservable(this.name, [method, error]);
  }
}