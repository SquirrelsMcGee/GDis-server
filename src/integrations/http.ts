import axios, { AxiosResponse, RawAxiosRequestHeaders, ResponseType } from "axios";
import { first, Observable, Subject } from "rxjs";
import { Logger } from "../helpers/logger";
import { PromiseFactory } from "../helpers/promise-factory";
import { Exception, FatalException } from "../lib/custom-error";
import { INamed } from "../lib/named-class";


export class HttpService implements INamed {
  public readonly name: string = 'HttpService';

  private readonly logger = new Logger();

  constructor(
    private readonly host: string,
    private readonly port?: string
  ) {
    if (!host)
      throw new FatalException('HttpService failed to construct, hostname not provided');

    this.logger.setInfo(this.name);
  }

  public post<T>(path: string, body?: unknown, params?: URLSearchParams, headers?: RawAxiosRequestHeaders, responseType?: ResponseType): Observable<T> {
    // Create observable for return
    const reqObservable = new Subject<T>();

    // Send the POST request
    axios.post(this.getUrl(path), body, { params, headers, responseType })
      // Handle the response
      .then(res => this.handleResult<T>(res))
      // Update the observable
      .then(data => reqObservable.next(data))
      // Catch errors
      .catch(error => this.handleError<T>('post', error));

    // Return observable
    return reqObservable.pipe(first());
  }

  public get<T>(path: string, params?: URLSearchParams, headers?: RawAxiosRequestHeaders): Observable<T> {
    // Create observable for return
    const reqObservable = new Subject<T>();

    // Send the GET request
    axios.get(this.getUrl(path), { params, headers })
      // Handle the response
      .then(res => this.handleResult<T>(res))
      // Update the observable
      .then(data => reqObservable.next(data))
      // Catch errors
      .catch(error => this.handleError<T>('', error));

    // Return observable
    return reqObservable.pipe(first());
  }

  private handleResult<T>(response: AxiosResponse): T {
    if (response.status >= 200 && response.status <= 299)
      return response.data as T;
    else
      throw new FatalException(response.statusText);
  }

  private handleError<T>(method: string, error: Exception): Observable<T> {
    if (error.isFatal)
      this.logger.error(error.message);
    else
      this.logger.warn(error.message);

    return PromiseFactory.throwErrorObservable(this.name, [method, error]);
  }

  private getUrl(path: string): string {
    const portString = this.port ? `:${this.port}` : '';
    const pathString = `/${path}`;
    return `${this.host}${portString}${pathString}`;
  }
}